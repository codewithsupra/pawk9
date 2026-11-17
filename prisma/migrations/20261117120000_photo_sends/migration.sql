-- CreateTable
CREATE TABLE "PhotoSend" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "photoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "petId" TEXT,
    CONSTRAINT "PhotoSend_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PhotoSend_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PhotoSend_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PhotoSend_photoId_createdAt_idx" ON "PhotoSend"("photoId", "createdAt");

-- CreateIndex
CREATE INDEX "PhotoSend_userId_createdAt_idx" ON "PhotoSend"("userId", "createdAt");

