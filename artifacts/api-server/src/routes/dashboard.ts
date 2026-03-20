import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../middleware/auth.js";

const router: IRouter = Router();

// GET /api/dashboard/sessions — all sessions for authenticated user
// ?date=YYYY-MM-DD filters to a specific day; default is today
router.get("/dashboard/sessions", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const dateParam = req.query.date as string | undefined;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const perPage = 50;
  const offset = (page - 1) * perPage;

  try {
    let rows;
    if (dateParam) {
      const r = await pool.query(
        `SELECT id, room_id, joined_at, left_at, duration_seconds, notes, session_date, is_manual
         FROM sessions
         WHERE user_id = $1 AND session_date = $2::date
         ORDER BY joined_at DESC
         LIMIT $3 OFFSET $4`,
        [userId, dateParam, perPage, offset]
      );
      rows = r.rows;
    } else {
      const r = await pool.query(
        `SELECT id, room_id, joined_at, left_at, duration_seconds, notes, session_date, is_manual
         FROM sessions
         WHERE user_id = $1
         ORDER BY joined_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, perPage, offset]
      );
      rows = r.rows;
    }

    // Summary stats per day
    const stats = await pool.query(
      `SELECT
         session_date,
         COUNT(*) AS session_count,
         SUM(duration_seconds) AS total_seconds
       FROM sessions
       WHERE user_id = $1
       GROUP BY session_date
       ORDER BY session_date DESC`,
      [userId]
    );

    res.json({ sessions: rows, dailyStats: stats.rows });
  } catch (err) {
    console.error("Dashboard sessions error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/dashboard/sessions — manually add a practice session
router.post("/dashboard/sessions", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const { roomId, durationSeconds, notes, sessionDate } = req.body as {
    roomId?: string;
    durationSeconds?: number;
    notes?: string;
    sessionDate?: string;
  };

  if (!durationSeconds || durationSeconds < 1) {
    res.status(400).json({ error: "durationSeconds must be a positive number" });
    return;
  }
  if (durationSeconds < 60) {
    res.status(400).json({ error: "Sessions under 1 minute are not recorded" });
    return;
  }

  const date = sessionDate || new Date().toISOString().split("T")[0];

  try {
    const result = await pool.query(
      `INSERT INTO sessions
         (peer_id, display_name, room_id, joined_at, left_at, duration_seconds, user_id, notes, session_date, is_manual)
       VALUES
         ('manual', $1, $2, NOW() - ($3 * interval '1 second'), NOW(), $3, $4, $5, $6::date, TRUE)
       RETURNING id, room_id, joined_at, left_at, duration_seconds, notes, session_date`,
      [
        req.user!.displayName,
        (roomId || "manual").toLowerCase(),
        durationSeconds,
        userId,
        notes?.trim() || null,
        date,
      ]
    );
    res.json({ session: result.rows[0] });
  } catch (err) {
    console.error("Add manual session error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/dashboard/sessions/:id
router.delete("/dashboard/sessions/:id", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const sessionId = parseInt(String(req.params.id), 10);
  if (!sessionId) {
    res.status(400).json({ error: "Invalid session id" });
    return;
  }
  try {
    const result = await pool.query(
      `DELETE FROM sessions WHERE id = $1 AND user_id = $2 RETURNING id`,
      [sessionId, userId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Session not found or not yours" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Delete session error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/dashboard/summary — quick stats for the header
router.get("/dashboard/summary", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  try {
    const today = new Date().toISOString().split("T")[0];
    const todayStats = await pool.query(
      `SELECT COUNT(*) AS count, COALESCE(SUM(duration_seconds), 0) AS seconds
       FROM sessions WHERE user_id = $1 AND session_date = $2::date`,
      [userId, today]
    );
    const allTime = await pool.query(
      `SELECT COUNT(*) AS count, COALESCE(SUM(duration_seconds), 0) AS seconds
       FROM sessions WHERE user_id = $1`,
      [userId]
    );
    const streak = await pool.query(
      `WITH days AS (
         SELECT DISTINCT session_date FROM sessions WHERE user_id = $1 ORDER BY session_date DESC
       ),
       numbered AS (
         SELECT session_date, ROW_NUMBER() OVER (ORDER BY session_date DESC) AS rn FROM days
       )
       SELECT COUNT(*) AS streak
       FROM numbered
       WHERE session_date = (CURRENT_DATE - (rn - 1) * INTERVAL '1 day')::date`,
      [userId]
    );
    res.json({
      today: todayStats.rows[0],
      allTime: allTime.rows[0],
      streak: parseInt(streak.rows[0]?.streak || "0"),
    });
  } catch (err) {
    console.error("Dashboard summary error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
