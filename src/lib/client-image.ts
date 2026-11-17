// Browser-only: prepares a photo for upload.

/**
 * Shrinks a photo and re-encodes it as JPEG. Phone photos are several megabytes, which is
 * slow to upload and over the server's size limit, and 1600px is plenty to look at.
 *
 * Re-encoding through a canvas also drops the file's metadata (EXIF), which can contain
 * the GPS position the photo was taken at. The server cannot rely on this, since anyone
 * can call it directly, but for photos taken in the app it means location never leaves
 * the browser.
 *
 * Throws if the browser can't decode the file (e.g. HEIC outside Safari).
 */
export async function prepareImageForUpload(
  file: File,
  maxEdge = 1600,
  quality = 0.85,
): Promise<Blob> {
  // "from-image" applies the camera's rotation, so the result isn't sideways.
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not available");

    // JPEG has no transparency; without this a transparent PNG would turn black.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) throw new Error("Could not encode the image");
    return blob;
  } finally {
    bitmap.close();
  }
}
