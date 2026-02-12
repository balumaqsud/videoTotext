export async function getLocalStream(): Promise<MediaStream> {
  return await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true,
  });
}
