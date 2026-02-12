"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [roomId, setRoomId] = useState("");
  const router = useRouter();

  const handleJoin = () => {
    if (roomId.trim()) {
      router.push(`/room/${roomId.trim()}`);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-zinc-950 text-zinc-100 font-sans">
      <div className="p-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 ring-1 ring-zinc-700 space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          PromptLab Call
        </h1>
        <div className="flex gap-3 items-center">
          <input
            type="text"
            placeholder="Enter room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleJoin}
            className="bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg px-5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-zinc-900"
          >
            Join Room
          </button>
        </div>
      </div>
    </div>
  );
}
