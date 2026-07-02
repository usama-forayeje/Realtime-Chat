import multer from "multer";

// ─── Constants ────────────────────────────────────────────────────────────────

const MB = 1024 * 1024;

const FILE_LIMITS = {
  image: 5 * MB,   // 5MB
  video: 50 * MB,  // 50MB
  audio: 20 * MB,  // 20MB
  file:  10 * MB,  // 10MB (docs, pdf etc.)
};

const ALLOWED_MIMETYPES = {
  image: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
  ],
  video: [
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-msvideo", // .avi
  ],
  audio: [
    "audio/mpeg",     // .mp3
    "audio/ogg",
    "audio/wav",
    "audio/webm",
    "audio/mp4",
  ],
  file: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "application/zip",
  ],
};

const ALL_ALLOWED = Object.values(ALLOWED_MIMETYPES).flat();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getFileCategory(mimetype) {
  for (const [category, types] of Object.entries(ALLOWED_MIMETYPES)) {
    if (types.includes(mimetype)) return category;
  }
  return null;
}

function formatSize(bytes) {
  return `${(bytes / MB).toFixed(0)}MB`;
}

// ─── Custom Storage (per-file size limit) ─────────────────────────────────────

// multer এর global limit সব file এ একই size দেয়।
// আমরা per-category আলাদা size limit দিতে fileFilter এ manually check করছি।

// ─── File Filter ──────────────────────────────────────────────────────────────

function fileFilter(req, file, cb) {
  const category = getFileCategory(file.mimetype);

  if (!category) {
    return cb(
      Object.assign(new Error(`File Types are not allowed ${file.mimetype}`), {
        code: "UNSUPPORTED_FILE_TYPE",
        status: 415,
      }),
      false
    );
  }

  // per-category size limit check (Content-Length header থেকে early reject)
  const contentLength = parseInt(req.headers["content-length"] ?? "0", 10);
  const limit = FILE_LIMITS[category];
  if (contentLength > limit) {
    return cb(
      Object.assign(
        new Error(
          `${category} for ${formatSize(limit)} unauthorize`
        ),
        { code: "FILE_TOO_LARGE", status: 413 }
      ),
      false
    );
  }

  cb(null, true);
}
// ─── Multer Instances ─────────────────────────────────────────────────────────

// global limit হিসেবে সবচেয়ে বড় size দিচ্ছি (video: 50MB)
// actual per-type limit fileFilter এ enforce হচ্ছে
const baseConfig = {
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * MB,
    files: 5,         // একসাথে max 5 ফাইল
    fields: 10,       // non-file fields
  },
  fileFilter,
};

// সব ধরনের ফাইল accept করে (chat message attachment)
export const uploadAny = multer(baseConfig).array("files", 5);

// শুধু একটা ফাইল (single message media)
export const uploadSingle = multer(baseConfig).single("file");

// শুধু image (profile picture)
export const uploadImage = multer({
  ...baseConfig,
  limits: { ...baseConfig.limits, fileSize: FILE_LIMITS.image },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIMETYPES.image.includes(file.mimetype)) {
      return cb(
        Object.assign(new Error("শুধুমাত্র ছবি আপলোড করা যাবে।"), {
          code: "UNSUPPORTED_FILE_TYPE",
          status: 415,
        }),
        false
      );
    }
    cb(null, true);
  },
}).single("image");

// ─── Error Handler Middleware ─────────────────────────────────────────────────

/**
 * Multer error গুলো properly handle করে structured response দেয়।
 * route এর পরে এটা use করো।
 *
 * @example
 * router.post("/upload", uploadAny, handleUploadError, uploadController);
 */
export function handleUploadError(err, req, res, next) {
  if (!err) return next();

  // Multer built-in errors
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      error: "ফাইলের আকার সীমা অতিক্রম করেছে।",
      code: err.code,
    });
  }

  if (err.code === "LIMIT_FILE_COUNT") {
    return res.status(400).json({
      error: "একসাথে সর্বোচ্চ ৫টি ফাইল আপলোড করা যাবে।",
      code: err.code,
    });
  }

  if (err.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(400).json({
      error: "অপ্রত্যাশিত ফাইল ফিল্ড।",
      code: err.code,
    });
  }

  // আমাদের custom errors
  if (err.code === "UNSUPPORTED_FILE_TYPE" || err.code === "FILE_TOO_LARGE") {
    return res.status(err.status ?? 400).json({
      error: err.message,
      code: err.code,
    });
  }

  // বাকি সব error
  next(err);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export { ALLOWED_MIMETYPES, FILE_LIMITS, getFileCategory };