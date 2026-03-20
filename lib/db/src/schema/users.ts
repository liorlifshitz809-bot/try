import { pgTable, text, serial, integer, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const usersTable = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    avatarIndex: integer("avatar_index").notNull().default(0),
    customAvatar: text("custom_avatar"),
    resetToken: text("reset_token"),
    resetTokenExpires: timestamp("reset_token_expires", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("users_email_unique").on(t.email),
    index("users_email_lower_idx").on(sql`lower(${t.email})`),
    index("users_reset_token_idx").on(t.resetToken),
  ],
);

