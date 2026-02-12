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

  // Detect supported mime type
  const mimeTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
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

  if (!mimeType) {
    console.warn('No supported mime type found, using default');
    mimeType = 'audio/webm';
  }

  const recorder = new MediaRecorder(audioStream, { mimeType });

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
