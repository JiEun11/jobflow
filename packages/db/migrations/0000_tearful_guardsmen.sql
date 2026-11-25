CREATE TABLE "auth_account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp (3) with time zone,
	"refresh_token_expires_at" timestamp (3) with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "owner" (
	"slot" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "owner_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "owner_singleton" CHECK ("owner"."slot" = 1)
);
--> statement-breakpoint
CREATE TABLE "profile_version" (
	"owner_id" text NOT NULL,
	"revision" integer NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"restored_from" integer,
	"personal" jsonb NOT NULL,
	"experiences" jsonb NOT NULL,
	"skills" jsonb NOT NULL,
	"projects" jsonb NOT NULL,
	"education" jsonb NOT NULL,
	"preferences" jsonb NOT NULL,
	CONSTRAINT "profile_version_owner_id_revision_pk" PRIMARY KEY("owner_id","revision"),
	CONSTRAINT "profile_positive_revision" CHECK ("profile_version"."revision" > 0),
	CONSTRAINT "profile_prior_restore" CHECK ("profile_version"."restored_from" > 0 AND "profile_version"."restored_from" < "profile_version"."revision")
);
--> statement-breakpoint
CREATE FUNCTION "prevent_profile_history_changes"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Profile versions are append-only.';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "profile_history_append_only"
BEFORE UPDATE OR DELETE ON "profile_version"
FOR EACH ROW EXECUTE FUNCTION "prevent_profile_history_changes"();
--> statement-breakpoint
CREATE TABLE "resume" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"filename" text NOT NULL,
	"byte_size" integer NOT NULL,
	"digest" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"deletion_requested_at" timestamp (3) with time zone,
	CONSTRAINT "resume_size" CHECK ("resume"."byte_size" > 0 AND "resume"."byte_size" <= 5242880)
);
--> statement-breakpoint
CREATE TABLE "auth_session" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "auth_session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth_user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth_verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_account" ADD CONSTRAINT "auth_account_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner" ADD CONSTRAINT "owner_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_version" ADD CONSTRAINT "profile_version_owner_id_owner_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume" ADD CONSTRAINT "resume_owner_id_owner_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_session" ADD CONSTRAINT "auth_session_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;