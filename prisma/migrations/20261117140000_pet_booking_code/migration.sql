-- AlterTable
ALTER TABLE "Pet" ADD COLUMN "bookingCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Pet_bookingCode_key" ON "Pet"("bookingCode");

