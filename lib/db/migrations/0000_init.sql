CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"request" text NOT NULL,
	"repo" text,
	"amplify_app_id" text,
	"prod_url" text,
	"status" text DEFAULT 'spec' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "projects_name_key" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"model" text DEFAULT 'auto' NOT NULL,
	"kiro_payer" text NOT NULL,
	"commit" text,
	"codebuild_id" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"credits" double precision,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"state" text DEFAULT 'todo' NOT NULL,
	CONSTRAINT "tasks_project_number_key" UNIQUE("project_id","number")
);
--> statement-breakpoint
CREATE TABLE "deploys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"branch" text NOT NULL,
	"commit" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repairs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deploy_id" uuid,
	"run_id" uuid,
	"attempt" integer NOT NULL,
	"cause" text,
	"branch" text NOT NULL,
	"check_status" text DEFAULT 'pending' NOT NULL,
	"outcome" text DEFAULT 'running' NOT NULL,
	"recovered_s" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "previews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"branch" text NOT NULL,
	"db_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "costs" (
	"project_id" uuid NOT NULL,
	"day" date NOT NULL,
	"usage_usd" numeric(12, 4) DEFAULT '0' NOT NULL,
	"credit_usd" numeric(12, 4) DEFAULT '0' NOT NULL,
	CONSTRAINT "costs_project_id_day_pk" PRIMARY KEY("project_id","day")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_policies" (
	"user_id" text PRIMARY KEY NOT NULL,
	"sql_allowed" boolean
);
--> statement-breakpoint
CREATE TABLE "audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"detail" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deploys" ADD CONSTRAINT "deploys_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repairs" ADD CONSTRAINT "repairs_deploy_id_deploys_id_fk" FOREIGN KEY ("deploy_id") REFERENCES "public"."deploys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repairs" ADD CONSTRAINT "repairs_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "previews" ADD CONSTRAINT "previews_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "costs" ADD CONSTRAINT "costs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projects_owner_idx" ON "projects" USING btree ("owner");--> statement-breakpoint
CREATE INDEX "runs_project_idx" ON "runs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "deploys_project_idx" ON "deploys" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "previews_project_idx" ON "previews" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "audit_at_idx" ON "audit" USING btree ("at");
