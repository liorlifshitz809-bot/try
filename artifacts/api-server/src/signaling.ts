import { WebSocketServer, WebSocket } from "ws";
import { pool } from "@workspace/db";

interface PeerInfo {
  ws: WebSocket;
  peerId: string;
  roomId: string;
  displayName: string;
  avatarIndex: number;
  sessionId?: number;
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

async function recordJoin(peerId: string, displayName: string, roomId: string): Promise<number | undefined> {
  try {
    const result = await pool.query(
      `INSERT INTO sessions (peer_id, display_name, room_id, joined_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id`,
      [peerId, displayName, roomId]
    );
    return result.rows[0]?.id as number;
  } catch (err) {
    console.error("Failed to record session join:", err);
    return undefined;
  }
}

async function recordLeave(sessionId: number) {
  try {
    await pool.query(
      `UPDATE sessions
       SET left_at = NOW(),
           duration_seconds = EXTRACT(EPOCH FROM (NOW() - joined_at))::INTEGER
       WHERE id = $1`,
      [sessionId]
    );
  } catch (err) {
    console.error("Failed to record session leave:", err);
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
        const { roomId, peerId, displayName, avatarIndex } = msg as {
          roomId: string;
          peerId: string;
          displayName: string;
          avatarIndex: number;
        };

        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Map());
        }
        const room = rooms.get(roomId)!;

        const sessionId = await recordJoin(peerId, displayName, roomId);

        currentPeer = { ws, peerId, roomId, displayName, avatarIndex, sessionId };
        room.set(peerId, currentPeer);

        const existingPeers = Array.from(room.values())
          .filter((p) => p.peerId !== peerId)
          .map((p) => ({
            peerId: p.peerId,
            displayName: p.displayName,
            avatarIndex: p.avatarIndex,
          }));

        ws.send(
          JSON.stringify({
            type: "room-joined",
            roomId,
            peers: existingPeers,
          }),
        );

        broadcast(
          roomId,
          {
            type: "peer-joined",
            peerId,
            displayName,
            avatarIndex,
          },
          peerId,
        );

        console.log(`Peer ${peerId} (${displayName}) joined room ${roomId}. Room size: ${room.size}`);
      } else if (type === "signal") {
        const { targetPeerId, signal, fromPeerId } = msg as {
          targetPeerId: string;
          signal: unknown;
          fromPeerId: string;
        };
        const roomId = currentPeer?.roomId ?? (msg.roomId as string);
        const room = rooms.get(roomId);
        const target = room?.get(targetPeerId);
        if (target && target.ws.readyState === WebSocket.OPEN) {
          target.ws.send(
            JSON.stringify({ type: "signal", fromPeerId, targetPeerId, roomId, signal }),
          );
        }
      } else if (type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
      } else if (type === "state-update") {
        const { roomId: msgRoomId, isMuted, isCameraOff, peerId } = msg as {
          roomId: string; peerId: string; isMuted: boolean; isCameraOff: boolean;
        };
        broadcast(msgRoomId ?? currentPeer?.roomId, { type: "state-update", peerId, isMuted, isCameraOff }, peerId as string);
      }
    });

    ws.on("close", async () => {
      if (!currentPeer) return;
      const { roomId, peerId, displayName, sessionId } = currentPeer;
      const room = rooms.get(roomId);
      if (room) {
        room.delete(peerId);
        if (room.size === 0) {
          rooms.delete(roomId);
        } else {
          broadcast(roomId, { type: "peer-left", peerId, displayName });
        }
      }
      if (sessionId !== undefined) {
        await recordLeave(sessionId);
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
