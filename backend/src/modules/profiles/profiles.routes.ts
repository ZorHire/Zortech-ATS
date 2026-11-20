import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { authMiddleware, tenantIsolation } from "../../middleware/auth";
import * as profileController from "./profiles.controller";
import { uploadAvatar, getAvatar } from "./profiles.controller";
import { safeUploadName, uploadSubdir } from "../../lib/uploadPaths";

const AVATAR_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Avatars go to <UPLOAD_DIR>/avatars with an extension so they're served with
// the right content type by GET /v1/profile/avatar/:userId.
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadSubdir("avatars"),
    filename: (_req, file, cb) => {
      const ext = AVATAR_TYPES[file.mimetype] ?? "img";
      cb(null, safeUploadName(`avatar.${ext}`));
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (AVATAR_TYPES[file.mimetype]) cb(null, true);
    else cb(new Error("Only JPEG, PNG and WebP images are allowed."));
  },
});

/** Turn multer errors (size/type) into a 400 the UI can show. */
const uploadAvatarFile = (req: Request, res: Response, next: NextFunction) => {
  upload.single("avatar")(req, res, (err: unknown) => {
    if (!err) return next();
    const message =
      err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
        ? "Image is too large. The limit is 5 MB."
        : err instanceof Error
          ? err.message
          : "Upload failed";
    res.status(400).json({ message });
  });
};

const router = Router();

router.get("/", authMiddleware, profileController.getProfile);
router.put("/", authMiddleware, profileController.updateProfile);
router.post("/avatar", authMiddleware, tenantIsolation, uploadAvatarFile, uploadAvatar);
router.get("/avatar/:userId", authMiddleware, tenantIsolation, getAvatar);

export default router;
