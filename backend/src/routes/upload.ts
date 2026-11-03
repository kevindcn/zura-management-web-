import { Router, Response } from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";

// Konfigurasi Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Konfigurasi CloudinaryStorage untuk Multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "jira_clone_uploads",
    resource_type: "auto",
  } as any,
});

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max file size
  },
});

const router = Router();

// POST /api/upload - Upload image or file attachment
router.post(
  "/",
  authenticateToken,
  upload.single("file"),
  (req: AuthRequest, res: Response) => {
    if (!req.file) {
      res.status(400).json({ message: "Tidak ada file yang diunggah" });
      return;
    }

    const fileUrl = req.file.path;

    res.status(201).json({
      url: fileUrl,
      filename: req.file.originalname,
      storedName: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  }
);

export default router;
