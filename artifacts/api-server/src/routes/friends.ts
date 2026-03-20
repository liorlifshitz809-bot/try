import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../middleware/auth.js";
import { getOnlineUserRooms } from "../signaling.js";

interface UserRow {
  id: number;
  display_name: string;
  avatar_index: number;
  custom_avatar: string | null;
}

interface FriendshipRow {
  requester_id: number;
  addressee_id: number;
  status: string;
  id: number;
}

interface RequestRow extends UserRow {
  created_at: string;
}

interface InvitationRow {
  id: number;
  room_id: string;
  created_at: string;
  expires_at: string;
  display_name: string;
  avatar_index: number;
  custom_avatar: string | null;
}

interface CountRow {
  c: string;
}

const router: IRouter = Router();

router.get("/users/search", requireAuth, async (req, res) => {
  const q = (req.query.q as string || "").trim();
  if (!q) {
    res.json({ users: [] });
    return;
  }
  try {
    const result = await pool.query<UserRow>(
      `SELECT id, display_name, avatar_index, custom_avatar
       FROM users
       WHERE id != $1 AND display_name ILIKE $2
       ORDER BY display_name
       LIMIT 10`,
      [req.user!.id, `%${q}%`]
    );

    const myId = req.user!.id;
    const friendshipRows = await pool.query<FriendshipRow>(
      `SELECT requester_id, addressee_id, status FROM friendships
       WHERE (requester_id = $1 OR addressee_id = $1)
         AND status IN ('pending', 'accepted')`,
      [myId]
    );

    const friendshipMap = new Map<number, string>();
    for (const f of friendshipRows.rows) {
      const otherId = f.requester_id === myId ? f.addressee_id : f.requester_id;
      if (f.status === "accepted") {
        friendshipMap.set(otherId, "friends");
      } else if (f.requester_id === myId) {
        friendshipMap.set(otherId, "request_sent");
      } else {
        friendshipMap.set(otherId, "request_received");
      }
    }

    const users = result.rows.map((r) => ({
      id: r.id,
      displayName: r.display_name,
      avatarIndex: r.avatar_index,
      customAvatarUrl: r.custom_avatar ?? undefined,
      friendshipStatus: friendshipMap.get(r.id) ?? null,
    }));
    res.json({ users });
  } catch (err) {
    console.error("User search error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/friends/request", requireAuth, async (req, res) => {
  const { addresseeId } = req.body as { addresseeId?: number };
  const myId = req.user!.id;

  if (!addresseeId || addresseeId === myId) {
    res.status(400).json({ error: "Invalid addressee" });
    return;
  }

  try {
    const existing = await pool.query<FriendshipRow>(
      `SELECT id, status FROM friendships
       WHERE (requester_id = $1 AND addressee_id = $2)
          OR (requester_id = $2 AND addressee_id = $1)`,
      [myId, addresseeId]
    );
    if (existing.rows.length > 0) {
      const s = existing.rows[0].status;
      if (s === "accepted") {
        res.status(409).json({ error: "Already friends" });
        return;
      }
      if (s === "pending") {
        res.status(409).json({ error: "Friend request already pending" });
        return;
      }
      if (s === "rejected") {
        await pool.query(
          `UPDATE friendships SET status = 'pending', requester_id = $1, addressee_id = $2, created_at = now() WHERE id = $3`,
          [myId, addresseeId, existing.rows[0].id]
        );
        res.json({ ok: true });
        return;
      }
    }

    await pool.query(
      `INSERT INTO friendships (requester_id, addressee_id, status) VALUES ($1, $2, 'pending')`,
      [myId, addresseeId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("Friend request error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/friends/respond", requireAuth, async (req, res) => {
  const { requesterId, action } = req.body as { requesterId?: number; action?: string };
  const myId = req.user!.id;

  if (!requesterId || !["accept", "reject"].includes(action || "")) {
    res.status(400).json({ error: "requesterId and action (accept/reject) required" });
    return;
  }

  try {
    const result = await pool.query(
      `UPDATE friendships SET status = $1
       WHERE requester_id = $2 AND addressee_id = $3 AND status = 'pending'
       RETURNING id`,
      [action === "accept" ? "accepted" : "rejected", requesterId, myId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: "No pending request found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Friend respond error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/friends", requireAuth, async (req, res) => {
  const myId = req.user!.id;
  try {
    const result = await pool.query<UserRow>(
      `SELECT u.id, u.display_name, u.avatar_index, u.custom_avatar
       FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
       WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status = 'accepted'
       ORDER BY u.display_name`,
      [myId]
    );

    const onlineMap = getOnlineUserRooms();

    const friends = result.rows.map((r) => ({
      id: r.id,
      displayName: r.display_name,
      avatarIndex: r.avatar_index,
      customAvatarUrl: r.custom_avatar ?? undefined,
      online: onlineMap.has(r.id),
      roomId: onlineMap.get(r.id) ?? null,
    }));
    res.json({ friends });
  } catch (err) {
    console.error("Friends list error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/friends/requests", requireAuth, async (req, res) => {
  const myId = req.user!.id;
  try {
    const result = await pool.query<RequestRow>(
      `SELECT u.id, u.display_name, u.avatar_index, u.custom_avatar, f.created_at
       FROM friendships f
       JOIN users u ON u.id = f.requester_id
       WHERE f.addressee_id = $1 AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [myId]
    );
    const requests = result.rows.map((r) => ({
      id: r.id,
      displayName: r.display_name,
      avatarIndex: r.avatar_index,
      customAvatarUrl: r.custom_avatar ?? undefined,
      createdAt: r.created_at,
    }));
    res.json({ requests });
  } catch (err) {
    console.error("Friend requests error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/friends/invite", requireAuth, async (req, res) => {
  const { toUserId, roomId } = req.body as { toUserId?: number; roomId?: string };
  const myId = req.user!.id;

  if (!toUserId || !roomId) {
    res.status(400).json({ error: "toUserId and roomId required" });
    return;
  }

  try {
    const friendship = await pool.query(
      `SELECT id FROM friendships
       WHERE ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))
         AND status = 'accepted'`,
      [myId, toUserId]
    );
    if (friendship.rows.length === 0) {
      res.status(403).json({ error: "You can only invite friends" });
      return;
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await pool.query(
      `INSERT INTO room_invitations (from_user_id, to_user_id, room_id, expires_at) VALUES ($1, $2, $3, $4)`,
      [myId, toUserId, roomId, expiresAt]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("Friend invite error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/friends/invitations", requireAuth, async (req, res) => {
  const myId = req.user!.id;
  try {
    const result = await pool.query<InvitationRow>(
      `SELECT ri.id, ri.room_id, ri.created_at, ri.expires_at, u.display_name, u.avatar_index, u.custom_avatar
       FROM room_invitations ri
       JOIN users u ON u.id = ri.from_user_id
       WHERE ri.to_user_id = $1 AND ri.seen = false AND ri.expires_at > NOW()
       ORDER BY ri.created_at DESC`,
      [myId]
    );
    const invitations = result.rows.map((r) => ({
      id: r.id,
      roomId: r.room_id,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      fromDisplayName: r.display_name,
      fromAvatarIndex: r.avatar_index,
      fromCustomAvatarUrl: r.custom_avatar ?? undefined,
    }));
    res.json({ invitations });
  } catch (err) {
    console.error("Friend invitations error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/friends/invitations/:id/seen", requireAuth, async (req, res) => {
  const invId = parseInt(String(req.params.id), 10);
  const myId = req.user!.id;
  if (isNaN(invId)) {
    res.status(400).json({ error: "Invalid invitation id" });
    return;
  }
  try {
    await pool.query(
      `UPDATE room_invitations SET seen = true WHERE id = $1 AND to_user_id = $2`,
      [invId, myId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("Mark invitation seen error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/friends/badge-count", requireAuth, async (req, res) => {
  const myId = req.user!.id;
  try {
    const reqCount = await pool.query<CountRow>(
      `SELECT COUNT(*) as c FROM friendships WHERE addressee_id = $1 AND status = 'pending'`,
      [myId]
    );
    const invCount = await pool.query<CountRow>(
      `SELECT COUNT(*) as c FROM room_invitations WHERE to_user_id = $1 AND seen = false AND expires_at > NOW()`,
      [myId]
    );
    const total = parseInt(reqCount.rows[0].c) + parseInt(invCount.rows[0].c);
    res.json({ count: total });
  } catch (err) {
    console.error("Badge count error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
