"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.query = void 0;
const pg_1 = require("pg");
const env_1 = __importDefault(require("../config/env"));
const pool = new pg_1.Pool({
    connectionString: env_1.default.DATABASE_URL,
});
// Prevent unhandled pool errors from crashing the process
pool.on("error", (err) => {
    console.error("Unexpected pg pool error:", err.message);
});
const query = (text, params) => {
    return pool.query(text, params);
};
exports.query = query;
exports.default = pool;
