// Shrink a camera photo before it goes anywhere.
//
// A phone camera JPEG is several megabytes. At the back of a store that's a
// minute of upload on a weak link, and every other family member pays the same
// bytes again on the way down. Nothing in this app ever displays a photo larger
// than a phone screen, so the full-resolution original is pure cost — in upload
// time, in the offline photo queue, and in how many photos the service worker's
// image cache can hold.
//
// Runs entirely in the browser: decode, draw to a canvas at a smaller size,
// re-encode as JPEG. Anything that goes wrong falls back to the original file,
// because a big photo is much better than no photo.

/** Longest edge, in pixels. Comfortably above any phone screen. */
export const MAX_EDGE = 1600;
export const JPEG_QUALITY = 0.8;

// Below this, re-encoding costs quality and saves little.
const SKIP_BELOW_BYTES = 300 * 1024;

export type PreparedPhoto = {
  blob: Blob;
  /** Name to derive the storage path's extension from. */
  fileName: string;
  contentType: string;
};

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const original: PreparedPhoto = {
    blob: file,
    fileName: file.name,
    contentType: file.type || "application/octet-stream",
  };

  if (file.size <= SKIP_BELOW_BYTES) return original;
  if (typeof document === "undefined") return original;

  let source: ImageBitmap | HTMLImageElement | null = null;
  try {
    source = await decode(file);
    const [w, h] =
      source instanceof HTMLImageElement
        ? [source.naturalWidth, source.naturalHeight]
        : [source.width, source.height];
    if (!w || !h) return original;

    const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));

    const ctx = canvas.getContext("2d");
    if (!ctx) return original;
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );

    // If re-encoding didn't actually win, keep what the camera gave us.
    if (!blob || blob.size >= file.size) return original;

    return { blob, fileName: "photo.jpg", contentType: "image/jpeg" };
  } catch {
    return original;
  } finally {
    if (source && !(source instanceof HTMLImageElement)) source.close();
  }
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      // `from-image` applies the EXIF rotation, which a canvas draw otherwise
      // ignores — without it, portrait phone shots come out sideways.
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      try {
        return await createImageBitmap(file);
      } catch {
        // fall through to the <img> path (older Safari, odd formats)
      }
    }
  }
  return decodeViaImgElement(file);
}

function decodeViaImgElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("could not decode image"));
    };
    img.src = url;
  });
}
