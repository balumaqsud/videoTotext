# Video Call App

A minimal but production-structured Next.js video call application with WebRTC, WebSocket signaling, and live transcription.

## Features

- 2-person video calls via room URLs (`/room/[roomId]`)
- WebRTC peer-to-peer video/audio
- WebSocket signaling server (separate process)
- Live transcription using OpenAI Whisper API
- No authentication or database required

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
Update `.env.local` with your OpenAI API key:
```
NEXT_PUBLIC_WS_URL=ws://localhost:3004
OPENAI_API_KEY=your_actual_openai_key_here
```

## Running the Application

You need to run **two processes** in separate terminals:

### Terminal A: Next.js Dev Server
```bash
npm run dev
```

### Terminal B: WebSocket Signaling Server
```bash
npm run dev:ws
```

## Usage

1. Open your browser to `http://localhost:3000`
2. Enter a room ID (e.g., "abc") and click "Join Room"
3. Open a second browser window/tab (or different browser)
4. Enter the same room ID and join
5. Both peers should now see each other's video and receive live captions

## Architecture

```
src/
├── app/                    # Next.js App Router
│   ├── api/transcribe/     # OpenAI transcription endpoint
│   ├── room/[roomId]/      # Video call room page
│   └── page.tsx            # Home page
├── features/
│   ├── signaling/          # WebSocket client wrapper
│   ├── transcription/      # Microphone chunking
│   └── webrtc/             # WebRTC peer & media utilities
├── lib/
│   └── env.ts              # Environment variable handling
└── server/
    └── ws/                 # WebSocket signaling server
        ├── index.ts        # Server entry point
        ├── messages.ts     # Zod schemas & types
        └── rooms.ts        # In-memory room registry
```

## Technical Stack

- **Next.js 14+** with App Router
- **TypeScript** for type safety
- **WebRTC** for peer-to-peer video/audio
- **WebSocket** for signaling
- **Zod** for runtime validation
- **OpenAI Whisper API** for transcription
