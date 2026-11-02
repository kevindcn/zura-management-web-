import { Router, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { blockDemo } from "../middleware/blockDemo.js";

const uploadsDir = path.resolve(process.cwd(), "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const baseName = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, "_");
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${baseName}-${uniqueSuffix}${ext}`);
  },
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
    cb(new FileValidationError(`Ekstensi file '${ext}' tidak diizinkan. Tipe yang diperbolehkan: png, jpg, jpeg, gif, webp, pdf, txt, csv, zip`));
    return;
  }

  if (!ALLOWED_MIME_TYPES.has(mimetype)) {
    cb(new FileValidationError(`Tipe MIME '${mimetype}' tidak diizinkan`));
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
        res.status(400).json({ message: err.message || "Tipe file tidak valid" });
        return;
      }

      if (!req.file) {
        res.status(400).json({ message: "Tidak ada file yang diunggah" });
        return;
      }

      const fileUrl = `/uploads/${req.file.filename}`;

      res.status(201).json({
        url: fileUrl,
        filename: req.file.originalname,
        storedName: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
      });
    });
  }
);

export default router;
