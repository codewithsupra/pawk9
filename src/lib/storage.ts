import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

// File storage for uploaded photos. Today it is a folder on local disk (STORAGE_DIR,
// default ./storage, which is gitignored). That is fine for development and for a single
// long-running server, but NOT for serverless hosts, whose disks are temporary: to deploy
// there, replace the three functions below with a cloud bucket (S3, R2, Vercel Blob...).
// Nothing else in the app touches files, so that is the only file that has to change.

const root = () => path.resolve(process.env.STORAGE_DIR ?? "storage");

// Keys are made by the server (e.g. "photos/<uuid>.jpg"), never taken from a user. They
// are still checked, so a bug elsewhere can't turn one into a path outside the folder.
function resolveKey(key: string) {
  if (!/^[a-z0-9][a-z0-9_/-]*\.[a-z0-9]+$/i.test(key) || key.includes("..")) {
    throw new Error("Invalid storage key");
  }
  const base = root();
  const full = path.resolve(base, key);
  if (!full.startsWith(base + path.sep)) throw new Error("Invalid storage key");
  return full;
}

/** Saves a file. Never overwrites: an existing key is an error. */
export async function putObject(key: string, bytes: Uint8Array) {
  const file = resolveKey(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes, { flag: "wx" });
}

/** The file's bytes, or null if there is no such file. */
export async function getObject(key: string) {
  try {
    return await readFile(resolveKey(key));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

/** Deletes a file. Deleting one that is already gone is fine. */
export async function deleteObject(key: string) {
  await rm(resolveKey(key), { force: true });
}
