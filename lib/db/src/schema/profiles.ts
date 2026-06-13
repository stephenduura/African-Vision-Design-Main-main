// @ts-nocheck
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { memberTypeEnum } from "./community";

export const profilesTable = pgTable("profiles", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  memberType: memberTypeEnum("member_type").notNull().default("individual"),
  role: text("role").notNull().default("member"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
