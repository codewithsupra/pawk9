import type { Prisma } from "@/generated/prisma/client";

// Postgres runs transactions side by side. A "check, then create" inside a transaction
// therefore isn't safe on its own: two requests can both pass the check. Locking the row
// that owns the data makes the second one wait until the first has finished, and then it
// sees the first one's result. (SQLite ran transactions one at a time, so the code used
// to get this for free.) Call these first thing inside `prisma.$transaction`.

/** Waits for, then holds, the lock on one pet until the transaction ends. */
export async function lockPet(tx: Prisma.TransactionClient, petId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Pet" WHERE "id" = ${petId} FOR UPDATE`;
}

/** Waits for, then holds, the lock on one user until the transaction ends. */
export async function lockUser(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
}
