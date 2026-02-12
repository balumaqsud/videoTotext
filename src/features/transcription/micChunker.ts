interface MicChunker {
  stop: () => void;
  mimeType: string;
}

export function startMicChunking(
  stream: MediaStream,
  onChunk: (blob: Blob, mimeType: string) => void
): MicChunker {
  // Extract only audio tracks
  const audioStream = new MediaStream(stream.getAudioTracks());

  // Detect supported mime type (browser support varies; Safari needs audio/mp4)
  const mimeTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];

  let mimeType = '';
  for (const mt of mimeTypes) {
    if (MediaRecorder.isTypeSupported(mt)) {
      mimeType = mt;
      break;
    }
  }

  function createRecorder(): MediaRecorder {
    let r: MediaRecorder;
    try {
      r = mimeType
        ? new MediaRecorder(audioStream, { mimeType })
        : new MediaRecorder(audioStream);
      if (!mimeType) mimeType = r.mimeType;
    } catch {
      r = new MediaRecorder(audioStream);
      mimeType = r.mimeType;
    }
    return r;
  }

  let recorder = createRecorder();
  let segmentTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  function scheduleNextSegment() {
    if (stopped) return;
    segmentTimeoutId = setTimeout(() => {
      if (stopped || !recorder || recorder.state === 'inactive') return;
      recorder.stop();
    }, 6000);
  }

  let chunkIndex = 0;
  function handleDataAvailable(event: BlobEvent) {
    chunkIndex += 1;
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/0718865c-6677-4dac-b4e1-1fa618bb874f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'micChunker.ts:ondataavailable',message:'MediaRecorder ondataavailable',data:{size:event.data?.size ?? 0,chunkIndex},timestamp:Date.now(),hypothesisId:'T1'})}).catch(()=>{});
    // #endregion
    if (event.data.size > 0) {
      onChunk(event.data, mimeType);
    }
  }

  function startNextSegment() {
    if (stopped) return;
    recorder = createRecorder();
    recorder.ondataavailable = handleDataAvailable;
    recorder.onstop = startNextSegment;
    recorder.start();
    scheduleNextSegment();
  }

  recorder.ondataavailable = handleDataAvailable;
  recorder.onstop = startNextSegment;

  // Restart recorder every 6s so each blob is a full standalone segment (init + data).
  // With start(6000), only the first blob has the init segment; later blobs are fragments and return empty transcription.
  recorder.start();
  scheduleNextSegment();

  return {
    stop: () => {
      stopped = true;
      if (segmentTimeoutId != null) {
        clearTimeout(segmentTimeoutId);
        segmentTimeoutId = null;
      }
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = null;
        recorder.stop();
      }
      audioStream.getTracks().forEach((track) => track.stop());
    },
    mimeType,
  };
}
