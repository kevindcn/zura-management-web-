import { Router, Response } from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { blockDemo } from "../middleware/blockDemo.js";
import path from "path";

const isTestEnv = process.env.NODE_ENV === "test";

// Konfigurasi Cloudinary hanya jika bukan di environment testing
if (!isTestEnv) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

// Gunakan memoryStorage saat test, dan CloudinaryStorage saat production/development
const storage = isTestEnv
  ? multer.memoryStorage()
  : new CloudinaryStorage({
      cloudinary: cloudinary,
      params: {
        folder: "jira_clone_uploads",
        resource_type: "auto",
      } as any,
    });

const ALLOWED_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".pdf",
  ".txt",
  ".csv",
  ".zip",
]);

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/csv",
  "text/x-csv",
  "application/vnd.ms-excel",
  "application/zip",
  "application/x-zip-compressed",
  "application/x-zip",
  "application/octet-stream",
]);

export class FileValidationError extends Error {
  status = 400;
  statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = "FileValidationError";
  }
}

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimetype = (file.mimetype || "").toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    cb(new FileValidationError(`File extension '${ext}' is not allowed. Allowed types: png, jpg, jpeg, gif, webp, pdf, txt, csv, zip`));
    return;
  }

  if (!ALLOWED_MIME_TYPES.has(mimetype)) {
    cb(new FileValidationError(`MIME type '${mimetype}' is not allowed`));
    return;
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max file size
  },
});

const router = Router();

// POST /api/upload - Upload image or file attachment
router.post(
  "/",
  authenticateToken,
  blockDemo,
  (req: AuthRequest, res: Response, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        if (err instanceof FileValidationError) {
          res.status(400).json({ message: err.message });
          return;
        }
        if (err instanceof multer.MulterError) {
          res.status(400).json({ message: err.message });
          return;
        }
        res.status(400).json({ message: err.message || "Invalid file type" });
        return;
      }

      if (!req.file) {
        res.status(400).json({ message: "No file uploaded" });
        return;
      }

      const fileUrl = req.file.path ?? `memory://${req.file.originalname}`;
      const storedName = req.file.filename ?? `memory-${req.file.originalname}`;

      res.status(201).json({
        url: fileUrl,
        filename: req.file.originalname,
        storedName: storedName,
        size: req.file.size,
        mimetype: req.file.mimetype,
      });
    });
  }
);

export default router;
