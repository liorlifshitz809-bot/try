import { Router, type IRouter } from "express";
import { CreateRoomBody, GetRoomParams, GetRoomResponse } from "@workspace/api-zod";
import { getRoomParticipantCount, roomExists } from "../signaling";
import { nanoid } from "nanoid";

const router: IRouter = Router();

router.post("/rooms", (req, res) => {
  const parsed = CreateRoomBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const roomId = nanoid(8);
  const room: { roomId: string; createdAt: string; participantCount: number } = {
    roomId,
    createdAt: new Date().toISOString(),
    participantCount: 0,
  };
  res.status(201).json(room);
});

router.get("/rooms/:roomId", (req, res) => {
  const params = GetRoomParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid room ID" });
    return;
  }
  const { roomId } = params.data;

  const count = getRoomParticipantCount(roomId);
  const data = GetRoomResponse.safeParse({
    roomId,
    createdAt: new Date().toISOString(),
    participantCount: count,
  });

  if (!data.success) {
    res.status(500).json({ error: "Internal error" });
    return;
  }

  res.json(data.data);
});

export default router;
