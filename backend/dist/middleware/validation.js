"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const validate = (schema) => {
    return (req, res, next) => {
        // Simple validation for now, could use Joi or Zod
        const requiredFields = schema.required || [];
        const missingFields = requiredFields.filter((field) => !req.body[field]);
        if (missingFields.length > 0) {
            return res.status(400).json({
                message: 'Validation failed',
                missingFields
            });
        }
        next();
    };
};
exports.validate = validate;
