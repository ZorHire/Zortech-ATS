"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseJobDescription = exports.parseResume = void 0;
const parse_utils_1 = require("./parse.utils");
const parseResume = async (req, res) => {
    console.log("Resume parse route hit");
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ message: "No file uploaded." });
        }
        const content = await (0, parse_utils_1.extractFileText)(file);
        const parsed = (0, parse_utils_1.parseResumeText)(content);
        res.json(parsed);
    }
    catch (error) {
        console.error("Resume parse error:", error);
        res
            .status(500)
            .json({ message: "Could not extract data, please fill manually." });
    }
};
exports.parseResume = parseResume;
const parseJobDescription = async (req, res) => {
    console.log("JD parse route hit");
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ message: "No file uploaded." });
        }
        const content = await (0, parse_utils_1.extractFileText)(file);
        const parsed = (0, parse_utils_1.parseJobDescriptionText)(content);
        res.json(parsed);
    }
    catch (error) {
        console.error("JD parse error:", error);
        res
            .status(500)
            .json({ message: "Could not extract data, please fill manually." });
    }
};
exports.parseJobDescription = parseJobDescription;
