import ImageKit from "@imagekit/nodejs";

// ─── Client Init ─────────────────────────────────────────────────────────────

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT, // e.g. https://ik.imagekit.io/your_id
});

// ─── Config Guard ─────────────────────────────────────────────────────────────

export function hasImageKitConfig() {
  return Boolean(
    process.env.IMAGEKIT_PUBLIC_KEY &&
    process.env.IMAGEKIT_PRIVATE_KEY &&
    process.env.IMAGEKIT_URL_ENDPOINT
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeFileName(originalName = "upload") {
  const ext = originalName.includes(".")
    ? "." + originalName.split(".").pop().toLowerCase()
    : "";
  const base = originalName
    .replace(/\.[^/.]+$/, "")       
    .replace(/[^a-zA-Z0-9_-]/g, "_") 
    .slice(0, 60);                  

  return `${Date.now()}_${base}${ext}`;
}

function getFolderByMimeType(mimetype = "") {
  if (mimetype.startsWith("image/")) return "/chat-media/images";
  if (mimetype.startsWith("video/")) return "/chat-media/videos";
  if (mimetype.startsWith("audio/")) return "/chat-media/audio";
  return "/chat-media/files";
}

// ─── Upload ───────────────────────────────────────────────────────────────────

/**
 * Chat এর জন্য যেকোনো ফাইল upload করে।
 */
export async function uploadChatMedia(file, options = {}) {
  if (!hasImageKitConfig()) {
    throw new Error("[ImageKit] Missing required environment variables");
  }

  if (!file?.buffer) {
    throw new Error("[ImageKit] Invalid file — buffer is missing");
  }

  const fileName = sanitizeFileName(file.originalname);
  const folder = options.folder ?? getFolderByMimeType(file.mimetype);

  const result = await imagekit.upload({
    file: file.buffer,
    fileName,
    folder,
    tags: options.tags ?? ["chat", "user-upload"],
    useUniqueFileName: false,
    responseFields: ["url", "fileId", "name", "size", "fileType"],
  });

  return {
    url: result.url,
    fileId: result.fileId,
    name: result.name,
    size: result.size,
    fileType: result.fileType,
  };
}

/**
 * Profile picture upload করে — পুরনো থাকলে আগে delete করে।
 */
export async function uploadProfilePicture(file, oldFileId = null) {
  if (!hasImageKitConfig()) {
    throw new Error("[ImageKit] Missing required environment variables");
  }

  if (oldFileId) {
    await deleteFile(oldFileId).catch((err) =>
      console.warn(`[ImageKit] Failed to delete old profile pic (${oldFileId}):`, err.message)
    );
  }

  const fileName = sanitizeFileName(file.originalname);

  const result = await imagekit.upload({
    file: file.buffer,
    fileName,
    folder: "/chat-media/avatars",
    tags: ["avatar", "profile"],
    useUniqueFileName: false,
  });

  return {
    url: result.url,
    fileId: result.fileId,
  };
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * ImageKit থেকে একটা ফাইল delete করে।
 */
export async function deleteFile(fileId) {
  if (!fileId) throw new Error("[ImageKit] fileId is required for deletion");
  await imagekit.deleteFile(fileId);
  console.info(`[ImageKit] Deleted file: ${fileId}`);
}

/**
 * একসাথে অনেকগুলো ফাইল delete করে (message delete এর সময় কাজে আসবে)।
 */
export async function bulkDeleteFiles(fileIds = []) {
  if (!fileIds.length) return;
  await imagekit.bulkDeleteFiles(fileIds);
  console.info(`[ImageKit] Bulk deleted ${fileIds.length} file(s)`);
}

// ─── Auth (frontend direct upload এর জন্য) ───────────────────────────────────

/**
 * Frontend থেকে সরাসরি ImageKit এ upload করার জন্য
 * signed auth token generate করে।
 * Route: GET /api/imagekit/auth
 * @returns {{ token: string, expire: number, signature: string }}
 */
export function getImageKitAuthParams() {
  if (!hasImageKitConfig()) {
    throw new Error("[ImageKit] Missing required environment variables");
  }
  return imagekit.getAuthenticationParameters();
}