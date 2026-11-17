-- CreateTable
CREATE TABLE "Stay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "checkedInAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedOutAt" DATETIME,
    "petId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Stay_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Stay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Stay_petId_checkedInAt_idx" ON "Stay"("petId", "checkedInAt");

-- CreateIndex
CREATE INDEX "Stay_userId_checkedOutAt_idx" ON "Stay"("userId", "checkedOutAt");

