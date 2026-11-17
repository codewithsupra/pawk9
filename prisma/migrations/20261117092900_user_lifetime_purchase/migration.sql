-- AlterTable
ALTER TABLE "User" ADD COLUMN "lifetimePurchasedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "lifetimeStripeSessionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_lifetimeStripeSessionId_key" ON "User"("lifetimeStripeSessionId");

