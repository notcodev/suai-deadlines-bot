CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"suai_username" varchar(32) NOT NULL,
	"suai_password" varchar(64) NOT NULL,
	"user_id" varchar(16) NOT NULL,
	CONSTRAINT "users_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"credentials_id" serial NOT NULL,
	"chat_id" varchar(16) NOT NULL,
	"next_notify_at" timestamp NOT NULL,
	"last_notified_at" timestamp,
	CONSTRAINT "subscriptions_chat_id_unique" UNIQUE("chat_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_credentials_id_users_id_fk" FOREIGN KEY ("credentials_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
