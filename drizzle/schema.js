import { pgTable, varchar, serial, timestamp } from "drizzle-orm/pg-core";

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  credentialsId: serial("credentials_id").references(() => credentials.id, {
    onDelete: "cascade",
  }),
  displayName: varchar("name", { length: 32 }).notNull(),
  chatId: varchar("chat_id", { length: 16 }).notNull().unique(),
  nextNotifyAt: timestamp("next_notify_at").notNull(),
  lastNotifiedAt: timestamp("last_notified_at"),
});

export const credentials = pgTable("credentials", {
  id: serial("id").primaryKey(),
  suaiUsername: varchar("suai_username", { length: 32 }).notNull(),
  suaiPassword: varchar("suai_password", { length: 64 }).notNull(),
  userId: varchar("user_id", { length: 16 }).notNull().unique(),
});
