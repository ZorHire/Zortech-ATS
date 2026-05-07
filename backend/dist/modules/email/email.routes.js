"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const emailController = __importStar(require("./email.controller"));
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
const EMAIL_ROLES = ["super_admin", "accounts_manager", "recruiter", "vendor_manager"];
// ─── Per-user SMTP config ─────────────────────────────────────────────────────
router.get("/config", auth_1.authMiddleware, auth_1.tenantIsolation, (0, auth_1.authorize)(EMAIL_ROLES), emailController.getEmailConfig);
router.post("/config", auth_1.authMiddleware, auth_1.tenantIsolation, (0, auth_1.authorize)(EMAIL_ROLES), emailController.saveEmailConfig);
router.delete("/config", auth_1.authMiddleware, auth_1.tenantIsolation, (0, auth_1.authorize)(EMAIL_ROLES), emailController.removeEmailConfig);
router.post("/config/test", auth_1.authMiddleware, auth_1.tenantIsolation, (0, auth_1.authorize)(EMAIL_ROLES), emailController.testEmailConfig);
// ─── Email sending ────────────────────────────────────────────────────────────
router.get("/templates", auth_1.authMiddleware, auth_1.tenantIsolation, emailController.listTemplates);
router.post("/send-single", auth_1.authMiddleware, auth_1.tenantIsolation, (0, auth_1.authorize)(EMAIL_ROLES), emailController.sendSingleEmail);
router.post("/send", auth_1.authMiddleware, auth_1.tenantIsolation, (0, auth_1.authorize)(EMAIL_ROLES), emailController.sendEmail);
router.post("/assign-jd", auth_1.authMiddleware, auth_1.tenantIsolation, (0, auth_1.authorize)(["super_admin", "accounts_manager", "vendor_manager"]), emailController.assignJd);
router.post("/assign-jd-recruiter", auth_1.authMiddleware, auth_1.tenantIsolation, (0, auth_1.authorize)(["super_admin", "accounts_manager"]), emailController.assignJdRecruiter);
exports.default = router;
