"use strict";
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
const parse_routes_1 = __importDefault(require("./routes/parse.routes"));
const app = (0, express_1.default)();
const port = env_1.default.PORT;
const uploadsPath = path_1.default.resolve(env_1.default.UPLOAD_DIR || path_1.default.resolve(__dirname, "../uploads"));
fs_1.default.mkdirSync(uploadsPath, { recursive: true });
// Middleware
const allowedOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    /\.run\.app$/, // any Cloud Run frontend
    /\.web\.app$/, // Firebase Hosting
    /\.firebaseapp\.com$/, // Firebase Hosting alt
];
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, server-to-server)
        if (!origin)
            return callback(null, true);
        const allowed = allowedOrigins.some((o) => typeof o === "string" ? o === origin : o.test(origin));
        callback(allowed ? null : new Error("CORS: origin not allowed"), allowed);
    },
    credentials: true,
}));
// CRITICAL: Mount parse routes BEFORE express.json() to prevent stream consumption
// This allows Multer to handle the multipart/form-data request first
const parseRouter = express_1.default.Router();
parseRouter.use("/", parse_routes_1.default);
app.use("/api/v1/parse", parseRouter);
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
// v1Router.use("/parse", parseRoutes); // Moved up to before express.json()
app.use("/api/v1", v1Router);
// Health Check
app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Backend is running" });
});
// Global error handler — converts thrown/middleware errors to JSON (e.g. multer rejections)
app.use((err, _req, res, _next) => {
    console.error("Global error:", err.message);
    res.status(400).json({ message: err.message || "An error occurred" });
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
