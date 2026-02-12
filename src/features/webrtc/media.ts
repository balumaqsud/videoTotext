export async function getLocalStream(): Promise<MediaStream> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error(
      'Camera and microphone require a secure context (HTTPS or localhost). Use http://localhost:3000 instead of the network URL.',
    );
  }
  return await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true,
  });
}
