'use client';

import { use, useEffect, useRef, useState } from 'react';
import { createSignalingClient } from '@/features/signaling/wsClient';
import { getLocalStream } from '@/features/webrtc/media';
import { createPeer } from '@/features/webrtc/peer';
import { startMicChunking } from '@/features/transcription/micChunker';
import { ServerMsg } from '@/server/ws/messages';

interface PageProps {
  params: Promise<{ roomId: string }>;
}

export default function RoomPage({ params }: PageProps) {
  const { roomId } = use(params);
  const [status, setStatus] = useState('Initializing...');
  const [captions, setCaptions] = useState<string[]>([]);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const transcribeInFlightRef = useRef(false);
  const pendingChunkRef = useRef<{ blob: Blob; mimeType: string } | null>(null);
  const chunkCountRef = useRef(0);

  useEffect(() => {
    let signalingClient: ReturnType<typeof createSignalingClient> | null = null;
    let peer: ReturnType<typeof createPeer> | null = null;
    let chunker: ReturnType<typeof startMicChunking> | null = null;
    let localStream: MediaStream | null = null;

    const init = async () => {
      try {
        // Get local media stream
        setStatus('Getting camera and microphone...');
        localStream = await getLocalStream();

        // Attach local stream to video
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
          localVideoRef.current.muted = true;
        }

        // Connect to WebSocket signaling server
        setStatus('Connecting to signaling server...');
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

        signalingClient = createSignalingClient(wsUrl, handleServerMessage);
        await signalingClient.ready();

        // Create peer connection
        peer = createPeer({
          onRemoteStream: (stream) => {
            console.log('Remote stream received');
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = stream;
            }
            setStatus('Connected');
          },
          onIceCandidate: (candidate) => {
            if (signalingClient) {
              signalingClient.send({
                type: 'ice',
                roomId,
                candidate: candidate.toJSON(),
              });
            }
          },
        });

        // Add local stream to peer
        peer.addLocalStream(localStream);

        // Join room
        setStatus('Joining room...');
        signalingClient.send({ type: 'join', roomId });

        // Start creating offer after a delay (race-friendly MVP approach)
        setTimeout(async () => {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/0718865c-6677-4dac-b4e1-1fa618bb874f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'room/[roomId]/page.tsx:setTimeout',message:'creating and sending offer',data:{},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
          // #endregion
          if (peer && signalingClient) {
            try {
              const sdp = await peer.createOffer();
              signalingClient.send({ type: 'offer', roomId, sdp });
            } catch (err) {
              console.log('Offer creation skipped or failed:', err);
            }
          }
        }, 800);

        // Start microphone chunking for transcription (one request at a time to avoid overload; queue latest)
        const processNextChunk = async () => {
          const next = pendingChunkRef.current;
          pendingChunkRef.current = null;
          const inFlightBefore = transcribeInFlightRef.current;
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/0718865c-6677-4dac-b4e1-1fa618bb874f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'room/[roomId]/page.tsx:processNextChunkStart',message:'processNextChunk start',data:{hasNext:!!next,inFlightBefore},timestamp:Date.now(),hypothesisId:'T2'})}).catch(()=>{});
          // #endregion
          if (!next) return;
          transcribeInFlightRef.current = true;
          const { blob, mimeType } = next;
          try {
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/0718865c-6677-4dac-b4e1-1fa618bb874f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'room/[roomId]/page.tsx:onChunk',message:'Sending chunk to transcribe',data:{blobSize:blob.size},timestamp:Date.now(),hypothesisId:'T2'})}).catch(()=>{});
            // #endregion
            const ext = mimeType.startsWith('audio/mp4')
              ? 'm4a'
              : mimeType.startsWith('audio/ogg')
                ? 'oga'
                : 'webm';
            const formData = new FormData();
            formData.append('audio', blob, `audio.${ext}`);

            const response = await fetch('/api/transcribe', {
              method: 'POST',
              body: formData,
            });

            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/0718865c-6677-4dac-b4e1-1fa618bb874f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'room/[roomId]/page.tsx:afterFetch',message:'Transcribe response',data:{ok:response.ok,status:response.status},timestamp:Date.now(),hypothesisId:'T3'})}).catch(()=>{});
            // #endregion
            if (response.ok) {
              const data = await response.json();
              // #region agent log
              fetch('http://127.0.0.1:7243/ingest/0718865c-6677-4dac-b4e1-1fa618bb874f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'room/[roomId]/page.tsx:setCaptions',message:'API result',data:{hasText:!!(data.text&&data.text.trim()),textLen:data.text?.length??0},timestamp:Date.now(),hypothesisId:'T2'})}).catch(()=>{});
              // #endregion
              if (data.text && data.text.trim()) {
                setCaptions((prev) => {
                  const newCaptions = [...prev, data.text];
                  return newCaptions.slice(-50); // Keep last 50 lines
                });
              }
            }
          } catch (err) {
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/0718865c-6677-4dac-b4e1-1fa618bb874f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'room/[roomId]/page.tsx:transcribeCatch',message:'Transcription request failed',data:{err:String(err)},timestamp:Date.now(),hypothesisId:'T3'})}).catch(()=>{});
            // #endregion
            console.error('Transcription request failed:', err);
          } finally {
            transcribeInFlightRef.current = false;
            const hasPendingAgain = !!pendingChunkRef.current;
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/0718865c-6677-4dac-b4e1-1fa618bb874f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'room/[roomId]/page.tsx:processNextChunkFinally',message:'processNextChunk finally',data:{hasPendingAgain},timestamp:Date.now(),hypothesisId:'T2'})}).catch(()=>{});
            // #endregion
            if (pendingChunkRef.current) processNextChunk();
          }
        };

        chunker = startMicChunking(localStream, (blob, mimeType) => {
          chunkCountRef.current += 1;
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/0718865c-6677-4dac-b4e1-1fa618bb874f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'room/[roomId]/page.tsx:chunkQueued',message:'chunk queued',data:{chunkIndex:chunkCountRef.current},timestamp:Date.now(),hypothesisId:'T1'})}).catch(()=>{});
          // #endregion
          pendingChunkRef.current = { blob, mimeType };
          if (!transcribeInFlightRef.current) processNextChunk();
        });

        setStatus('Waiting for peer...');
      } catch (err) {
        console.error('Initialization error:', err);
        setStatus(`Error: ${err}`);
      }
    };

    const handleServerMessage = async (msg: ServerMsg) => {
      console.log('Server message:', msg.type);

      switch (msg.type) {
        case 'peer-joined':
          setStatus('Peer joined');
          break;

        case 'peer-left':
          setStatus('Peer left');
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
          }
          break;

        case 'room-full':
          setStatus('Room is full (max 2 peers)');
          break;

        case 'offer':
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/0718865c-6677-4dac-b4e1-1fa618bb874f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'room/[roomId]/page.tsx:offer',message:'handling offer (becoming answerer)',data:{},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
          // #endregion
          if (peer && signalingClient) {
            try {
              const answerSdp = await peer.acceptOfferCreateAnswer(msg.sdp);
              signalingClient.send({ type: 'answer', roomId, sdp: answerSdp });
              setStatus('Connected');
            } catch (err) {
              console.error('Error handling offer:', err);
            }
          }
          break;

        case 'answer':
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/0718865c-6677-4dac-b4e1-1fa618bb874f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'room/[roomId]/page.tsx:answer',message:'handling answer',data:{},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
          // #endregion
          if (peer) {
            try {
              await peer.acceptAnswer(msg.sdp);
              setStatus('Connected');
            } catch (err) {
              console.error('Error handling answer:', err);
            }
          }
          break;

        case 'ice':
          if (peer && msg.candidate) {
            try {
              await peer.addIce(msg.candidate);
            } catch (err) {
              console.error('Error adding ICE candidate:', err);
            }
          }
          break;
      }
    };

    init();

    // Cleanup on unmount
    return () => {
      if (chunker) chunker.stop();
      if (peer) peer.close();
      if (signalingClient) signalingClient.close();
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [roomId]);

  return (
    <div style={{ padding: '1rem', fontFamily: 'sans-serif' }}>
      <h1 style={{ marginBottom: '0.5rem' }}>Room: {roomId}</h1>
      <p style={{ marginBottom: '1rem', color: '#666' }}>Status: {status}</p>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ marginBottom: '0.5rem' }}>Local Video</h3>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            style={{
              width: '400px',
              height: '300px',
              backgroundColor: '#000',
              borderRadius: '4px',
            }}
          />
        </div>

        <div>
          <h3 style={{ marginBottom: '0.5rem' }}>Remote Video</h3>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{
              width: '400px',
              height: '300px',
              backgroundColor: '#000',
              borderRadius: '4px',
            }}
          />
        </div>
      </div>

      <div
        style={{
          border: '1px solid #ccc',
          borderRadius: '4px',
          padding: '1rem',
          minHeight: '200px',
          maxHeight: 'min(480px, 50vh)',
          overflowY: 'auto',
          backgroundColor: '#f9f9f9',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Live Captions</h3>
        {captions.length === 0 ? (
          <p style={{ color: '#999', margin: 0 }}>No captions yet...</p>
        ) : (
          <div>
            {captions.map((caption, idx) => (
              <p key={idx} style={{ margin: '0.25rem 0' }}>
                {caption}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
