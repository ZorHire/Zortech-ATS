import dotenv from 'dotenv';
import path from 'path';

// Load root .env file
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const env = {
  PORT: process.env.SERVER_PORT || '5000',
  DATABASE_URL: process.env.SERVER_DATABASE_URL || '',
  JWT_SECRET: process.env.SERVER_JWT_SECRET || 'your_jwt_secret_key_here',
  NODE_ENV: process.env.SERVER_NODE_ENV || 'development',
};

export default env;