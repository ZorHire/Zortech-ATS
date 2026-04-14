"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantIsolation = exports.authorize = exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = __importDefault(require("../config/env"));
const JWT_SECRET = env_1.default.JWT_SECRET;
const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
        return res.status(401).json({ message: "Authentication required" });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (error) {
        const isExpired = error instanceof jsonwebtoken_1.default.TokenExpiredError;
        return res.status(401).json({
            message: isExpired ? "Token expired" : "Invalid or expired token",
        });
    }
};
exports.authMiddleware = authMiddleware;
const authorize = (roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: "Forbidden: Access denied" });
        }
        next();
    };
};
exports.authorize = authorize;
const tenantIsolation = (req, res, next) => {
    if (!req.user?.tenant_id) {
        return res
            .status(403)
            .json({ message: "Forbidden: Tenant context missing" });
    }
    next();
};
exports.tenantIsolation = tenantIsolation;
