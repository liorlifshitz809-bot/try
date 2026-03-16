import { createServer } from "http";
import { WebSocketServer } from "ws";
import app from "./app";
import { setupSignaling } from "./signaling";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS friendships (
      id SERIAL PRIMARY KEY,
      requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK (status IN ('pending','accepted','rejected')) DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(requester_id, addressee_id)
    );
    CREATE TABLE IF NOT EXISTS room_invitations (
      id SERIAL PRIMARY KEY,
      from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      room_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL,
      seen BOOLEAN NOT NULL DEFAULT false
    );
    CREATE INDEX IF NOT EXISTS friendships_requester_idx ON friendships(requester_id);
    CREATE INDEX IF NOT EXISTS friendships_addressee_idx ON friendships(addressee_id);
    CREATE INDEX IF NOT EXISTS room_invitations_to_user_idx ON room_invitations(to_user_id);
  `);
}

const httpServer = createServer(app);

const wss = new WebSocketServer({ server: httpServer, path: "/api/ws" });
setupSignaling(wss);

ensureTables()
  .then(() => console.log("Friend system tables ensured"))
  .catch((err) => console.error("Failed to ensure friend tables:", err));

httpServer.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
