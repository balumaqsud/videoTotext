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
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/0718865c-6677-4dac-b4e1-1fa618bb874f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'peer.ts:createOffer',message:'after setLocalDescription(offer)',data:{signalingState:pc.signalingState},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
      return offer.sdp!;
    },

    acceptOfferCreateAnswer: async (sdp: string) => {
      await pc.setRemoteDescription({ type: 'offer', sdp });
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/0718865c-6677-4dac-b4e1-1fa618bb874f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'peer.ts:acceptOfferCreateAnswer',message:'after setLocalDescription(answer)',data:{signalingState:pc.signalingState},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      return answer.sdp!;
    },

    acceptAnswer: async (sdp: string) => {
      const state = pc.signalingState;
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/0718865c-6677-4dac-b4e1-1fa618bb874f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'peer.ts:acceptAnswer',message:'acceptAnswer called',data:{signalingState:state},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      if (state !== 'have-local-offer') {
        console.warn('Ignoring remote answer in signalingState', state);
        return;
      }
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
