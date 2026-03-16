import { WebSocketServer, WebSocket } from "ws";

interface PeerInfo {
  ws: WebSocket;
  peerId: string;
  roomId: string;
  displayName: string;
  avatarIndex: number;
  customAvatarUrl?: string;
  userId?: number;
}

const rooms = new Map<string, Map<string, PeerInfo>>();

function broadcast(roomId: string, data: object, excludePeerId?: string) {
  const room = rooms.get(roomId);
  if (!room) return;
  const message = JSON.stringify(data);
  for (const [peerId, peer] of room) {
    if (peerId !== excludePeerId && peer.ws.readyState === WebSocket.OPEN) {
      peer.ws.send(message);
    }
  }
}

export function setupSignaling(wss: WebSocketServer) {
  wss.on("connection", (ws: WebSocket) => {
    let currentPeer: PeerInfo | null = null;

    ws.on("message", async (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      const type = msg.type as string;

      if (type === "join") {
        const { roomId, peerId, displayName, avatarIndex, customAvatarUrl, userId } = msg as {
          roomId: string; peerId: string; displayName: string; avatarIndex: number; customAvatarUrl?: string; userId?: number;
        };

        if (!rooms.has(roomId)) rooms.set(roomId, new Map());
        const room = rooms.get(roomId)!;

        currentPeer = { ws, peerId, roomId, displayName, avatarIndex, customAvatarUrl, userId };
        room.set(peerId, currentPeer);

        const existingPeers = Array.from(room.values())
          .filter((p) => p.peerId !== peerId)
          .map((p) => ({ peerId: p.peerId, displayName: p.displayName, avatarIndex: p.avatarIndex, customAvatarUrl: p.customAvatarUrl }));

        ws.send(JSON.stringify({ type: "room-joined", roomId, peers: existingPeers }));
        broadcast(roomId, { type: "peer-joined", peerId, displayName, avatarIndex, customAvatarUrl }, peerId);

        console.log(`Peer ${peerId} (${displayName}) joined room ${roomId}. Room size: ${room.size}`);

      } else if (type === "signal") {
        const { targetPeerId, signal, fromPeerId } = msg as {
          targetPeerId: string; signal: unknown; fromPeerId: string;
        };
        const roomId = currentPeer?.roomId ?? (msg.roomId as string);
        const room = rooms.get(roomId);
        const target = room?.get(targetPeerId);
        if (target && target.ws.readyState === WebSocket.OPEN) {
          target.ws.send(JSON.stringify({ type: "signal", fromPeerId, targetPeerId, roomId, signal }));
        }

      } else if (type === "state-update") {
        // Broadcasts mute/camera/lid state changes to all peers in the room
        const { roomId: msgRoomId, isMuted, isCameraOff, isLidOpen, peerId } = msg as {
          roomId: string; peerId: string; isMuted: boolean; isCameraOff: boolean; isLidOpen: boolean;
        };
        const targetRoom = msgRoomId ?? currentPeer?.roomId;
        if (targetRoom) {
          broadcast(targetRoom, { type: "state-update", peerId, isMuted, isCameraOff, isLidOpen }, peerId as string);
        }

      } else if (type === "reaction") {
        if (!currentPeer) return;
        const { text } = msg as { text: string };
        broadcast(currentPeer.roomId, { type: "reaction", fromPeerId: currentPeer.peerId, text });

      } else if (type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
      }
    });

    ws.on("close", () => {
      if (!currentPeer) return;
      const { roomId, peerId, displayName } = currentPeer;
      const room = rooms.get(roomId);
      if (room) {
        room.delete(peerId);
        if (room.size === 0) rooms.delete(roomId);
        else broadcast(roomId, { type: "peer-left", peerId, displayName });
      }
      console.log(`Peer ${peerId} left room ${roomId}`);
    });

    ws.on("error", (err) => {
      console.error("WebSocket error:", err.message);
    });
  });
}

export function getRoomParticipantCount(roomId: string): number {
  return rooms.get(roomId)?.size ?? 0;
}

export function roomExists(roomId: string): boolean {
  return rooms.has(roomId);
}

export function getOnlineUserRooms(): Map<number, string> {
  const result = new Map<number, string>();
  for (const [roomId, room] of rooms) {
    for (const [, peer] of room) {
      if (peer.userId) {
        result.set(peer.userId, roomId);
      }
    }
  }
  return result;
}
