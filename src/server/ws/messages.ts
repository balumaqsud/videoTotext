import { z } from 'zod';

// Client -> Server messages
export const ClientMsgSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('join'),
    roomId: z.string(),
  }),
  z.object({
    type: z.literal('offer'),
    roomId: z.string(),
    sdp: z.string(),
  }),
  z.object({
    type: z.literal('answer'),
    roomId: z.string(),
    sdp: z.string(),
  }),
  z.object({
    type: z.literal('ice'),
    roomId: z.string(),
    candidate: z.custom<RTCIceCandidateInit>(
      (val) => typeof val === 'object' && val !== null && !Array.isArray(val),
    ),
  }),
  z.object({
    type: z.literal('leave'),
    roomId: z.string(),
  }),
]);

export type ClientMsg = z.infer<typeof ClientMsgSchema>;

// Server -> Client messages
export type ServerMsg =
  | { type: 'peer-joined' }
  | { type: 'role'; role: 'initiator' | 'responder' }
  | { type: 'peer-left' }
  | { type: 'room-full' }
  | { type: 'offer'; sdp: string }
  | { type: 'answer'; sdp: string }
  | { type: 'ice'; candidate: RTCIceCandidateInit };
