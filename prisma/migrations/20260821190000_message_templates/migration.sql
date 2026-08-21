-- CreateEnum
CREATE TYPE "MessageTemplatePurpose" AS ENUM ('BOOKING_CONFIRMATION', 'PAYMENT_REMINDER', 'REENGAGEMENT');

-- CreateEnum
CREATE TYPE "MessageTemplateStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" "MessageTemplatePurpose" NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "status" "MessageTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "metaTemplateName" TEXT,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_name_key" ON "MessageTemplate"("name");
