import { Request, Response, NextFunction } from 'express';

export const validate = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Simple validation for now, could use Joi or Zod
    const requiredFields = schema.required || [];
    const missingFields = requiredFields.filter((field: string) => !req.body[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        missingFields 
      });
    }
    next();
  };
};