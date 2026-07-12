// Loads .env into process.env, then validates that the required vars exist.
// Import this module FIRST in server.js so env is ready before anything else.
import 'dotenv/config';

const required = ['DATABASE_URL', 'JWT_SECRET'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`[env] Missing required environment variable: ${key}`);
    if (key === 'DATABASE_URL') {
      console.error('       Copy a Neon pooled connection string into .env as DATABASE_URL.');
      console.error('       See .env.example for the format.');
    }
    process.exit(1);
  }
}

export const config = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  queryLog: process.env.QUERY_LOG === 'true',
};
