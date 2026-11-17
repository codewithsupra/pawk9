import { del, get, put } from "@vercel/blob";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

// File storage for uploaded photos, with two backends behind the same three functions
// (nothing else in the app touches files):
//
// - Vercel Blob (private) when BLOB_READ_WRITE_TOKEN is set. This is what production
//   uses: serverless disks are temporary, so files must live in a bucket.
// - A folder on local disk (STORAGE_DIR, default ./storage, gitignored) otherwise, for
//   development only. Production refuses to use it.

function usingBlob() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return true;
  if (process.env.NODE_ENV === "production") {
    // Better to fail loudly than to quietly write photos to a disk that is wiped.
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is not set: photos need Vercel Blob in production",
    );
  }
  return false;
}

// Keys are made by the server (e.g. "photos/<uuid>.jpg"), never taken from a user. They
// are still checked, so a bug elsewhere can't turn one into a path outside the folder (or
// an odd name in the bucket).
function checkKey(key: string) {
  if (!/^[a-z0-9][a-z0-9_/-]*\.[a-z0-9]+$/i.test(key) || key.includes("..")) {
    throw new Error("Invalid storage key");
  }
}

// turbopackIgnore: the folder is only a development fallback, and without this the build
// warns that the whole project would be bundled to follow a dynamic path.
const root = () =>
  path.resolve(
    /* turbopackIgnore: true */ process.env.STORAGE_DIR ?? "storage",
  );

function resolveKey(key: string) {
  checkKey(key);
  const base = root();
  const full = path.resolve(base, key);
  if (!full.startsWith(base + path.sep)) throw new Error("Invalid storage key");
  return full;
}

/** Saves a file. Never overwrites: an existing key is an error. */
export async function putObject(key: string, bytes: Uint8Array) {
  if (usingBlob()) {
    checkKey(key);
    await put(key, Buffer.from(bytes), {
      access: "private",
      // The key is already unique, and the file must never change once saved.
      addRandomSuffix: false,
      allowOverwrite: false,
    });
    return;
  }
  const file = resolveKey(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes, { flag: "wx" });
}

/** The file's bytes, or null if there is no such file. */
export async function getObject(key: string) {
  if (usingBlob()) {
    checkKey(key);
    const result = await get(key, { access: "private" });
    if (!result || result.statusCode !== 200) return null;
    return Buffer.from(await new Response(result.stream).arrayBuffer());
  }
  try {
    return await readFile(resolveKey(key));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

/** Deletes a file. Deleting one that is already gone is fine. */
export async function deleteObject(key: string) {
  if (usingBlob()) {
    checkKey(key);
    await del(key);
    return;
  }
  await rm(resolveKey(key), { force: true });
}
