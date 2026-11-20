import { Router } from "express";
import { authMiddleware, authorize, tenantIsolation } from "../../middleware/auth";
import * as wa from "./whatsapp.controller";

const STAFF = ["super_admin", "accounts_manager", "vendor_manager", "recruiter"];
const ADMINS = ["super_admin", "accounts_manager"];

/** Signed-in users: /v1/whatsapp/* */
export const whatsappRouter = Router();
whatsappRouter.use(authMiddleware, tenantIsolation, authorize(STAFF));
whatsappRouter.get("/me", wa.getMine);
whatsappRouter.put("/me", wa.saveMine);
whatsappRouter.delete("/me", wa.removeMine);
whatsappRouter.get("/company", authorize(ADMINS), wa.getCompany);
whatsappRouter.put("/company", authorize(ADMINS), wa.saveCompany);
whatsappRouter.delete("/company", authorize(ADMINS), wa.removeCompany);
whatsappRouter.get("/candidates/:id/messages", wa.listMessages);
whatsappRouter.post("/candidates/:id/messages", wa.sendMessage);
whatsappRouter.post("/messages/:id/sent", wa.confirmClickSent);

/** Meta webhook (public, signature-checked): mounted before express.json() for the raw body. */
export const whatsappWebhookRouter = Router();
whatsappWebhookRouter.get("/", wa.verifyWebhook);
whatsappWebhookRouter.post("/", wa.rawJson, wa.receiveWebhook);
