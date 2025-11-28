import { logger } from './utils/logger'

interface MashupTrack {
  id: string
  fileName: string
  storageUrl: string
  originalName: string
  detectedBpm?: number
  detectedKey?: string
  durationSeconds?: number
  hasVocals?: boolean
  isInstrumental?: boolean
  position: number
}

interface MashupConfig {
  tracks: MashupTrack[]
  targetDuration: number
  userId: string
  mashupId: string
}

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

interface TimelinePlan {
  masterBpm: number
  masterKey: string
  totalDuration: number
  segments: TimelineSegment[]
  metadata: {
    analysisTime: number
    confidence: number
    algorithm: 'harmonic_vocal_priority_v1'
  }
}

export class MashupPlanner {
  /**
   * Analyze tracks and create a cohesive timeline plan
   */
  async planMashup(config: MashupConfig): Promise<TimelinePlan> {
    logger.info('Starting mashup planning', { 
      trackCount: config.tracks.length, 
      targetDuration: config.targetDuration 
    })

    try {
      // Step 1: Analyze track compatibility and choose master parameters
      const masterParams = this.selectMasterParameters(config.tracks)
      
      // Step 2: Map each track to master parameters and classify sections
      const mappedTracks = this.mapTracksToMaster(config.tracks, masterParams)
      
      // Step 3: Create timeline structure
      const timeline = this.createTimeline(mappedTracks, config.targetDuration)
      
      // Step 4: Optimize for musical flow
      const optimizedTimeline = this.optimizeTimeline(timeline, config.tracks)
      
      const plan: TimelinePlan = {
        masterBpm: masterParams.bpm,
        masterKey: masterParams.key,
        totalDuration: optimizedTimeline.reduce((sum, seg) => sum + seg.duration, 0),
        segments: optimizedTimeline,
        metadata: {
          analysisTime: Date.now(),
          confidence: this.calculateOptimizationConfidence(optimizedTimeline),
          algorithm: 'harmonic_vocal_priority_v1'
        }
      }

      logger.info('Mashup planning completed', {
        masterBpm: plan.masterBpm,
        masterKey: plan.masterKey,
        totalDuration: plan.totalDuration,
        segmentCount: plan.segments.length,
        confidence: plan.metadata.confidence
      })

      return plan
    } catch (error) {
      logger.error('Error in mashup planning:', error)
      throw new Error('Failed to plan mashup')
    }
  }

  /**
   * Select master BPM and key based on track analysis
   */
  private selectMasterParameters(tracks: MashupTrack[]): { bpm: number; key: string } {
    logger.debug('Selecting master parameters', { trackCount: tracks.length })

    // For tracks with detected BPM, calculate median
    const bpmValues = tracks
      .filter(t => t.detectedBpm && t.detectedBpm > 0)
      .map(t => t.detectedBpm!)

    let masterBpm: number
    if (bpmValues.length > 0) {
      // Use median BPM for better beat matching
      masterBpm = this.median(bpmValues)
      // Round to nearest common BPM range (60-180)
      masterBpm = Math.round(masterBpm)
    } else {
      // Default to common genre BPM
      masterBpm = 120
    }

    // Select master key by finding most compatible
    const keyCounts = tracks
      .filter(t => t.detectedKey)
      .reduce((acc, track) => {
        const key = track.detectedKey!
        acc[key] = (acc[key] || 0) + 1
        return acc
      }, {} as Record<string, number>)

    const masterKey = Object.keys(keyCounts).length > 0 
      ? Object.keys(keyCounts).reduce((a, b) => keyCounts[a] > keyCounts[b] ? a : b)
      : 'C' // Default to C major

    logger.debug('Master parameters selected', { bpm: masterBpm, key: masterKey })
    return { bpm: masterBpm, key: masterKey }
  }

  /**
   * Map each track to master parameters and classify sections
   */
  private mapTracksToMaster(tracks: MashupTrack[], masterParams: { bpm: number; key: string }) {
    return tracks.map(track => {
      const pitchShift = track.detectedBpm && track.detectedKey 
        ? this.calculatePitchShift(track.detectedKey, masterParams.key)
        : 0

      const timeStretch = track.detectedBpm && track.detectedBpm > 0
        ? track.detectedBpm / masterParams.bpm
        : 1.0

      // Classify track type based on analysis
      const trackType = this.classifyTrack(track)

      return {
        ...track,
        mappedBpm: track.detectedBpm ? masterParams.bpm : track.detectedBpm,
        mappedKey: masterParams.key,
        transformations: {
          pitchShift,
          timeStretch
        },
        type: trackType
      }
    })
  }

  /**
   * Create initial timeline structure
   */
  private createTimeline(mappedTracks: MashupTrack[] & { type: string }[], targetDuration: number): TimelineSegment[] {
    const timeline: TimelineSegment[] = []
    let currentTime = 0

    // Identify backbone instrumental tracks
    const backboneTracks = mappedTracks.filter(t => t.type === 'backbone' && t.detectedBpm)
    const vocalTracks = mappedTracks.filter(t => t.hasVocals)
    const bridgeTracks = mappedTracks.filter(t => !t.hasVocals && t.type === 'bridge')

    // Structure: Intro (30s) -> Main Body (targetDuration-60s) -> Outro (30s)
    const introDuration = Math.min(30, targetDuration * 0.15)
    const outroDuration = Math.min(30, targetDuration * 0.15)
    const mainBodyDuration = targetDuration - introDuration - outroDuration

    // Intro: Build atmosphere with instrumental
    if (backboneTracks.length > 0) {
      const introTrack = backboneTracks[0]
      const segment: TimelineSegment = {
        trackId: introTrack.id,
        startTime: currentTime,
        duration: introDuration,
        endTime: currentTime + introDuration,
        transformations: {
          ...introTrack.transformations,
          fadeIn: 3,
          gain: 0.7
        },
        type: 'backbone'
      }
      timeline.push(segment)
      currentTime += introDuration
    }

    // Main Body: Alternating backbone and vocal layers
    if (mainBodyDuration > 0 && backboneTracks.length > 0) {
      const backboneSegmentDuration = mainBodyDuration / Math.ceil(backboneTracks.length)
      
      backboneTracks.forEach((backboneTrack, index) => {
        const segmentDuration = Math.min(backboneSegmentDuration, mainBodyDuration - currentTime + introDuration)
        
        if (segmentDuration > 0) {
          // Check if we can overlay vocals
          const availableVocalTrack = vocalTracks[index % vocalTracks.length]
          const hasVocalOverlay = availableVocalTrack && backboneTrack.detectedKey === availableVocalTrack.detectedKey
          
          const segment: TimelineSegment = {
            trackId: backboneTrack.id,
            startTime: currentTime,
            duration: segmentDuration,
            endTime: currentTime + segmentDuration,
            transformations: {
              ...backboneTrack.transformations,
              fadeIn: index === 0 ? 2 : 1,
              fadeOut: index === backboneTracks.length - 1 ? 3 : 1,
              gain: hasVocalOverlay ? 0.6 : 0.8
            },
            type: hasVocalOverlay ? 'backbone' : 'backbone'
          }
          timeline.push(segment)
          currentTime += segmentDuration

          // Add vocal overlay if compatible
          if (hasVocalOverlay) {
            const vocalSegment: TimelineSegment = {
              trackId: availableVocalTrack.id,
              startTime: currentTime - segmentDuration,
              duration: segmentDuration * 0.6, // Vocals for 60% of segment
              endTime: currentTime - segmentDuration * 0.4,
              transformations: {
                ...availableVocalTrack.transformations,
                fadeIn: 1,
                fadeOut: 1,
                gain: 0.8
              },
              type: 'vocal'
            }
            timeline.push(vocalSegment)
          }
        }
      })
    }

    // Outro: Fade out with atmospheric element
    if (outroDuration > 0 && bridgeTracks.length > 0) {
      const outroTrack = bridgeTracks[0]
      const segment: TimelineSegment = {
        trackId: outroTrack.id,
        startTime: currentTime,
        duration: outroDuration,
        endTime: currentTime + outroDuration,
        transformations: {
          ...outroTrack.transformations,
          fadeOut: 5,
          gain: 0.5
        },
        type: 'outro'
      }
      timeline.push(segment)
    }

    return timeline
  }

  /**
   * Optimize timeline for musical flow and coherence
   */
  private optimizeTimeline(timeline: TimelineSegment[], originalTracks: MashupTrack[]): TimelineSegment[] {
    // Sort segments by start time
    const sortedTimeline = [...timeline].sort((a, b) => a.startTime - b.startTime)

    // Ensure no overlaps (except for intentional vocal overlays)
    const optimized = sortedTimeline.reduce((acc, segment) => {
      const lastNonVocalSegment = acc.filter(s => s.type !== 'vocal').pop()
      
      if (segment.type === 'vocal' && lastNonVocalSegment && 
          segment.startTime < lastNonVocalSegment.endTime) {
        // Allow vocal overlap with backbone
        acc.push(segment)
      } else if (!lastNonVocalSegment || segment.startTime >= lastNonVocalSegment.endTime) {
        // Start backbone/outro segments after previous non-vocal
        acc.push(segment)
      } else {
        // Adjust timing to avoid overlap
        const adjustedSegment = {
          ...segment,
          startTime: lastNonVocalSegment.endTime,
          endTime: lastNonVocalSegment.endTime + segment.duration
        }
        acc.push(adjustedSegment)
      }
      
      return acc
    }, [] as TimelineSegment[])

    return optimized
  }

  /**
   * Classify track type based on analysis
   */
  private classifyTrack(track: MashupTrack): 'backbone' | 'vocal' | 'bridge' | 'outro' {
    if (track.hasVocals && !track.isInstrumental) {
      return 'vocal'
    } else if (track.isInstrumental && track.detectedBpm && track.detectedBpm >= 100) {
      return 'backbone'
    } else if (track.isInstrumental) {
      return 'bridge'
    } else {
      return 'outro'
    }
  }

  /**
   * Calculate pitch shift needed to move to target key
   */
  private calculatePitchShift(sourceKey: string, targetKey: string): number {
    const keyMap: { [key: string]: number } = {
      'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
      'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
      'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
    }

    const sourceSemitones = keyMap[sourceKey.replace('m', '')] || 0
    const targetSemitones = keyMap[targetKey.replace('m', '')] || 0
    
    return targetSemitones - sourceSemitones
  }

  /**
   * Calculate median value from array
   */
  private median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid]
  }

  /**
   * Calculate confidence score for the mashup plan
   */
  private calculateOptimizationConfidence(timeline: TimelineSegment[]): number {
    // Base confidence
    let confidence = 0.7

    // Increase confidence based on segment diversity
    const segmentTypes = new Set(timeline.map(s => s.type))
    confidence += (segmentTypes.size - 1) * 0.05

    // Increase confidence for balanced distribution
    const backboneSegments = timeline.filter(s => s.type === 'backbone').length
    const vocalSegments = timeline.filter(s => s.type === 'vocal').length
    if (backboneSegments > 0 && vocalSegments > 0 && vocalSegments / backboneSegments < 0.5) {
      confidence += 0.1
    }

    // Ensure confidence doesn't exceed 1.0
    return Math.min(confidence, 1.0)
  }
}
