"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTextWithTika = void 0;
const axios_1 = __importDefault(require("axios"));
const TIKA_URL = process.env.TIKA_URL || "http://localhost:9998/tika";
/**
 * Extracts plain text from a file buffer by sending it to an Apache Tika
 * REST server. Returns the extracted text, or null if the Tika server is
 * unreachable (allowing callers to fall back to a local parser).
 */
const extractTextWithTika = async (file) => {
    try {
        const response = await axios_1.default.put(TIKA_URL, file.buffer, {
            headers: {
                "Content-Type": file.mimetype,
                Accept: "text/plain",
            },
            // Allow large documents without axios truncating the body
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            // If Tika is down, fail fast rather than hanging the request
            timeout: 15000,
        });
        const text = typeof response.data === "string" ? response.data : "";
        console.log(`[Tika] Extracted ${text.length} chars from ${file.originalname}`);
        return text;
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[Tika] Unavailable (${msg}). Falling back to local parsers.`);
        return null; // Signal to caller: use fallback
    }
};
exports.extractTextWithTika = extractTextWithTika;
