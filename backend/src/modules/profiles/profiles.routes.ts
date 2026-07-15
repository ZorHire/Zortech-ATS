import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authMiddleware, tenantIsolation } from "../../middleware/auth";
import * as profileController from "./profiles.controller";
import { uploadAvatar } from "./profiles.controller";

const uploadDir = path.join(__dirname, "../../../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (['image/jpeg','image/jpg','image/png','image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Images only'));
  }
});

const router = Router();

router.get("/", authMiddleware, profileController.getProfile);
router.put("/", authMiddleware, profileController.updateProfile);
router.post("/avatar", authMiddleware, tenantIsolation, upload.single("avatar"), uploadAvatar);

export default router;
