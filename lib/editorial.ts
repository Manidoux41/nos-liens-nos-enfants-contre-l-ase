export const MAX_MEDIA_BYTES = 4 * 1024 * 1024;

export function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function validSlug(value: string, max: number) {
  return value.length >= 2 && value.length <= max && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function validText(value: string, min: number, max: number) {
  return value.trim().length >= min && value.length <= max && !/[\u0000-\u0008\u000b-\u001f\u007f]/.test(value);
}

export function detectMedia(bytes: Uint8Array): { mimeType: string; extension: string } | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mimeType: "image/jpeg", extension: "jpg" };
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)) return { mimeType: "image/png", extension: "png" };
  const start = new TextDecoder("ascii").decode(bytes.slice(0, 12));
  if (start.startsWith("RIFF") && start.slice(8) === "WEBP") return { mimeType: "image/webp", extension: "webp" };
  if (start.startsWith("%PDF-")) return { mimeType: "application/pdf", extension: "pdf" };
  return null;
}
