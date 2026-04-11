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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const morgan_1 = __importDefault(require("morgan"));
const db_1 = __importDefault(require("./db"));
const env_1 = __importDefault(require("./config/env"));
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const clients_routes_1 = __importDefault(require("./modules/clients/clients.routes"));
const jobs_routes_1 = __importDefault(require("./modules/jobs/jobs.routes"));
const candidates_routes_1 = __importDefault(require("./modules/candidates/candidates.routes"));
const vendors_routes_1 = __importDefault(require("./modules/vendors/vendors.routes"));
const admin_routes_1 = __importDefault(require("./modules/admin/admin.routes"));
const pipeline_routes_1 = __importDefault(require("./modules/pipeline/pipeline.routes"));
const email_routes_1 = __importDefault(require("./modules/email/email.routes"));
const emailCampaign_routes_1 = __importDefault(require("./modules/email/emailCampaign.routes"));
const parse_routes_1 = __importDefault(require("./routes/parse.routes"));
const parseController = __importStar(require("./modules/parse/parse.controller"));
const auth_1 = require("./middleware/auth");
const fileUpload_1 = require("./middleware/fileUpload");
const app = (0, express_1.default)();
const port = env_1.default.PORT;
const uploadsPath = path_1.default.resolve(env_1.default.UPLOAD_DIR || path_1.default.resolve(__dirname, "../uploads"));
fs_1.default.mkdirSync(uploadsPath, { recursive: true });
// Middleware
app.use((0, cors_1.default)({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
}));
app.use(express_1.default.json());
app.use(express_1.default.static(uploadsPath));
app.use((0, morgan_1.default)("dev"));
// Test DB Connection
db_1.default.connect((err, client, release) => {
    if (err) {
        return console.error("Error acquiring client", err.stack);
    }
    console.log("Connected to PostgreSQL database");
    release();
});
// Routes
const v1Router = express_1.default.Router();
v1Router.use("/auth", auth_routes_1.default);
v1Router.use("/clients", clients_routes_1.default);
v1Router.use("/jobs", jobs_routes_1.default);
v1Router.use("/candidates", candidates_routes_1.default);
v1Router.use("/vendors", vendors_routes_1.default);
v1Router.use("/admin", admin_routes_1.default);
v1Router.use("/pipeline", pipeline_routes_1.default);
v1Router.use("/email", email_routes_1.default);
v1Router.use("/email-campaigns", emailCampaign_routes_1.default);
app.use("/api/v1", v1Router);
app.use("/api/v1/parse", parse_routes_1.default);
app.post("/api/v1/parse/resume", auth_1.authMiddleware, auth_1.tenantIsolation, fileUpload_1.upload.single("file"), parseController.parseResume);
app.post("/api/v1/parse/jd", auth_1.authMiddleware, auth_1.tenantIsolation, fileUpload_1.upload.single("file"), parseController.parseJobDescription);
// Health Check
app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Backend is running" });
});
// 404 fallback — always return JSON so the frontend can parse error messages
app.use((req, res) => {
    res
        .status(404)
        .json({ message: `Route ${req.method} ${req.path} not found` });
});
// Start Server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
exports.default = app;
