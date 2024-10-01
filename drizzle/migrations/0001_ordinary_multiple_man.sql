ALTER TABLE "users" RENAME TO "credentials";--> statement-breakpoint
ALTER TABLE "credentials" DROP CONSTRAINT "users_user_id_unique";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_credentials_id_users_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_credentials_id_credentials_id_fk" FOREIGN KEY ("credentials_id") REFERENCES "public"."credentials"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_user_id_unique" UNIQUE("user_id");