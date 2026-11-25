CREATE SCHEMA "jobflow_collection";--> statement-breakpoint
CREATE TYPE "jobflow_collection"."status" AS ENUM('running', 'success', 'partial', 'failed');--> statement-breakpoint
CREATE TABLE "jobflow_collection"."attempt" (
	"day" date NOT NULL,
	"attempt" integer NOT NULL,
	"trigger" text NOT NULL,
	"status" "jobflow_collection"."status" NOT NULL,
	"started_at" timestamp (3) with time zone NOT NULL,
	"finished_at" timestamp (3) with time zone,
	"error" text,
	CONSTRAINT "attempt_day_attempt_pk" PRIMARY KEY("day","attempt"),
	CONSTRAINT "collection_trigger" CHECK ("jobflow_collection"."attempt"."trigger" in ('schedule', 'manual'))
);
--> statement-breakpoint
CREATE TABLE "jobflow_collection"."board_result" (
	"day" date NOT NULL,
	"attempt" integer NOT NULL,
	"board" text NOT NULL,
	"status" "jobflow_collection"."status" NOT NULL,
	"added" integer DEFAULT 0 NOT NULL,
	"revised" integer DEFAULT 0 NOT NULL,
	"matched" integer DEFAULT 0 NOT NULL,
	"http_attempts" integer NOT NULL,
	"error" text,
	CONSTRAINT "board_result_day_attempt_board_pk" PRIMARY KEY("day","attempt","board")
);
--> statement-breakpoint
CREATE TABLE "jobflow_collection"."run" (
	"day" date PRIMARY KEY NOT NULL,
	"attempt" integer NOT NULL,
	"status" "jobflow_collection"."status" NOT NULL,
	"started_at" timestamp (3) with time zone NOT NULL,
	"finished_at" timestamp (3) with time zone,
	"lease_until" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobflow_collection"."job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"board" text NOT NULL,
	"external_id" text NOT NULL,
	"revision" integer NOT NULL,
	"first_seen_at" timestamp (3) with time zone NOT NULL,
	"last_seen_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "job_provider_board_external_id_unique" UNIQUE("provider","board","external_id")
);
--> statement-breakpoint
CREATE TABLE "jobflow_collection"."job_snapshot" (
	"job_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"digest" text NOT NULL,
	"title" text NOT NULL,
	"company" text NOT NULL,
	"location" text NOT NULL,
	"url" text NOT NULL,
	"jd" text NOT NULL,
	"priority" integer NOT NULL,
	"captured_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "job_snapshot_job_id_revision_pk" PRIMARY KEY("job_id","revision")
);
--> statement-breakpoint
CREATE TABLE "auth_rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "auth_rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "jobflow_collection"."attempt" ADD CONSTRAINT "attempt_day_run_day_fk" FOREIGN KEY ("day") REFERENCES "jobflow_collection"."run"("day") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobflow_collection"."board_result" ADD CONSTRAINT "board_result_day_attempt_attempt_day_attempt_fk" FOREIGN KEY ("day","attempt") REFERENCES "jobflow_collection"."attempt"("day","attempt") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobflow_collection"."job_snapshot" ADD CONSTRAINT "job_snapshot_job_id_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "jobflow_collection"."job"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE FUNCTION "jobflow_collection"."preserve_snapshot"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'JD snapshots are append-only';
END;
$$;--> statement-breakpoint
CREATE TRIGGER "job_snapshot_append_only"
BEFORE UPDATE OR DELETE ON "jobflow_collection"."job_snapshot"
FOR EACH ROW EXECUTE FUNCTION "jobflow_collection"."preserve_snapshot"();
