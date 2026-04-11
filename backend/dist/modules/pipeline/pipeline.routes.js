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
const pipelineController = __importStar(require("./pipeline.controller"));
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.get("/jobs/:jobId/applications", auth_1.authMiddleware, auth_1.tenantIsolation, pipelineController.getJobApplications);
router.post("/jobs/:jobId/applications", auth_1.authMiddleware, auth_1.tenantIsolation, (0, auth_1.authorize)([
    "super_admin",
    "ats_admin",
    "senior_recruiter",
    "recruiter",
    "sourcing_specialist",
]), pipelineController.createApplication);
router.patch("/applications/:id/stage", auth_1.authMiddleware, auth_1.tenantIsolation, (0, auth_1.authorize)([
    "super_admin",
    "ats_admin",
    "senior_recruiter",
    "recruiter",
    "sourcing_specialist",
]), pipelineController.moveApplicationStage);
router.get("/applications/:id/history", auth_1.authMiddleware, auth_1.tenantIsolation, pipelineController.getApplicationHistory);
exports.default = router;
