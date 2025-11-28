import { Worker, Job } from 'bullmq'
import { Redis } from 'ioredis'
import { AudioAnalyzer } from './AudioAnalyzer'
import { logger } from './utils/logger'
import { config } from './utils/config'

interface AnalysisJobData {
  trackId: string
  fileName: string
  userId: string
}

class AnalyzerWorker {
  private worker: Worker<AnalysisJobData>
  private connection: Redis
  private audioAnalyzer: AudioAnalyzer

  constructor() {
    this.connection = new Redis(config.queue.redis)
    this.audioAnalyzer = new AudioAnalyzer()
    
    this.worker = new Worker(
      'audio-analysis',
      this.processAnalysisJob.bind(this),
      {
        connection: this.connection,
        concurrency: 2, // Process 2 analyses at once
        limiter: {
          max: 10, // Max 10 jobs per 10 seconds
          duration: 10000
        }
      }
    )

    this.setupEventHandlers()
  }

  private setupEventHandlers() {
    this.worker.on('completed', (job: Job<AnalysisJobData>) => {
      logger.info('Audio analysis job completed', {
        job: job.id,
        trackId: job.data.trackId,
        userId: job.data.userId
      })
    })

    this.worker.on('failed', (job: Job<AnalysisJobData> | undefined, err: Error) => {
      logger.error('Audio analysis job failed', {
        job: job?.id,
        trackId: job?.data.trackId,
        userId: job?.data.userId,
        error: err.message
      })
    })

    this.worker.on('error', (err: Error) => {
      logger.error('Analysis worker error:', err)
    })
  }

  private async processAnalysisJob(job: Job<AnalysisJobData>) {
    const { trackId, fileName, userId } = job.data
    
    logger.info('Processing audio analysis job', {
      job: job.id,
      trackId,
      fileName,
      userId
    })

    try {
      // Update analysis status to PROCESSING
      await this.audioAnalyzer.updateAnalysisStatus(trackId, 'PROCESSING')

      // Download file from S3
      const audioBuffer = await this.audioAnalyzer.downloadFile(fileName)
      
      // Perform audio analysis
      const analysisResults = await this.audioAnalyzer.analyzeAudio(audioBuffer, fileName)
      
      // Update database with results
      await this.audioAnalyzer.updateTrackWithAnalysis(trackId, analysisResults)
      
      // Update analysis status to COMPLETED
      await this.audioAnalyzer.updateAnalysisStatus(trackId, 'COMPLETED')

      logger.info('Audio analysis completed successfully', {
        job: job.id,
        trackId,
        results: analysisResults
      })

      return analysisResults
    } catch (error) {
      logger.error('Audio analysis failed', {
        job: job.id,
        trackId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      // Update analysis status to FAILED
      await this.audioAnalyzer.updateAnalysisStatus(trackId, 'FAILED')
      
      throw error
    }
  }

  async close() {
    await this.worker.close()
    await this.connection.quit()
    logger.info('Analyzer worker closed')
  }
}

// Start the analyzer worker
const analyzerWorker = new AnalyzerWorker()

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down analyzer worker...')
  await analyzerWorker.close()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down analyzer worker...')
  await analyzerWorker.close()
  process.exit(0)
})
