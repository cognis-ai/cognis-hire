-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "plan" AS ENUM ('free', 'pro', 'free_trial_over');

-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT,
    "image_url" TEXT,
    "allowed_responses_count" INTEGER,
    "plan" "plan",
    "cognis_org_id" TEXT,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT,
    "organization_id" TEXT,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interviewer" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agent_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "audio" TEXT,
    "empathy" INTEGER NOT NULL,
    "exploration" INTEGER NOT NULL,
    "rapport" INTEGER NOT NULL,
    "speed" INTEGER NOT NULL,

    CONSTRAINT "interviewer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT,
    "description" TEXT,
    "objective" TEXT,
    "organization_id" TEXT,
    "user_id" TEXT,
    "interviewer_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "logo_url" TEXT,
    "theme_color" TEXT,
    "url" TEXT,
    "readable_slug" TEXT,
    "questions" JSONB,
    "quotes" JSONB[],
    "insights" TEXT[],
    "respondents" TEXT[],
    "question_count" INTEGER,
    "response_count" INTEGER,
    "time_duration" TEXT,

    CONSTRAINT "interview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "response" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "interview_id" TEXT,
    "name" TEXT,
    "email" TEXT,
    "call_id" TEXT,
    "candidate_status" TEXT,
    "duration" INTEGER,
    "details" JSONB,
    "analytics" JSONB,
    "is_analysed" BOOLEAN DEFAULT false,
    "is_ended" BOOLEAN DEFAULT false,
    "is_viewed" BOOLEAN DEFAULT false,
    "tab_switch_count" INTEGER,

    CONSTRAINT "response_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "interview_id" TEXT,
    "email" TEXT,
    "feedback" TEXT,
    "satisfaction" INTEGER,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_template" (
    "id" UUID NOT NULL,
    "organization_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "description" TEXT,
    "questions" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "interview_template_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_cognis_org_id_key" ON "organization"("cognis_org_id");

-- CreateIndex
CREATE INDEX "interview_template_org_idx" ON "interview_template"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "interview_template_org_role_unique" ON "interview_template"("organization_id", "role");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview" ADD CONSTRAINT "interview_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview" ADD CONSTRAINT "interview_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview" ADD CONSTRAINT "interview_interviewer_id_fkey" FOREIGN KEY ("interviewer_id") REFERENCES "interviewer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response" ADD CONSTRAINT "response_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "interview"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "interview"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_template" ADD CONSTRAINT "interview_template_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

