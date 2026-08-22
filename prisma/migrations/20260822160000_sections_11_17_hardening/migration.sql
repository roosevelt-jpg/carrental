ALTER TABLE "Customer" ADD COLUMN "whatsappIdHash" TEXT;
CREATE UNIQUE INDEX "Customer_whatsappIdHash_key" ON "Customer"("whatsappIdHash");
ALTER TABLE "Conversation" ADD COLUMN "misunderstandingCount" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "IntegrationTestResult" (
  "provider" TEXT NOT NULL,
  "ok" BOOLEAN NOT NULL,
  "detail" TEXT NOT NULL,
  "testedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntegrationTestResult_pkey" PRIMARY KEY ("provider")
);
