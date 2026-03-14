import { createServer } from "http";
import { WebSocketServer } from "ws";
import app from "./app";
import { setupSignaling } from "./signaling";

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

const httpServer = createServer(app);

const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
setupSignaling(wss);

httpServer.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
