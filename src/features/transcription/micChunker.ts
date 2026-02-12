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

  let recorder: MediaRecorder;
  try {
    recorder = mimeType
      ? new MediaRecorder(audioStream, { mimeType })
      : new MediaRecorder(audioStream);
    if (!mimeType) mimeType = recorder.mimeType;
  } catch {
    // isTypeSupported can lie (e.g. Safari); fall back to browser default
    recorder = new MediaRecorder(audioStream);
    mimeType = recorder.mimeType;
  }

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      onChunk(event.data, mimeType);
    }
  };

  recorder.start(2500); // 2.5 seconds chunks

  return {
    stop: () => {
      recorder.stop();
      audioStream.getTracks().forEach((track) => track.stop());
    },
    mimeType,
  };
}
