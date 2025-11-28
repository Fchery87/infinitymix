import dotenv from 'dotenv'

dotenv.config()

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  queue: {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0', 10)
    }
  },
  logLevel: process.env.LOG_LEVEL || 'info'
}

const requiredEnvVars = ['DATABASE_URL']

if (process.env.NODE_ENV === 'production' && requiredEnvVars.some(envVar => !process.env[envVar])) {
  console.error('Missing required environment variables for production')
  process.exit(1)
}
