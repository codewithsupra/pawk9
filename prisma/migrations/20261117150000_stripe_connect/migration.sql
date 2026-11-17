-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lifetimePurchasedAt" DATETIME,
    "lifetimeStripeSessionId" TEXT,
    "dailyRateCents" INTEGER,
    "stripeAccountId" TEXT,
    "stripeChargesEnabled" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_User" ("clerkId", "createdAt", "dailyRateCents", "email", "id", "lifetimePurchasedAt", "lifetimeStripeSessionId", "name", "updatedAt") SELECT "clerkId", "createdAt", "dailyRateCents", "email", "id", "lifetimePurchasedAt", "lifetimeStripeSessionId", "name", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_lifetimeStripeSessionId_key" ON "User"("lifetimeStripeSessionId");
CREATE UNIQUE INDEX "User_stripeAccountId_key" ON "User"("stripeAccountId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

