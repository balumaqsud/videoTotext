interface PeerConfig {
  onRemoteStream: (stream: MediaStream) => void;
  onIceCandidate: (candidate: RTCIceCandidate) => void;
}

interface Peer {
  addLocalStream: (stream: MediaStream) => void;
  createOffer: () => Promise<string>;
  acceptOfferCreateAnswer: (sdp: string) => Promise<string>;
  acceptAnswer: (sdp: string) => Promise<void>;
  addIce: (candidate: RTCIceCandidateInit) => Promise<void>;
  close: () => void;
}

export function createPeer(config: PeerConfig): Peer {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  });

  const remoteStream = new MediaStream();

  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
    config.onRemoteStream(remoteStream);
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      config.onIceCandidate(event.candidate);
    }
  };

  return {
    addLocalStream: (stream: MediaStream) => {
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });
    },

    createOffer: async () => {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      return offer.sdp!;
    },

    acceptOfferCreateAnswer: async (sdp: string) => {
      await pc.setRemoteDescription({ type: 'offer', sdp });
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      return answer.sdp!;
    },

    acceptAnswer: async (sdp: string) => {
      await pc.setRemoteDescription({ type: 'answer', sdp });
    },

    addIce: async (candidate: RTCIceCandidateInit) => {
      await pc.addIceCandidate(candidate);
    },

    close: () => {
      pc.close();
    },
  };
}
