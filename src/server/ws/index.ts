import { WebSocketServer, WebSocket } from 'ws';
import { ClientMsgSchema, ServerMsg } from './messages';
import { joinRoom, getPeer, findRoomsOf, leaveAllRooms } from './rooms';

const PORT = parseInt(process.env.WS_PORT || '3004', 10);

const wss = new WebSocketServer({ port: PORT });

console.log(`WebSocket signaling server running on ws://localhost:${PORT}`);

wss.on('connection', (ws: WebSocket) => {
  console.log('Client connected');

  ws.on('message', (data: Buffer) => {
    try {
      const raw = JSON.parse(data.toString());
      const msg = ClientMsgSchema.parse(raw);

      switch (msg.type) {
        case 'join': {
          const result = joinRoom(msg.roomId, ws);
          if (!result.ok) {
            // Room is full
            const fullMsg: ServerMsg = { type: 'room-full' };
            ws.send(JSON.stringify(fullMsg));
            ws.close();
            return;
          }

          // Assign roles: first connection in a room is initiator (role 'a'),
          // second is responder (role 'b').
          if (result.role) {
            const selfRole: ServerMsg = {
              type: 'role',
              role: result.role === 'a' ? 'initiator' : 'responder',
            };
            ws.send(JSON.stringify(selfRole));

            const peer = getPeer(msg.roomId, ws);
            if (peer && peer.readyState === WebSocket.OPEN) {
              const peerRole: ServerMsg = {
                type: 'role',
                role: result.role === 'a' ? 'responder' : 'initiator',
              };
              peer.send(JSON.stringify(peerRole));
            }
          }

          // Check if peer already exists
          const peer = getPeer(msg.roomId, ws);
          if (peer && peer.readyState === WebSocket.OPEN) {
            // Notify both peers
            const joinedMsg: ServerMsg = { type: 'peer-joined' };
            ws.send(JSON.stringify(joinedMsg));
            peer.send(JSON.stringify(joinedMsg));
          }
          break;
        }

        case 'offer': {
          const peer = getPeer(msg.roomId, ws);
          if (peer && peer.readyState === WebSocket.OPEN) {
            const offerMsg: ServerMsg = { type: 'offer', sdp: msg.sdp };
            peer.send(JSON.stringify(offerMsg));
          }
          break;
        }

        case 'answer': {
          const peer = getPeer(msg.roomId, ws);
          if (peer && peer.readyState === WebSocket.OPEN) {
            const answerMsg: ServerMsg = { type: 'answer', sdp: msg.sdp };
            peer.send(JSON.stringify(answerMsg));
          }
          break;
        }

        case 'ice': {
          const peer = getPeer(msg.roomId, ws);
          if (peer && peer.readyState === WebSocket.OPEN) {
            const iceMsg: ServerMsg = { type: 'ice', candidate: msg.candidate };
            peer.send(JSON.stringify(iceMsg));
          }
          break;
        }

        case 'leave': {
          const peer = getPeer(msg.roomId, ws);
          leaveAllRooms(ws);
          if (peer && peer.readyState === WebSocket.OPEN) {
            const leftMsg: ServerMsg = { type: 'peer-left' };
            peer.send(JSON.stringify(leftMsg));
          }
          break;
        }
      }
    } catch (err) {
      console.error('Error processing message:', err);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    const roomIds = findRoomsOf(ws);
    for (const roomId of roomIds) {
      const peer = getPeer(roomId, ws);
      if (peer && peer.readyState === WebSocket.OPEN) {
        const leftMsg: ServerMsg = { type: 'peer-left' };
        peer.send(JSON.stringify(leftMsg));
      }
    }
    leaveAllRooms(ws);
  });
});
