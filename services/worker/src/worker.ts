import { Worker, Job } from 'bullmq'
import { Redis } from 'ioredis'
import { MashupPlanner } from './MashupPlanner'
import { logger } from './utils/logger'
import { config } from './utils/config'

interface MashupGenerationJobData {
  mashupId: string
  trackIds: string[]
  duration: number
  userId: string
}

class WorkerService {
  private worker: Worker<MashupGenerationJobData>
  private connection: Redis
  private mashupPlanner: MashupPlanner

  constructor() {
    this.connection = new Redis(config.queue.redis)
    this.mashupPlanner = new MashupPlanner()
    
    this.worker = new Worker(
      'mashup-generation',
      this.processMashupGenerationJob.bind(this),
      {
        connection: this.connection,
        concurrency: 2, // Process 2 mashup generations at once
        limiter: {
          max: 5, // Max 5 jobs per minute
          duration: 60000
        }
      }
    )

    this.setupEventHandlers()
  }

  private setupEventHandlers() {
    this.worker.on('completed', (job: Job<MashupGenerationJobData>) => {
      logger.info('Mashup generation job completed', {
        job: job.id,
        mashupId: job.data.mashupId,
        userId: job.data.userId
      })
    })

    this.worker.on('failed', (job: Job<MashupGenerationJobData> | undefined, err: Error) => {
      logger.error('Mashup generation job failed', {
        job: job?.id,
        mashupId: job?.data.mashupId,
        userId: job?.data.userId,
        error: err.message
      })
    })

    this.worker.on('error', (err: Error) => {
      logger.error('Worker error:', err)
    })
  }

  private async processMashupGenerationJob(job: Job<MashupGenerationJobData>) {
    const { mashupId, trackIds, duration, userId } = job.data
    
    logger.info('Processing mashup generation job', {
      job: job.id,
      mashupId,
      trackIds,
      duration,
      userId
    })

    try {
      // Step 1: Update status to PLANNING
      await this.updateMashupStatus(mashupId, 'PLANNING')

      // Step 2: Get tracks detailed information
      const tracks = await this.getMashupTracks(mashupId)

      // Step 3: Generate timeline plan using AI planner
      const timelinePlan = await this.mashupPlanner.planMashup({
        tracks,
        targetDuration: duration,
        userId,
        mashupId
      })

      // Step 4: Save timeline plan and update master parameters
      await this.updateMashupPlan(
        mashupId, 
        timelinePlan,
        timelinePlan.masterBpm,
        timelinePlan.masterKey
      )

      // Step 5: Update status to RENDERING and queue for rendering
      await this.updateMashupStatus(mashupId, 'RENDERING')
      await this.queueForRendering(mashupId, timelinePlan)

      logger.info('Mashup planning completed and queued for rendering', {
        job: job.id,
        mashupId,
        masterBpm: timelinePlan.masterBpm,
        masterKey: timelinePlan.masterKey,
        segmentCount: timelinePlan.segments.length
      })

      return { timelinePlan, status: 'QUEUED_FOR_RENDERING' }
    } catch (error) {
      logger.error('Mashup generation failed', {
        job: job.id,
        mashupId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      // Update status to FAILED
      await this.updateMashupStatus(mashupId, 'FAILED')
      
      throw error
    }
  }

  /**
   * Get mashup tracks for processing
   */
  private async getMashupTracks(mashupId: string) {
    try {
      // Import here to avoid circular dependencies
      const { PrismaClient } = require('@prisma/client')
      const prisma = new PrismaClient()
      
      const mashup = await prisma.mashup.findUnique({
        where: { id: mashupId },
        include: {
          inputTracks: {
            include: {
              uploadedTrack: {
                select: {
                  id: true,
                  fileName: true,
                  storageUrl: true,
                  originalName: true,
                  detectedBpm: true,
                  detectedKey: true,
                  durationSeconds: true,
                  hasVocals: true,
                  isInstrumental: true
                }
              }
            },
            orderBy: {
              position: 'asc'
            }
          }
        }
      })

      if (!mashup) {
        throw new Error(`Mashup ${mashupId} not found`)
      }

      const tracks = mashup.inputTracks.map(mt => ({
        id: mt.uploadedTrack.id,
        fileName: mt.uploadedTrack.fileName,
        storageUrl: mt.uploadedTrack.storageUrl!,
        originalName: mt.uploadedTrack.originalName,
        detectedBpm: mt.uploadedTrack.detectedBpm,
        detectedKey: mt.uploadedTrack.detectedKey,
        durationSeconds: mt.uploadedTrack.durationSeconds,
        hasVocals: mt.uploadedTrack.hasVocals,
        isInstrumental: mt.uploadedTrack.isInstrumental,
        position: mt.position
      }))

      await prisma.$disconnect()
      return tracks
    } catch (error) {
      logger.error('Error getting mashup tracks:', error)
      throw new Error('Failed to get mashup tracks')
    }
  }

  /**
   * Update mashup status in database
   */
  private async updateMashupStatus(
    mashupId: string, 
    status: 'PENDING' | 'PLANNING' | 'RENDERING' | 'COMPLETED' | 'FAILED'
  ): Promise<void> {
    try {
      const { PrismaClient } = require('@prisma/client')
      const prisma = new PrismaClient()
      
      await prisma.mashup.update({
        where: { id: mashupId },
        data: { generationStatus: status }
      })
      
      await prisma.$disconnect()
      
      logger.debug('Mashup status updated', { mashupId, status })
    } catch (error) {
      logger.error('Error updating mashup status:', error)
      throw new Error('Failed to update mashup status')
    }
  }

  /**
   * Update mashup with timeline plan and master parameters
   */
  private async updateMashupPlan(
    mashupId: string,
    timelinePlan: any,
    masterBpm: number,
    masterKey: string
  ): Promise<void> {
    try {
      const { PrismaClient } = require('@prisma/client')
      const prisma = new PrismaClient()
      
      await prisma.mashup.update({
        where: { id: mashupId },
        data: {
          timelinePlan,
          masterBpm,
          masterKey
        }
      })
      
      await prisma.$disconnect()
      
      logger.debug('Mashup plan updated', { 
        mashupId, 
        masterBpm, 
        masterKey,
        segmentCount: timelinePlan.segments.length 
      })
    } catch (error) {
      logger.error('Error updating mashup plan:', error)
      throw new Error('Failed to update mashup plan')
    }
  }

  /**
   * Queue mashup for audio rendering
   */
  private async queueForRendering(mashupId: string, timelinePlan: any): Promise<void> {
    try {
      // Get rendering data from database
      const { PrismaClient } = require('@prisma/client')
      const prisma = new PrismaClient()
      
      const mashup = await prisma.mashup.findUnique({
        where: { id: mashupId },
        select: { userId: true }
      })
      
      if (!mashup) {
        throw new Error(`Mashup ${mashupId} not found`)
      }

      // Add to rendering queue
      const { Queue } = require('bullmq')
      const renderingQueue = new Queue('audio-rendering', {
        connection: this.connection
      })

      await renderingQueue.add(
        'render-mashup',
        {
          mashupId,
          timelinePlan,
          userId: mashup.userId
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000
          },
          removeOnComplete: 5,
          removeOnFail: 3
        }
      )

      await renderingQueue.close()
      await prisma.$disconnect()
      
      logger.info('Mashup queued for rendering', { mashupId })
    } catch (error) {
      logger.error('Error queuing for rendering:', error)
      throw new Error('Failed to queue for rendering')
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
      logger.error('Error getting worker stats:', error)
      throw new Error('Failed to get worker stats')
    }
  }

  /**
   * Graceful shutdown
   */
  async close() {
    await this.worker.close()
    await this.connection.quit()
    logger.info('Worker service closed')
  }
}

// Start the worker service
const workerService = new WorkerService()

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down worker service...')
  await workerService.close()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down worker service...')
  await workerService.close()
  process.exit(0)
})
