import { ClientMsg, ServerMsg } from "@/server/ws/messages";

interface SignalingClient {
  ws: WebSocket;
  ready: () => Promise<void>;
  send: (obj: ClientMsg) => void;
  close: () => void;
}

export function createSignalingClient(
  url: string,
  onMsg: (msg: ServerMsg) => void,
): SignalingClient {
  const ws = new WebSocket(url);
  let readyResolve: (() => void) | null = null;

  const readyPromise = new Promise<void>((resolve) => {
    readyResolve = resolve;
  });

  ws.onopen = () => {
    console.log("WebSocket connected");
    if (readyResolve) readyResolve();
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data) as ServerMsg;
      onMsg(msg);
    } catch (err) {
      console.error("Failed to parse server message:", err);
    }
  };

  ws.onerror = () => {
    console.error(
      "WebSocket connection failed to",
      url,
      "(is the signaling server running?)",
    );
  };

  ws.onclose = (event) => {
    if (!event.wasClean) {
      console.warn("WebSocket closed unexpectedly:", event.code, event.reason);
    } else {
      console.log("WebSocket closed");
    }
  };

  return {
    ws,
    ready: () => readyPromise,
    send: (obj: ClientMsg) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(obj));
      }
    },
    close: () => ws.close(),
  };
}
