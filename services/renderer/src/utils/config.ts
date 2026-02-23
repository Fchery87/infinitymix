import dotenv from 'dotenv'

dotenv.config()

function parseFlag(value: string | undefined, fallback = false): boolean {
  if (value == null) return fallback
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    region: process.env.AWS_REGION || 'us-east-1',
    s3Bucket: process.env.S3_BUCKET || 'infinitymix-dev'
  },
  queue: {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0', 10)
    }
  },
  logLevel: process.env.LOG_LEVEL || 'info',
  featureFlags: {
    browserAnalysisWorker: parseFlag(process.env.IMX_FEATURE_BROWSER_ANALYSIS_WORKER),
    mlSectionTagging: parseFlag(process.env.IMX_FEATURE_ML_SECTION_TAGGING),
    toneJsPreviewGraph: parseFlag(process.env.IMX_FEATURE_TONEJS_PREVIEW_GRAPH),
    ruleBasedPlanner: parseFlag(process.env.IMX_FEATURE_RULE_BASED_PLANNER),
    twoPassLoudnorm: parseFlag(process.env.IMX_FEATURE_TWO_PASS_LOUDNORM),
    resumableUploads: parseFlag(process.env.IMX_FEATURE_RESUMABLE_UPLOADS)
  },
  observability: {
    enableDetailedMetrics: parseFlag(process.env.IMX_ENABLE_DETAILED_METRICS, true)
  }
}

// Validate required environment variables
const requiredEnvVars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'S3_BUCKET']

if (process.env.NODE_ENV === 'production' && requiredEnvVars.some(envVar => !process.env[envVar])) {
  console.error('Missing required environment variables for production')
  process.exit(1)
}
