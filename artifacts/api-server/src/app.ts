import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { existsSync } from "fs";
import router from "./routes";

const app: Express = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '500kb' }));
app.use(express.urlencoded({ extended: true, limit: '500kb' }));
app.use(cookieParser());

app.use("/api", router);

const webDistDir =
  process.env.WEB_DIST_DIR ||
  path.resolve(process.cwd(), "..", "piano-conservatory", "dist", "public");

if (existsSync(webDistDir)) {
  app.use(express.static(webDistDir));
  app.get(/^\/(?!api(?:\/|$)).*/, (_req, res) => {
    res.sendFile(path.join(webDistDir, "index.html"));
  });
}

export default app;
