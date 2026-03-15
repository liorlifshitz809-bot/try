import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";

const router: IRouter = Router();

// POST /api/sessions/start — called when user opens the piano lid
router.post("/sessions/start", async (req, res) => {
  const { peerId, displayName, roomId } = req.body as {
    peerId?: string; displayName?: string; roomId?: string;
  };
  if (!peerId || !displayName || !roomId) {
    res.status(400).json({ error: "peerId, displayName, and roomId are required" });
    return;
  }
  try {
    const result = await pool.query(
      `INSERT INTO sessions (peer_id, display_name, room_id, joined_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id`,
      [peerId, displayName.trim(), roomId.toLowerCase()]
    );
    res.json({ sessionId: result.rows[0].id });
  } catch (err) {
    console.error("Failed to start session:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/sessions/end — called when user closes the lid or leaves
router.post("/sessions/end", async (req, res) => {
  const { sessionId } = req.body as { sessionId?: number };
  if (!sessionId) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }
  try {
    await pool.query(
      `UPDATE sessions
       SET left_at = NOW(),
           duration_seconds = EXTRACT(EPOCH FROM (NOW() - joined_at))::INTEGER
       WHERE id = $1 AND left_at IS NULL`,
      [sessionId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to end session:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/sessions?name=<displayName>&limit=20
router.get("/sessions", async (req, res) => {
  const name = (req.query.name as string | undefined)?.trim();
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  if (!name) {
    res.status(400).json({ error: "name query parameter is required" });
    return;
  }
  try {
    const result = await pool.query(
      `SELECT id, room_id, joined_at, left_at, duration_seconds
       FROM sessions
       WHERE LOWER(display_name) = LOWER($1)
       ORDER BY joined_at DESC
       LIMIT $2`,
      [name, limit]
    );
    res.json({ sessions: result.rows });
  } catch (err) {
    console.error("Failed to fetch sessions:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/sessions/room/:roomId
router.get("/sessions/room/:roomId", async (req, res) => {
  const roomId = req.params.roomId?.toLowerCase();
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  try {
    const result = await pool.query(
      `SELECT display_name, joined_at, left_at, duration_seconds
       FROM sessions
       WHERE room_id = $1
       ORDER BY joined_at DESC
       LIMIT $2`,
      [roomId, limit]
    );
    res.json({ sessions: result.rows });
  } catch (err) {
    console.error("Failed to fetch room sessions:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
