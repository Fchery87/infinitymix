import { Worker, Job } from 'bullmq'
import { Redis } from 'ioredis'
import { AudioRenderer } from './AudioRenderer'
import { logger } from './utils/logger'
import { config } from './utils/config'

interface RenderingJobData {
  mashupId: string
  timelinePlan: {
    masterBpm: number
    masterKey: string
    totalDuration: number
    segments: Array<{
      trackId: string
      startTime: number
      duration: number
      endTime: number
      transformations: {
        pitchShift?: number
        timeStretch?: number
        fadeIn?: number
        fadeOut?: number
        gain?: number
      }
      type: 'backbone' | 'vocal' | 'bridge' | 'outro'
    }>
  }
  userId: string
}

class RendererWorker {
  private worker: Worker<RenderingJobData>
  private connection: Redis
  private audioRenderer: AudioRenderer

  constructor() {
    this.connection = new Redis(config.queue.redis)
    this.audioRenderer = new AudioRenderer()
    
    this.worker = new Worker(
      'audio-rendering',
      this.processRenderingJob.bind(this),
      {
        connection: this.connection,
        concurrency: 1, // Render one mashup at a time due to resource intensity
        limiter: {
          max: 2, // Max 2 renderings per 10 minutes
          duration: 600000
        }
      }
    )

    this.setupEventHandlers()
  }

  private setupEventHandlers() {
    this.worker.on('completed', (job: Job<RenderingJobData>) => {
      logger.info('Audio rendering job completed', {
        job: job.id,
        mashupId: job.data.mashupId,
        userId: job.data.userId
      })
    })

    this.worker.on('failed', (job: Job<RenderingJobData> | undefined, err: Error) => {
      logger.error('Audio rendering job failed', {
        job: job?.id,
        mashupId: job?.data.mashupId,
        userId: job?.data.userId,
        error: err.message
      })
    })

    this.worker.on('error', (err: Error) => {
      logger.error('Renderer worker error:', err)
    })
  }

  private async processRenderingJob(job: Job<RenderingJobData>) {
    const { mashupId, timelinePlan, userId } = job.data
    
    logger.info('Processing audio rendering job', {
      job: job.id,
      mashupId,
      duration: timelinePlan.totalDuration,
      segmentCount: timelinePlan.segments.length,
      userId
    })

    try {
      // Track rendering start time (for analytics)
      const renderStartTime = Date.now()

      // Render the mashup using FFmpeg and audio processing
      const outputUrl = await this.audioRenderer.renderMashup(mashupId, timelinePlan)
      
      // Get file size for database
      const { PrismaClient } = require('@prisma/client')
      const prisma = new PrismaClient()
      
      const mashup = await prisma.mashup.findUnique({
        where: { id: mashupId },
        select: { outputStorageUrl: true }
      })
      
      // Extract file size from S3 metadata or calculate from local file
      let outputFileSize = 0
      if (mashup?.outputStorageUrl === outputUrl) {
        // File was already uploaded, get metadata
        const fileName = outputUrl.split('/').pop() || ''
        try {
          const AWS = require('aws-sdk')
          const s3 = new AWS.S3({
            accessKeyId: config.aws.accessKeyId,
            secretAccessKey: config.aws.secretAccessKey,
            region: config.aws.region
          })
          
          const headResult = await s3.headObject({
            Bucket: config.aws.s3Bucket,
            Key: `mashups/${fileName}`
          }).promise()
          
          outputFileSize = headResult.ContentLength || 0
        } catch (metadataError) {
          logger.warn('Could not get file metadata, using default size', { error: metadataError })
          outputFileSize = 5000000 // Default 5MB estimate
        }
      }

      // Update mashup record with completed output
      await this.audioRenderer.updateMashupOutput(mashupId, outputUrl, outputFileSize)

      const renderDuration = Date.now() - renderStartTime
      
      await prisma.$disconnect()

      logger.info('Audio rendering completed successfully', {
        job: job.id,
        mashupId,
        outputUrl,
        outputFileSize,
        renderDuration: `${renderDuration}ms`
      })

      return {
        outputUrl,
        outputFileSize,
        renderDuration,
        status: 'COMPLETED'
      }
    } catch (error) {
      logger.error('Audio rendering failed', {
        job: job.id,
        mashupId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      // Update mashup status to FAILED
      await this.audioRenderer.markRenderingFailed(
        mashupId, 
        error instanceof Error ? error.message : 'Unknown error'
      )
      
      throw error
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    try {
      const [waiting, active, completed, failed] = await Promise.all([
        this.worker.getWaiting(),
        this.worker.getActive(),
        this.worker.getCompleted(),
        this.worker.getFailed()
      ])

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length
      }
    } catch (error) {
      logger.error('Error getting renderer stats:', error)
      throw new Error('Failed to get renderer stats')
    }
  }

  /**
   * Get current rendering job progress
   */
  async getCurrentJob(): Promise<{ id: string; data: RenderingJobData } | null> {
    try {
      const active = await this.worker.getActive()
      return active.length > 0 ? { id: active[0].id!, data: active[0].data } : null
    } catch (error) {
      logger.error('Error getting current renderer job:', error)
      return null
    }
  }

  /**
   * Get rendering metrics for monitoring
   */
  async getRenderingMetrics(): Promise<{
    queueStats: { waiting: number; active: number; completed: number; failed: number }
    currentJob: { id: string; data: RenderingJobData } | null
    memoryUsage: NodeJS.MemoryUsage
  }> {
    const queueStats = await this.getQueueStats()
    const currentJob = await this.getCurrentJob()
    const memoryUsage = process.memoryUsage()

    return {
      queueStats,
      currentJob,
      memoryUsage
    }
  }

  /**
   * Graceful shutdown
   */
  async close() {
    await this.worker.close()
    await this.connection.quit()
    logger.info('Renderer worker closed')
  }
}

// Start the renderer worker
const rendererWorker = new RendererWorker()

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down renderer worker...')
  await rendererWorker.close()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down renderer worker...')
  await rendererWorker.close()
  process.exit(0)
})

// Export for testing
export default rendererWorker
