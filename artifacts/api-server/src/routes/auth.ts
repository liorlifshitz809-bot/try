import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { pool } from "@workspace/db";
import {
  signToken,
  setAuthCookie,
  clearAuthCookie,
  requireAuth,
  type AuthUser,
} from "../middleware/auth.js";

const router: IRouter = Router();

// POST /api/auth/signup
router.post("/auth/signup", async (req, res) => {
  const { email, password, displayName, avatarIndex } = req.body as {
    email?: string;
    password?: string;
    displayName?: string;
    avatarIndex?: number;
  };

  if (!email || !password || !displayName) {
    res.status(400).json({ error: "email, password, and displayName are required" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }
  const emailLower = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, display_name, avatar_index)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, display_name, avatar_index, custom_avatar`,
      [emailLower, passwordHash, displayName.trim(), avatarIndex ?? 0]
    );
    const row = result.rows[0];
    const user: AuthUser = {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      avatarIndex: row.avatar_index,
    };
    const token = signToken(user);
    setAuthCookie(res, token);
    res.json({ user: { ...user, customAvatarUrl: row.custom_avatar ?? undefined } });
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ error: "An account with this email already exists" });
    } else {
      console.error("Signup error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// POST /api/auth/login
router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }
  const emailLower = email.trim().toLowerCase();

  try {
    const result = await pool.query(
      `SELECT id, email, password_hash, display_name, avatar_index, custom_avatar FROM users WHERE LOWER(email) = $1`,
      [emailLower]
    );
    if (result.rows.length === 0) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    const row = result.rows[0];
    const valid = await bcrypt.compare(password, row.password_hash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    const user: AuthUser = {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      avatarIndex: row.avatar_index,
    };
    const token = signToken(user);
    setAuthCookie(res, token);
    res.json({ user: { ...user, customAvatarUrl: row.custom_avatar ?? undefined } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/logout
router.post("/auth/logout", (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// GET /api/auth/me — return current logged-in user (queries DB for fresh custom_avatar)
router.get("/auth/me", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, display_name, avatar_index, custom_avatar FROM users WHERE id = $1`,
      [req.user!.id]
    );
    if (result.rows.length === 0) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    const row = result.rows[0];
    res.json({
      user: {
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        avatarIndex: row.avatar_index,
        customAvatarUrl: row.custom_avatar ?? undefined,
      },
    });
  } catch (err) {
    console.error("Me error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/forgot-password — generate reset token
router.post("/auth/forgot-password", async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email) {
    res.status(400).json({ error: "email is required" });
    return;
  }
  const emailLower = email.trim().toLowerCase();
  try {
    const result = await pool.query(`SELECT id FROM users WHERE LOWER(email) = $1`, [emailLower]);
    if (result.rows.length === 0) {
      // Don't reveal whether the email exists
      res.json({ ok: true, message: "If that email exists, a reset link has been generated." });
      return;
    }
    const userId = result.rows[0].id;
    const token = nanoid(32);
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await pool.query(
      `UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3`,
      [token, expires, userId]
    );
    // In production this would be emailed. For now we return the token directly.
    res.json({ ok: true, resetToken: token });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/auth/profile — update display name, avatar index, and/or custom avatar photo
router.put("/auth/profile", requireAuth, async (req, res) => {
  const { displayName, avatarIndex, customAvatarUrl } = req.body as {
    displayName?: string;
    avatarIndex?: number;
    customAvatarUrl?: string | null;
  };
  const userId = req.user!.id;

  if (displayName !== undefined && !displayName.trim()) {
    res.status(400).json({ error: "Display name cannot be empty" });
    return;
  }
  if (avatarIndex !== undefined && (avatarIndex < 0 || avatarIndex > 15)) {
    res.status(400).json({ error: "Avatar index must be 0–15" });
    return;
  }
  // Validate custom avatar: must be a data URL or null/undefined
  if (customAvatarUrl !== undefined && customAvatarUrl !== null) {
    if (!customAvatarUrl.startsWith("data:image/")) {
      res.status(400).json({ error: "customAvatarUrl must be an image data URL" });
      return;
    }
    // Roughly 400KB base64 limit (~300KB image)
    if (customAvatarUrl.length > 400_000) {
      res.status(400).json({ error: "Custom avatar image is too large" });
      return;
    }
  }

  try {
    const result = await pool.query(
      `UPDATE users
       SET display_name   = COALESCE($1, display_name),
           avatar_index   = COALESCE($2, avatar_index),
           custom_avatar  = CASE WHEN $3::boolean THEN $4 ELSE custom_avatar END
       WHERE id = $5
       RETURNING id, email, display_name, avatar_index, custom_avatar`,
      [
        displayName?.trim() ?? null,
        avatarIndex ?? null,
        customAvatarUrl !== undefined,   // whether to update custom_avatar column
        customAvatarUrl ?? null,          // the new value (null removes it)
        userId,
      ]
    );
    const row = result.rows[0];
    const updatedUser: AuthUser = {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      avatarIndex: row.avatar_index,
    };
    // Issue a fresh JWT with the (non-custom-avatar) data
    const token = signToken(updatedUser);
    setAuthCookie(res, token);
    res.json({
      user: { ...updatedUser, customAvatarUrl: row.custom_avatar ?? undefined },
    });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/reset-password — use token to set new password
router.post("/auth/reset-password", async (req, res) => {
  const { token, password } = req.body as { token?: string; password?: string };
  if (!token || !password) {
    res.status(400).json({ error: "token and password are required" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }
  try {
    const result = await pool.query(
      `SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()`,
      [token]
    );
    if (result.rows.length === 0) {
      res.status(400).json({ error: "Reset token is invalid or has expired" });
      return;
    }
    const userId = result.rows[0].id;
    const passwordHash = await bcrypt.hash(password, 12);
    await pool.query(
      `UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2`,
      [passwordHash, userId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
