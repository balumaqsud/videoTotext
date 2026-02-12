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
    <div className="h-screen overflow-hidden flex flex-col px-4 py-3 font-sans bg-zinc-950">
      {/* Header: compact row with room + status pill */}
      <header className="flex items-center gap-3 shrink-0 mb-2">
        <h1 className="text-lg font-semibold text-zinc-100">Room: {roomId}</h1>
        <span
          className="rounded-full px-2.5 py-0.5 text-sm font-medium bg-zinc-800 text-zinc-300"
          aria-label="Connection status"
        >
          {status}
        </span>
      </header>

      {/* Video block: full width, same as Live captions */}
      <div className="w-full shrink-0 my-2 mb-3">
        <div className="flex w-full gap-4">
          <div className="rounded-xl overflow-hidden shadow-lg border border-zinc-700 bg-black flex-1 min-w-0 flex flex-col h-[318px]">
            <p className="text-sm font-medium text-zinc-400 mb-1 px-0.5 shrink-0">Local Video</p>
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              className="w-full flex-1 min-h-0 object-cover block"
            />
          </div>
          <div className="rounded-xl overflow-hidden shadow-lg border border-zinc-700 bg-black flex-1 min-w-0 flex flex-col h-[318px]">
            <p className="text-sm font-medium text-zinc-400 mb-1 px-0.5 shrink-0">Remote Video</p>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full flex-1 min-h-0 object-cover block"
            />
          </div>
        </div>
      </div>

      {/* Captions: fixed height (remaining space), scrollable content only */}
      <section className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-800 p-4 flex flex-col">
          <h2 className="text-sm font-semibold text-zinc-200 mb-2 shrink-0">Live Captions</h2>
          {captions.length === 0 ? (
            <p className="text-zinc-500 text-sm mt-0">No captions yet...</p>
          ) : (
            <div className="space-y-1.5 leading-relaxed">
              {captions.map((caption, idx) => (
                <p key={idx} className="text-zinc-200 m-0">
                  {caption}
                </p>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
