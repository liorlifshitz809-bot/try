import { pgTable, serial, integer, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const roomInvitationsTable = pgTable(
  "room_invitations",
  {
    id: serial("id").primaryKey(),
    fromUserId: integer("from_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    toUserId: integer("to_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    roomId: text("room_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    seen: boolean("seen").notNull().default(false),
  },
  (t) => [index("room_invitations_to_user_idx").on(t.toUserId)],
);

