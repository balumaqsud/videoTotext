import { WebSocket } from 'ws';

interface Room {
  a?: WebSocket;
  b?: WebSocket;
}

const rooms = new Map<string, Room>();

export function joinRoom(roomId: string, ws: WebSocket): { ok: boolean; role?: 'a' | 'b' } {
  let room = rooms.get(roomId);
  if (!room) {
    room = {};
    rooms.set(roomId, room);
  }

  if (!room.a) {
    room.a = ws;
    return { ok: true, role: 'a' };
  } else if (!room.b) {
    room.b = ws;
    return { ok: true, role: 'b' };
  } else {
    // Room is full
    return { ok: false };
  }
}

export function getPeer(roomId: string, ws: WebSocket): WebSocket | null {
  const room = rooms.get(roomId);
  if (!room) return null;

  if (room.a === ws) return room.b || null;
  if (room.b === ws) return room.a || null;
  return null;
}

export function findRoomsOf(ws: WebSocket): string[] {
  const result: string[] = [];
  for (const [roomId, room] of rooms.entries()) {
    if (room.a === ws || room.b === ws) {
      result.push(roomId);
    }
  }
  return result;
}

export function leaveAllRooms(ws: WebSocket): void {
  for (const [roomId, room] of rooms.entries()) {
    if (room.a === ws) {
      room.a = undefined;
    }
    if (room.b === ws) {
      room.b = undefined;
    }

    // Cleanup empty rooms
    if (!room.a && !room.b) {
      rooms.delete(roomId);
    }
  }
}
