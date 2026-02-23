import { logger } from './utils/logger'
import { config as serviceConfig } from './utils/config'
import { emitTelemetry, withTelemetry } from './utils/telemetry'
import { evaluatePlannerRules } from './planning/rules-engine'
import { getPlannerRulePack } from './planning/rules'
import type { PlannerDecisionTrace, PlannerPhase, PlannerRulePack, PlannerTrackType } from './planning/types'

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
  plannerDebugTrace?: boolean
}

interface MashupConfig {
  tracks: MashupTrack[]
  targetDuration: number
  userId: string
  mashupId: string
  plannerDebugTrace?: boolean
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
    algorithm: 'harmonic_vocal_priority_v1' | 'harmonic_vocal_priority_v1_rules'
    ruleBasedPlannerEnabled?: boolean
    plannerDebugTraceEnabled?: boolean
    rulePackId?: string
    decisionTraces?: PlannerDecisionTrace[]
    ruleEvaluations?: number
  }
}

type MappedTrack = MashupTrack & {
  mappedBpm?: number
  mappedKey: string
  transformations: {
    pitchShift: number
    timeStretch: number
  }
  type: PlannerTrackType
}

type SegmentPolicy = {
  fadeIn?: number
  fadeOut?: number
  gain?: number
  rulesFired: string[]
}

type PlannerRuleOptions = {
  enableRules: boolean
  traceEnabled: boolean
  decisionTraces: PlannerDecisionTrace[]
  rulePack: PlannerRulePack
}

export class MashupPlanner {
  async planMashup(config: MashupConfig): Promise<TimelinePlan> {
    const plannerInput = {
      trackCount: config.tracks.length,
      targetDuration: config.targetDuration,
      mashupId: config.mashupId,
      ruleBasedPlannerEnabled: serviceConfig.featureFlags.ruleBasedPlanner
    }

    logger.info('Starting mashup planning', plannerInput)

    return withTelemetry('planner', 'plan_mashup', async () => {
      try {
        const ruleBasedEnabled = serviceConfig.featureFlags.ruleBasedPlanner
        const plannerDebugTraceEnabled = ruleBasedEnabled && (config.plannerDebugTrace ?? serviceConfig.featureFlags.plannerDebugTrace)
        const rulePack = getPlannerRulePack(serviceConfig.planner.rulePackId)
        if (!rulePack) {
          throw new Error(`Rule pack not found: ${serviceConfig.planner.rulePackId}`)
        }
        const decisionTraces: PlannerDecisionTrace[] = []
        let ruleEvaluations = 0

        const ruleOptions: PlannerRuleOptions = {
          enableRules: ruleBasedEnabled,
          traceEnabled: plannerDebugTraceEnabled,
          decisionTraces,
          rulePack
        }

        const phaseStartedAt = Date.now()
        const masterParams = this.selectMasterParameters(config.tracks)
        emitTelemetry({
          area: 'planner',
          event: 'select_master_parameters',
          status: 'success',
          durationMs: Date.now() - phaseStartedAt,
          trackCount: config.tracks.length
        })

        const mapStartedAt = Date.now()
        const mappedTracksResult = await this.mapTracksToMaster(config.tracks, masterParams, ruleOptions)
        ruleEvaluations += mappedTracksResult.ruleEvaluations
        const mappedTracks = mappedTracksResult.tracks
        emitTelemetry({
          area: 'planner',
          event: 'map_tracks_to_master',
          status: 'success',
          durationMs: Date.now() - mapStartedAt,
          mappedTrackCount: mappedTracks.length,
          ruleBasedPlannerEnabled: ruleBasedEnabled,
          ruleEvaluations: mappedTracksResult.ruleEvaluations
        })

        const timelineStartedAt = Date.now()
        const timelineResult = await this.createTimeline(mappedTracks, config.targetDuration, ruleOptions)
        ruleEvaluations += timelineResult.ruleEvaluations
        const timeline = timelineResult.timeline
        emitTelemetry({
          area: 'planner',
          event: 'create_timeline',
          status: 'success',
          durationMs: Date.now() - timelineStartedAt,
          segmentCount: timeline.length,
          ruleBasedPlannerEnabled: ruleBasedEnabled,
          ruleEvaluations: timelineResult.ruleEvaluations,
          decisionTraceCount: plannerDebugTraceEnabled ? decisionTraces.length : 0
        })

        const optimizeStartedAt = Date.now()
        const optimizedTimeline = this.optimizeTimeline(timeline)
        emitTelemetry({
          area: 'planner',
          event: 'optimize_timeline',
          status: 'success',
          durationMs: Date.now() - optimizeStartedAt,
          segmentCount: optimizedTimeline.length
        })

        const plan: TimelinePlan = {
          masterBpm: masterParams.bpm,
          masterKey: masterParams.key,
          totalDuration: optimizedTimeline.reduce((sum, seg) => sum + seg.duration, 0),
          segments: optimizedTimeline,
          metadata: {
            analysisTime: Date.now(),
            confidence: this.calculateOptimizationConfidence(optimizedTimeline),
            algorithm: ruleBasedEnabled ? 'harmonic_vocal_priority_v1_rules' : 'harmonic_vocal_priority_v1',
            ruleBasedPlannerEnabled: ruleBasedEnabled,
            plannerDebugTraceEnabled,
            rulePackId: ruleBasedEnabled ? rulePack.id : undefined,
            decisionTraces: plannerDebugTraceEnabled ? decisionTraces : undefined,
            ruleEvaluations: ruleBasedEnabled ? ruleEvaluations : undefined
          }
        }

        if (ruleBasedEnabled) {
          emitTelemetry({
            area: 'planner',
            event: 'rule_trace_summary',
            status: 'success',
            rulePackId: rulePack.id,
            plannerDebugTraceEnabled,
            decisionTraceCount: plannerDebugTraceEnabled ? decisionTraces.length : 0,
            ruleEvaluations
          })
        }

        logger.info('Mashup planning completed', {
          masterBpm: plan.masterBpm,
          masterKey: plan.masterKey,
          totalDuration: plan.totalDuration,
          segmentCount: plan.segments.length,
          confidence: plan.metadata.confidence,
          ruleBasedPlannerEnabled: ruleBasedEnabled,
          plannerDebugTraceEnabled,
          rulePackId: plan.metadata.rulePackId,
          decisionTraceCount: plannerDebugTraceEnabled ? decisionTraces.length : 0
        })

        return plan
      } catch (error) {
        logger.error('Error in mashup planning:', error)
        throw new Error('Failed to plan mashup')
      }
    }, plannerInput)
  }

  private selectMasterParameters(tracks: MashupTrack[]): { bpm: number; key: string } {
    logger.debug('Selecting master parameters', { trackCount: tracks.length })

    const bpmValues = tracks
      .filter(t => t.detectedBpm && t.detectedBpm > 0)
      .map(t => t.detectedBpm!)

    let masterBpm: number
    if (bpmValues.length > 0) {
      masterBpm = this.median(bpmValues)
      masterBpm = Math.round(masterBpm)
    } else {
      masterBpm = 120
    }

    const keyCounts = tracks
      .filter(t => t.detectedKey)
      .reduce((acc, track) => {
        const key = track.detectedKey!
        acc[key] = (acc[key] || 0) + 1
        return acc
      }, {} as Record<string, number>)

    const masterKey = Object.keys(keyCounts).length > 0
      ? Object.keys(keyCounts).reduce((a, b) => keyCounts[a] > keyCounts[b] ? a : b)
      : 'C'

    logger.debug('Master parameters selected', { bpm: masterBpm, key: masterKey })
    return { bpm: masterBpm, key: masterKey }
  }

  private async mapTracksToMaster(
    tracks: MashupTrack[],
    masterParams: { bpm: number; key: string },
    options: PlannerRuleOptions
  ): Promise<{ tracks: MappedTrack[]; ruleEvaluations: number }> {
    let ruleEvaluations = 0
    const mapped: MappedTrack[] = []

    for (const track of tracks) {
      const pitchShift = track.detectedBpm && track.detectedKey
        ? this.calculatePitchShift(track.detectedKey, masterParams.key)
        : 0

      const timeStretch = track.detectedBpm && track.detectedBpm > 0
        ? track.detectedBpm / masterParams.bpm
        : 1.0

      let trackType: PlannerTrackType
      if (options.enableRules) {
        const classification = await this.classifyTrackWithRules(track, options.rulePack)
        trackType = classification.type
        ruleEvaluations += 1
        if (options.traceEnabled) {
          options.decisionTraces.push({
            step: 'classify_track',
            rulesFired: classification.rulesFired,
            metadata: {
              trackId: track.id,
              originalName: track.originalName,
              classifiedAs: classification.type,
              hasVocals: Boolean(track.hasVocals),
              isInstrumental: Boolean(track.isInstrumental),
              detectedBpm: track.detectedBpm ?? null
            }
          })
        }
      } else {
        trackType = this.classifyTrack(track)
      }

      mapped.push({
        ...track,
        mappedBpm: track.detectedBpm ? masterParams.bpm : track.detectedBpm,
        mappedKey: masterParams.key,
        transformations: {
          pitchShift,
          timeStretch
        },
        type: trackType
      })
    }

    return { tracks: mapped, ruleEvaluations }
  }

  private async createTimeline(
    mappedTracks: MappedTrack[],
    targetDuration: number,
    options: PlannerRuleOptions
  ): Promise<{ timeline: TimelineSegment[]; ruleEvaluations: number }> {
    const timeline: TimelineSegment[] = []
    let currentTime = 0
    let ruleEvaluations = 0

    const backboneTracks = mappedTracks.filter(t => t.type === 'backbone' && t.detectedBpm)
    const vocalTracks = mappedTracks.filter(t => t.hasVocals)
    const bridgeTracks = mappedTracks.filter(t => !t.hasVocals && t.type === 'bridge')

    const introDuration = Math.min(30, targetDuration * 0.15)
    const outroDuration = Math.min(30, targetDuration * 0.15)
    const mainBodyDuration = targetDuration - introDuration - outroDuration

    if (backboneTracks.length > 0) {
      const introTrack = backboneTracks[0]
      const introPolicy = options.enableRules
        ? await this.evaluateSegmentPolicy('intro', {
            segmentKind: 'backbone',
            segmentIndex: 0,
            isLastBackbone: backboneTracks.length === 1,
            hasVocalOverlay: false
          }, options.rulePack)
        : { gain: 0.7, fadeIn: 3, rulesFired: [] }
      if (options.enableRules) ruleEvaluations += 1

      const segment: TimelineSegment = {
        trackId: introTrack.id,
        startTime: currentTime,
        duration: introDuration,
        endTime: currentTime + introDuration,
        transformations: {
          ...introTrack.transformations,
          fadeIn: introPolicy.fadeIn,
          gain: introPolicy.gain
        },
        type: 'backbone'
      }
      timeline.push(segment)

      if (options.traceEnabled) {
        options.decisionTraces.push({
          step: 'timeline_intro_segment',
          selectedSegment: {
            trackId: segment.trackId,
            type: segment.type,
            startTime: segment.startTime,
            duration: segment.duration
          },
          rulesFired: introPolicy.rulesFired,
          rejectedAlternatives: backboneTracks.slice(1, 4).map(track => ({
            trackId: track.id,
            reason: 'Intro defaults choose first backbone track to preserve user ordering'
          })),
          metadata: { phase: 'intro', backboneTrackCount: backboneTracks.length }
        })
      }

      currentTime += introDuration
    }

    if (mainBodyDuration > 0 && backboneTracks.length > 0) {
      const backboneSegmentDuration = mainBodyDuration / Math.ceil(backboneTracks.length)

      for (let index = 0; index < backboneTracks.length; index++) {
        const backboneTrack = backboneTracks[index]
        const segmentDuration = Math.min(backboneSegmentDuration, mainBodyDuration - currentTime + introDuration)
        if (segmentDuration <= 0) continue

        const availableVocalTrack = vocalTracks.length > 0 ? vocalTracks[index % vocalTracks.length] : undefined
        const hasVocalOverlay = Boolean(
          availableVocalTrack &&
          backboneTrack.detectedKey &&
          availableVocalTrack.detectedKey &&
          backboneTrack.detectedKey === availableVocalTrack.detectedKey
        )

        const backbonePolicy = options.enableRules
          ? await this.evaluateSegmentPolicy('main', {
              segmentKind: 'backbone',
              segmentIndex: index,
              isLastBackbone: index === backboneTracks.length - 1,
              hasVocalOverlay
            }, options.rulePack)
          : {
              fadeIn: index === 0 ? 2 : 1,
              fadeOut: index === backboneTracks.length - 1 ? 3 : 1,
              gain: hasVocalOverlay ? 0.6 : 0.8,
              rulesFired: []
            }
        if (options.enableRules) ruleEvaluations += 1

        const segment: TimelineSegment = {
          trackId: backboneTrack.id,
          startTime: currentTime,
          duration: segmentDuration,
          endTime: currentTime + segmentDuration,
          transformations: {
            ...backboneTrack.transformations,
            fadeIn: backbonePolicy.fadeIn ?? (index === 0 ? 2 : 1),
            fadeOut: backbonePolicy.fadeOut ?? (index === backboneTracks.length - 1 ? 3 : 1),
            gain: backbonePolicy.gain ?? (hasVocalOverlay ? 0.6 : 0.8)
          },
          type: 'backbone'
        }
        timeline.push(segment)

        if (options.traceEnabled) {
          const rejectedAlternatives: Array<{ trackId: string; reason: string }> = []
          if (availableVocalTrack && !hasVocalOverlay) {
            rejectedAlternatives.push({
              trackId: availableVocalTrack.id,
              reason: 'Vocal overlay key mismatch with backbone segment'
            })
          }
          options.decisionTraces.push({
            step: 'timeline_main_backbone_segment',
            selectedSegment: {
              trackId: segment.trackId,
              type: segment.type,
              startTime: segment.startTime,
              duration: segment.duration
            },
            rulesFired: backbonePolicy.rulesFired,
            rejectedAlternatives,
            metadata: {
              phase: 'main',
              segmentIndex: index,
              hasVocalOverlay,
              backboneTrackId: backboneTrack.id,
              candidateVocalTrackId: availableVocalTrack?.id ?? null
            }
          })
        }

        currentTime += segmentDuration

        if (hasVocalOverlay && availableVocalTrack) {
          const vocalPolicy = options.enableRules
            ? await this.evaluateSegmentPolicy('main', {
                segmentKind: 'vocal_overlay',
                segmentIndex: index,
                isLastBackbone: index === backboneTracks.length - 1,
                hasVocalOverlay: true
              }, options.rulePack)
            : { fadeIn: 1, fadeOut: 1, gain: 0.8, rulesFired: [] }
          if (options.enableRules) ruleEvaluations += 1

          const vocalSegment: TimelineSegment = {
            trackId: availableVocalTrack.id,
            startTime: currentTime - segmentDuration,
            duration: segmentDuration * 0.6,
            endTime: currentTime - segmentDuration * 0.4,
            transformations: {
              ...availableVocalTrack.transformations,
              fadeIn: vocalPolicy.fadeIn ?? 1,
              fadeOut: vocalPolicy.fadeOut ?? 1,
              gain: vocalPolicy.gain ?? 0.8
            },
            type: 'vocal'
          }
          timeline.push(vocalSegment)

          if (options.traceEnabled) {
            options.decisionTraces.push({
              step: 'timeline_main_vocal_overlay_segment',
              selectedSegment: {
                trackId: vocalSegment.trackId,
                type: vocalSegment.type,
                startTime: vocalSegment.startTime,
                duration: vocalSegment.duration
              },
              rulesFired: vocalPolicy.rulesFired,
              metadata: {
                phase: 'main',
                segmentIndex: index,
                overlaysBackboneTrackId: backboneTrack.id
              }
            })
          }
        }
      }
    }

    if (outroDuration > 0 && bridgeTracks.length > 0) {
      const outroTrack = bridgeTracks[0]
      const outroPolicy = options.enableRules
        ? await this.evaluateSegmentPolicy('outro', {
            segmentKind: 'outro',
            segmentIndex: 0,
            isLastBackbone: false,
            hasVocalOverlay: false
          }, options.rulePack)
        : { fadeOut: 5, gain: 0.5, rulesFired: [] }
      if (options.enableRules) ruleEvaluations += 1

      const segment: TimelineSegment = {
        trackId: outroTrack.id,
        startTime: currentTime,
        duration: outroDuration,
        endTime: currentTime + outroDuration,
        transformations: {
          ...outroTrack.transformations,
          fadeOut: outroPolicy.fadeOut,
          gain: outroPolicy.gain
        },
        type: 'outro'
      }
      timeline.push(segment)

      if (options.traceEnabled) {
        options.decisionTraces.push({
          step: 'timeline_outro_segment',
          selectedSegment: {
            trackId: segment.trackId,
            type: segment.type,
            startTime: segment.startTime,
            duration: segment.duration
          },
          rulesFired: outroPolicy.rulesFired,
          rejectedAlternatives: bridgeTracks.slice(1, 4).map(track => ({
            trackId: track.id,
            reason: 'Outro defaults choose first bridge track to preserve deterministic ordering'
          })),
          metadata: { phase: 'outro', bridgeTrackCount: bridgeTracks.length }
        })
      }
    }

    return { timeline, ruleEvaluations }
  }

  private optimizeTimeline(timeline: TimelineSegment[]): TimelineSegment[] {
    const sortedTimeline = [...timeline].sort((a, b) => a.startTime - b.startTime)

    return sortedTimeline.reduce((acc, segment) => {
      const lastNonVocalSegment = acc.filter(s => s.type !== 'vocal').pop()

      if (segment.type === 'vocal' && lastNonVocalSegment && segment.startTime < lastNonVocalSegment.endTime) {
        acc.push(segment)
      } else if (!lastNonVocalSegment || segment.startTime >= lastNonVocalSegment.endTime) {
        acc.push(segment)
      } else {
        acc.push({
          ...segment,
          startTime: lastNonVocalSegment.endTime,
          endTime: lastNonVocalSegment.endTime + segment.duration
        })
      }
      return acc
    }, [] as TimelineSegment[])
  }

  private classifyTrack(track: MashupTrack): PlannerTrackType {
    if (track.hasVocals && !track.isInstrumental) return 'vocal'
    if (track.isInstrumental && track.detectedBpm && track.detectedBpm >= 100) return 'backbone'
    if (track.isInstrumental) return 'bridge'
    return 'outro'
  }

  private async classifyTrackWithRules(
    track: MashupTrack,
    rulePack: PlannerRulePack
  ): Promise<{ type: PlannerTrackType; rulesFired: string[] }> {
    const fallback = this.classifyTrack(track)
    const result = await evaluatePlannerRules(
      rulePack,
      {
        step: 'classify_track',
        track,
        classification: fallback
      },
      {
        classification: fallback as PlannerTrackType
      }
    )

    const classification = (result.state.classification as PlannerTrackType | undefined) ?? fallback
    return { type: classification, rulesFired: result.trace.rulesFired }
  }

  private async evaluateSegmentPolicy(
    phase: PlannerPhase,
    input: {
      segmentKind: 'backbone' | 'vocal_overlay' | 'outro'
      segmentIndex: number
      isLastBackbone: boolean
      hasVocalOverlay: boolean
    },
    rulePack: PlannerRulePack
  ): Promise<SegmentPolicy> {
    const result = await evaluatePlannerRules(
      rulePack,
      {
        step: 'segment_policy',
        phase,
        segmentKind: input.segmentKind,
        segmentIndex: input.segmentIndex,
        isLastBackbone: input.isLastBackbone,
        hasVocalOverlay: input.hasVocalOverlay
      },
      {} as Record<string, unknown>
    )

    return {
      fadeIn: typeof result.state.fadeIn === 'number' ? result.state.fadeIn : undefined,
      fadeOut: typeof result.state.fadeOut === 'number' ? result.state.fadeOut : undefined,
      gain: typeof result.state.gain === 'number' ? result.state.gain : undefined,
      rulesFired: result.trace.rulesFired
    }
  }

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

  private median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
  }

  private calculateOptimizationConfidence(timeline: TimelineSegment[]): number {
    let confidence = 0.7
    const segmentTypes = new Set(timeline.map(s => s.type))
    confidence += (segmentTypes.size - 1) * 0.05

    const backboneSegments = timeline.filter(s => s.type === 'backbone').length
    const vocalSegments = timeline.filter(s => s.type === 'vocal').length
    if (backboneSegments > 0 && vocalSegments > 0 && vocalSegments / backboneSegments < 0.5) {
      confidence += 0.1
    }

    return Math.min(confidence, 1.0)
  }
}
