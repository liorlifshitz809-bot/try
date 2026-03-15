import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";

const router: IRouter = Router();

// GET /sessions?name=<displayName>&limit=20
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

// GET /sessions/room/:roomId — recent visitors to a room
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
