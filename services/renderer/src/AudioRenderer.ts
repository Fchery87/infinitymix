import AWS from 'aws-sdk'
import ffmpeg from 'fluent-ffmpeg'
import { logger } from './utils/logger'
import { config } from './utils/config'
import * as fs from 'fs'
import * as path from 'path'
import { promisify } from 'util'

interface TimelineSegment {
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
}

interface TrackInfo {
  id: string
  fileName: string
  storageUrl: string
  originalName: string
  detectedBpm?: number
  detectedKey?: string
  durationSeconds?: number
  hasVocals?: boolean
  isInstrumental?: boolean
}

interface RenderingJobData {
  mashupId: string
  timelinePlan: {
    masterBpm: number
    masterKey: string
    totalDuration: number
    segments: TimelineSegment[]
  }
  userId: string
}

export class AudioRenderer {
  private s3: AWS.S3
  private tempDir: string

  constructor() {
    this.s3 = new AWS.S3({
      accessKeyId: config.aws.accessKeyId,
      secretAccessKey: config.aws.secretAccessKey,
      region: config.aws.region
    })
    
    this.tempDir = process.env.TEMP_DIR || '/tmp/audio-rendering'
    this.ensureTempDir()
  }

  /**
   * Render complete mashup from timeline plan
   */
  async renderMashup(mashupId: string, timelinePlan: RenderingJobData['timelinePlan']): Promise<string> {
    const tempDir = path.join(this.tempDir, mashupId)
    
    try {
      // Create temporary directory for this render
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
      }

      logger.info('Starting mashup rendering', { 
        mashupId, 
        duration: timelinePlan.totalDuration,
        segmentCount: timelinePlan.segments.length 
      })

      // Download all tracks needed for this mashup
      const trackFiles = await this.downloadTracks(timelinePlan.segments, tempDir)
      
      // Apply audio transformations and mix
      const outputPath = await this.renderAndMix(timelinePlan, trackFiles, tempDir)
      
      // Convert to MP3
      const mp3Path = await this.convertToMp3(outputPath, tempDir)
      
      // Upload final mashup to S3
      const storageUrl = await this.uploadMashup(mashupId, mp3Path)

      logger.info('Mashup rendering completed', { 
        mashupId, 
        outputPath: mp3Path,
        storageUrl 
      })

      return storageUrl
    } catch (error) {
      logger.error('Error rendering mashup:', { error: error instanceof Error ? error.message : 'Unknown error', mashupId })
      throw error
    } finally {
      // Clean up temporary files
      await this.cleanupTempFiles(tempDir)
    }
  }

  /**
   * Download all tracks needed for rendering
   */
  private async downloadTracks(segments: TimelineSegment[], tempDir: string): Promise<{ trackId: string; filePath: string }[]> {
    const trackIds = [...new Set(segments.map(s => s.trackId))]
    const trackFiles = []

    for (const trackId of trackIds) {
      try {
        // Get track info from database
        const trackInfo = await this.getTrackInfo(trackId)
        
        if (!trackInfo || !trackInfo.storageUrl) {
          throw new Error(`Track ${trackId} not found or no storage URL`)
        }

        // Extract filename from storage URL
        const fileName = trackInfo.storageUrl.split('/').pop() || `${trackInfo.fileName}`
        const localPath = path.join(tempDir, fileName)

        // Download from S3
        const audioBuffer = await this.downloadFile(trackInfo.fileName)
        await fs.promises.writeFile(localPath, audioBuffer)

        trackFiles.push({
          trackId,
          filePath: localPath
        })

        logger.debug('Track downloaded for rendering', { trackId, localPath })
      } catch (error) {
        logger.error('Error downloading track for rendering:', { error: error instanceof Error ? error.message : 'Unknown error', trackId })
        throw new Error(`Failed to download track ${trackId}`)
      }
    }

    return trackFiles
  }

  /**
   * Render and mix audio segments
   */
  private async renderAndMix(
    timelinePlan: RenderingJobData['timelinePlan'],
    trackFiles: { trackId: string; filePath: string }[],
    tempDir: string
  ): Promise<string> {
    logger.debug('Starting audio rendering and mixing', { segmentCount: timelinePlan.segments.length })

    // Sort segments by start time
    const sortedSegments = [...timelinePlan.segments].sort((a, b) => a.startTime - b.startTime)
    
    // Prepare individual segments with transformations
    const segmentPaths: { segmentId: string; filePath: string }[] = []
    
    for (const segment of sortedSegments) {
      const trackFile = trackFiles.find(tf => tf.trackId === segment.trackId)
      if (!trackFile) {
        throw new Error(`Track file not found for segment: ${segment.trackId}`)
      }

      const segmentPath = await this.processAudioSegment(
        trackFile.filePath,
        segment,
        tempDir
      )
      
      segmentPaths.push({
        segmentId: `${segment.trackId}_${segment.startTime}`,
        filePath: segmentPath
      })
    }

    // Mix all segments together
    const outputPath = path.join(tempDir, 'mixed_output.wav')
    await this.mixAudioSegments(segmentPaths, timelinePlan.totalDuration, outputPath)
    
    logger.debug('Audio rendering and mixing completed', { outputPath })
    return outputPath
  }

  /**
   * Apply transformations to audio segment
   */
  private async processAudioSegment(inputPath: string, segment: TimelineSegment, tempDir: string): Promise<string> {
    const outputPath = path.join(tempDir, `segment_${segment.trackId}_${segment.startTime}.wav`)
    
    return new Promise((resolve, reject) => {
      let ffmpegCommand = ffmpeg(inputPath)

      // Apply pitch shifting if needed
      if (segment.transformations.pitchShift && segment.transformations.pitchShift !== 0) {
        // Note: FFmpeg doesn't have direct pitch shifting without affecting speed
        // This would require additional audio processing libraries
        // For now, we'll use tempo adjustment as a proxy
        const pitchFactor = Math.pow(2, segment.transformations.pitchShift / 12)
        ffmpegCommand = ffmpegCommand.audioFilters(`asetrate=44100*${pitchFactor},aresample=44100`)
      }

      // Apply time stretching if needed
      if (segment.transformations.timeStretch && segment.transformations.timeStretch !== 1.0) {
        ffmpegCommand = ffmpegCommand.audioFilters(`atempo=${segment.transformations.timeStretch}`)
      }

      // Apply normalization
      if (segment.transformations.gain) {
        ffmpegCommand = ffmpegCommand.audioFilters(`volume=${segment.transformations.gain}`)
      }

      // Apply fade in
      if (segment.transformations.fadeIn && segment.transformations.fadeIn > 0) {
        ffmpegCommand = ffmpegCommand.audioFilters(`afade=t=in:st=0:d=${segment.transformations.fadeIn}`)
      }

      // Apply fade out
      if (segment.transformations.fadeOut && segment.transformations.fadeOut > 0) {
        const fadeOutStart = segment.duration - segment.transformations.fadeOut
        ffmpegCommand = ffmpegCommand.audioFilters(`afade=t=out:st=${fadeOutStart}:d=${segment.transformations.fadeOut}`)
      }

      // Trim to segment duration
      ffmpegCommand = ffmpegCommand.duration(segment.duration)

      // Output format
      ffmpegCommand = ffmpegCommand
        .format('wav')
        .audioCodec('pcm_s16le')
        .audioChannels(2)
        .audioFrequency(44100)
        .on('end', () => {
          logger.debug('Audio segment processed', { 
            trackId: segment.trackId, 
            startTime: segment.startTime,
            outputPath 
          })
          resolve(outputPath)
        })
        .on('error', (error) => {
          logger.error('Error processing audio segment:', { error: error.message, trackId: segment.trackId })
          reject(error)
        })
        .save(outputPath)
    })
  }

  /**
   * Mix multiple audio segments into single output
   */
  private async mixAudioSegments(
    segmentPaths: { segmentId: string; filePath: string }[],
    totalDuration: number,
    outputPath: string
  ): Promise<void> {
    logger.debug('Mixing audio segments', { segmentCount: segmentPaths.length, totalDuration })

    return new Promise((resolve, reject) => {
      let ffmpegCommand = ffmpeg()

      // Add all segments to the mix with appropriate timing
      const segments = segmentPaths.map(({ segmentId, filePath }) => {
        const [trackId, startTimeStr] = segmentId.split('_')
        const startTime = parseFloat(startTimeStr)
        
        return ffmpegCommand
          .input(filePath)
          .inputOptions([`-ss ${startTime * 1000}ms`]) // Start at segment start time
      })

      // Mix with silence padding to achieve total duration
      ffmpegCommand = ffmpegCommand
        .complexFilter([
          // Create a silence track of the total duration
          `anullsrc=channel_layout=stereo:sample_rate=44100[bg]`,
          // Mix all audio inputs
          `[bg]${segmentPaths.map((_, i) => `[${i}:a]`).join('')}amix=inputs=${segmentPaths.length + 1}:duration=longest[out]`
        ])
        .outputOptions([
          '-map [out]',
          '-t', totalDuration.toString()
        ])
        .format('wav')
        .audioCodec('pcm_s16le')
        .audioChannels(2)
        .audioFrequency(44100)
        .on('end', () => {
          logger.debug('Audio segments mixed successfully', { outputPath })
          resolve()
        })
        .on('error', (error) => {
          logger.error('Error mixing audio segments:', error)
          reject(error)
        })
        .save(outputPath)
    })
  }

  /**
   * Convert WAV to MP3
   */
  private async convertToMp3(wavPath: string, tempDir: string): Promise<string> {
    const mp3Path = path.join(tempDir, `mashup_${Date.now()}.mp3`)
    
    return new Promise((resolve, reject) => {
      ffmpeg(wavPath)
        .format('mp3')
        .audioCodec('libmp3lame')
        .audioBitrate('192k')
        .audioChannels(2)
        .audioFrequency(44100)
        .on('end', () => {
          logger.debug('Audio converted to MP3', { mp3Path })
          resolve(mp3Path)
        })
        .on('error', (error) => {
          logger.error('Error converting to MP3:', error)
          reject(error)
        })
        .save(mp3Path)
    })
  }

  /**
   * Upload rendered mashup to S3
   */
  private async uploadMashup(mashupId: string, localPath: string): Promise<string> {
    try {
      const fileName = `mashup_${mashupId}_${Date.now()}.mp3`
      const fileBuffer = await fs.promises.readFile(localPath)

      const uploadParams = {
        Bucket: config.aws.s3Bucket,
        Key: `mashups/${fileName}`,
        Body: fileBuffer,
        ContentType: 'audio/mpeg',
        Metadata: {
          mashupId,
          fileType: 'mashup',
          renderedAt: new Date().toISOString()
        }
      }

      const result = await this.s3.upload(uploadParams).promise()

      logger.info('Mashup uploaded to S3', { 
        fileName, 
        location: result.Location,
        mashupId
      })

      return result.Location
    } catch (error) {
      logger.error('Error uploading mashup to S3:', error)
      throw new Error('Failed to upload mashup')
    }
  }

  /**
   * Download file from S3
   */
  private async downloadFile(fileName: string): Promise<Buffer> {
    try {
      const downloadParams = {
        Bucket: config.aws.s3Bucket,
        Key: `uploads/${fileName}`
      }

      const result = await this.s3.getObject(downloadParams).promise()
      
      if (!result.Body) {
        throw new Error('File not found in S3')
      }

      return result.Body as Buffer
    } catch (error) {
      logger.error('Error downloading file from S3:', error)
      throw new Error('Failed to download file')
    }
  }

  /**
   * Get track info from database
   */
  private async getTrackInfo(trackId: string): Promise<TrackInfo | null> {
    try {
      const { PrismaClient } = require('@prisma/client')
      const prisma = new PrismaClient()
      
      const track = await prisma.uploadedTrack.findUnique({
        where: { id: trackId },
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
      })

      await prisma.$disconnect()
      return track
    } catch (error) {
      logger.error('Error getting track info:', error)
      return null
    }
  }

  /**
   * Update mashup output info in database
   */
  async updateMashupOutput(mashupId: string, storageUrl: string, outputFileSize: number): Promise<void> {
    try {
      const { PrismaClient } = require('@prisma/client')
      const prisma = new PrismaClient()
      
      await prisma.mashup.update({
        where: { id: mashupId },
        data: {
          outputStorageUrl: storageUrl,
          outputFileSize: BigInt(outputFileSize),
          generationStatus: 'COMPLETED'
        }
      })
      
      await prisma.$disconnect()
      
      logger.info('Mashup output updated', { mashupId, storageUrl, outputFileSize })
    } catch (error) {
      logger.error('Error updating mashup output:', error)
      throw new Error('Failed to update mashup output')
    }
  }

  /**
   * Mark mashup rendering as failed
   */
  async markRenderingFailed(mashupId: string, errorMessage?: string): Promise<void> {
    try {
      const { PrismaClient } = require('@prisma/client')
      const prisma = new PrismaClient()
      
      await prisma.mashup.update({
        where: { id: mashupId },
        data: { generationStatus: 'FAILED' }
      })
      
      await prisma.$disconnect()
      
      logger.error('Mashup rendering failed', { mashupId, errorMessage })
    } catch (error) {
      logger.error('Error marking rendering as failed:', error)
      // Don't throw here as this is called from error handlers
    }
  }

  /**
   * Clean up temporary files
   */
  private async cleanupTempFiles(tempDir: string): Promise<void> {
    try {
      if (fs.existsSync(tempDir)) {
        await fs.promises.rmdir(tempDir, { recursive: true })
        logger.debug('Temporary files cleaned up', { tempDir })
      }
    } catch (error) {
      logger.error('Error cleaning up temporary files:', { error, tempDir })
    }
  }

  /**
   * Ensure temp directory exists
   */
  private ensureTempDir(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true })
      logger.info('Created temporary directory', { tempDir: this.tempDir })
    }
  }
}
