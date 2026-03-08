'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Zap, Mic2, Music2, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { FileUpload } from '@/components/file-upload';
import { TrackList, Track } from '@/components/track-list';
import { DurationPicker, DurationPreset } from '@/components/duration-picker';
import { overallCompatibility, camelotCompatible } from '@/lib/utils/audio-compat';
import { ProjectSelector } from '@/components/projects/project-selector';
import { CreateProjectModal } from '@/components/projects/create-project-modal';
import { getPublicAudioPipelineFeatureFlags } from '@/lib/audio/feature-flags';
import { startResumableUpload, buildTusMetadata } from '@/lib/audio/resumable-upload';
import { collectBrowserAnalysisHintsForUpload } from '@/lib/audio/browser-analysis/client';
import {
  assignAudioRolloutVariant,
  buildUploadRolloutStableKey,
  type AudioRolloutOverride,
} from '@/lib/audio/rollouts';
import {
  buildTransitionAutomationPlan,
  createPreviewGraph,
  getPreviewGraphCapabilities,
  type PreviewGraph,
  type PreviewGraphCapabilities,
  type PreviewTransitionStyle,
} from '@/lib/audio/preview-graph';
import { emitAudioPipelineTelemetry } from '@/lib/audio/telemetry';
import { recordPreviewQaTelemetry } from '@/lib/audio/preview-qa-telemetry';

type TransitionStyle =
  | 'smooth'
  | 'drop'
  | 'energy'
  | 'cut'
  | 'filter_sweep'
  | 'echo_reverb'
  | 'backspin'
  | 'tape_stop'
  | 'stutter_edit'
  | 'three_band_swap'
  | 'bass_drop'
  | 'snare_roll'
  | 'noise_riser'
  | 'vocal_handoff'
  | 'bass_swap'
  | 'reverb_wash'
  | 'echo_out';

type TransitionStyleOption = {
  id: TransitionStyle;
  name: string;
  description?: string;
  category?: string;
  duration?: number;
};

type StylePackOption = {
  id: string;
  name: string;
  description?: string;
  schemaVersion: string;
  isBuiltIn?: boolean;
  energyProfile: 'steady' | 'build' | 'wave';
  defaultTransitionStyle: TransitionStyle;
};

type MixMode = 'standard' | 'stem_mashup' | 'auto_dj';
type TrackAnalysisFilter = 'all' | 'browser_hint' | 'standard';

type PublicPipelineConfig = {
  featureFlags: ReturnType<typeof getPublicAudioPipelineFeatureFlags>;
  rollouts: {
    section_tagging: {
      domain: 'section_tagging';
      featureEnabled: boolean;
      candidatePercent: number;
      salt: string;
      override: AudioRolloutOverride | null;
    };
  };
};

type ActiveGeneration = {
  mashupId: string;
  automationJobId?: string | null;
  label: string;
};

type MashupStatusResponse = {
  id: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  latest_automation_job?: {
    id: string;
    status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
    last_error?: string | null;
  } | null;
};

const GENERATION_POLL_INTERVAL_MS = 3000;

export default function CreatePage() {
  const audioFeatureFlags = getPublicAudioPipelineFeatureFlags();
  const [isAuthenticated] = useState(true); // Auto-logged in for development
  const [uploadedTracks, setUploadedTracks] = useState<Track[]>([]);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [trackAnalysisFilter, setTrackAnalysisFilter] = useState<TrackAnalysisFilter>('all');
  const [trackQualityCounts, setTrackQualityCounts] = useState<Record<string, number>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [preAnalysisMessage, setPreAnalysisMessage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [durationPreset, setDurationPreset] = useState<DurationPreset>('2_minutes');
  const [customDurationSeconds, setCustomDurationSeconds] = useState<number | null>(180);
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);
  const [activeGeneration, setActiveGeneration] = useState<ActiveGeneration | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isBrowserPreviewing, setIsBrowserPreviewing] = useState(false);
  const [browserPreviewMessage, setBrowserPreviewMessage] = useState<string | null>(null);
  const [browserPreviewCapabilities, setBrowserPreviewCapabilities] = useState<PreviewGraphCapabilities | null>(null);
  const [isSmartMixing, setIsSmartMixing] = useState(false);
  const [transitionStyles, setTransitionStyles] = useState<TransitionStyleOption[]>([]);
  const [stylePacks, setStylePacks] = useState<StylePackOption[]>([]);
  const [selectedStylePackId, setSelectedStylePackId] = useState<string | null>(null);
  const [audioPipelineConfig, setAudioPipelineConfig] = useState<PublicPipelineConfig | null>(null);
  const stemMashupAvailable = false;
  
  // Project-related state
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  
  // Stem mashup mode
  const [mixMode, setMixMode] = useState<MixMode>('standard');
  const [vocalTrackId, setVocalTrackId] = useState<string | null>(null);
  const [instrumentalTrackId, setInstrumentalTrackId] = useState<string | null>(null);
  const [autoKeyMatch, setAutoKeyMatch] = useState(true);
  const [autoDjEnergyMode, setAutoDjEnergyMode] = useState<'steady' | 'build' | 'wave'>('steady');
  const [autoDjTransitionStyle, setAutoDjTransitionStyle] = useState<TransitionStyle>('smooth');
  const [autoDjTargetBpm, setAutoDjTargetBpm] = useState<number | null>(null);
  const [preferStems, setPreferStems] = useState(true);
  const [keepOrder, setKeepOrder] = useState(false);
  const [eventType, setEventType] = useState<'wedding' | 'birthday' | 'sweet16' | 'club' | 'default'>('default');
  const [beatAlign, setBeatAlign] = useState(true);
  const [beatAlignMode, setBeatAlignMode] = useState<'downbeat' | 'any'>('downbeat');
  const [crossfadeEnabled, setCrossfadeEnabled] = useState(false);
  const [crossfadeStyle, setCrossfadeStyle] = useState<TransitionStyle>('smooth');
  const [crossfadeDuration, setCrossfadeDuration] = useState(4);
  const [browserPreviewTrackAId, setBrowserPreviewTrackAId] = useState<string | null>(null);
  const [browserPreviewTrackBId, setBrowserPreviewTrackBId] = useState<string | null>(null);
  const browserPreviewGraphRef = useRef<PreviewGraph | null>(null);
  const browserPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scoreStyles = (score: number) => {
    if (score >= 0.8) return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300';
    if (score >= 0.6) return 'bg-amber-500/10 border-amber-500/30 text-amber-200';
    return 'bg-red-500/10 border-red-500/30 text-red-200';
  };

  const clearBrowserPreviewTimer = () => {
    if (browserPreviewTimerRef.current) {
      clearTimeout(browserPreviewTimerRef.current);
      browserPreviewTimerRef.current = null;
    }
  };

  const stopBrowserPreviewPlayback = useCallback(() => {
    if (browserPreviewTimerRef.current) {
      clearTimeout(browserPreviewTimerRef.current);
      browserPreviewTimerRef.current = null;
    }
    browserPreviewGraphRef.current?.stopPlayback();
    setIsBrowserPreviewing(false);
  }, []);

  const ensureBrowserPreviewGraph = useCallback(async () => {
    if (browserPreviewGraphRef.current) {
      return browserPreviewGraphRef.current;
    }
    const graph = await createPreviewGraph();
    browserPreviewGraphRef.current = graph;
    setBrowserPreviewCapabilities(graph.capabilities);
    emitAudioPipelineTelemetry('preview_graph.capability_probe', {
      area: 'preview',
      status: graph.capabilities.available ? 'success' : 'error',
      source: 'create_page',
      webAudioAvailable: graph.capabilities.webAudioAvailable,
      toneAvailable: graph.capabilities.toneAvailable,
      reason: graph.capabilities.reason,
    });
    recordPreviewQaTelemetry(
      graph.capabilities.available ? 'capability_probe' : 'capability_unavailable',
      graph.capabilities.reason
    );
    return graph;
  }, []);

  const loadTracks = useCallback(async () => {
    try {
      setIsLoadingTracks(true);
      const params = new URLSearchParams();
      if (trackAnalysisFilter !== 'all') {
        params.set('analysisQuality', trackAnalysisFilter);
      }
      const query = params.toString();
      const response = await fetch(`/api/audio/pool${query ? `?${query}` : ''}`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to load tracks');
      }
      const data = await response.json();
      const tracks = Array.isArray(data) ? data : data.tracks || [];
      setTrackQualityCounts(
        data && typeof data === 'object' && data.debug && typeof data.debug === 'object'
          ? data.debug.qualityCounts || {}
          : {}
      );
      setUploadedTracks(tracks);
      setSelectedTrackIds((current) => current.filter((id) => tracks.some((track: Track) => track.id === id && track.analysis_status === 'completed')));
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingTracks(false);
    }
  }, [trackAnalysisFilter]);

  useEffect(() => {
    void loadTracks();
  }, [loadTracks]);

  useEffect(() => {
    let cancelled = false;
    const loadAdminState = async () => {
      try {
        const res = await fetch('/api/admin/session', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) {
          setIsAdminUser(Boolean(json?.isAdmin));
        }
      } catch {
        if (!cancelled) {
          setIsAdminUser(false);
        }
      }
    };
    void loadAdminState();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const loadTransitionStyles = async () => {
      try {
        const response = await fetch('/api/mashups/djmix', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        setTransitionStyles((data.transitionStyles || []) as TransitionStyleOption[]);
        setStylePacks((data.stylePacks || []) as StylePackOption[]);
      } catch (error) {
        console.error('Failed to load transition styles:', error);
      }
    };
    void loadTransitionStyles();
  }, []);

  useEffect(() => {
    if (!audioFeatureFlags.toneJsPreviewGraph) return;
    const capabilitySnapshot = getPreviewGraphCapabilities();
    setBrowserPreviewCapabilities(capabilitySnapshot);
    emitAudioPipelineTelemetry('preview_graph.capability_detected', {
      area: 'preview',
      status: capabilitySnapshot.available ? 'success' : 'error',
      source: 'create_page_preflight',
      webAudioAvailable: capabilitySnapshot.webAudioAvailable,
      reason: capabilitySnapshot.reason,
    });
    recordPreviewQaTelemetry(
      capabilitySnapshot.available ? 'capability_detected' : 'capability_unavailable',
      capabilitySnapshot.reason
    );
  }, [audioFeatureFlags.toneJsPreviewGraph]);

  useEffect(() => {
    return () => {
      if (browserPreviewTimerRef.current) {
        clearTimeout(browserPreviewTimerRef.current);
        browserPreviewTimerRef.current = null;
      }
      browserPreviewGraphRef.current?.dispose();
      browserPreviewGraphRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadPipelineConfig = async () => {
      try {
        const response = await fetch('/api/audio/pipeline-config', { cache: 'no-store' });
        if (!response.ok) throw new Error('Failed to load audio pipeline config');
        const json = (await response.json()) as PublicPipelineConfig;
        if (!cancelled) setAudioPipelineConfig(json);
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          setAudioPipelineConfig(null);
        }
      }
    };

    void loadPipelineConfig();
    return () => {
      cancelled = true;
    };
  }, []);
 
  useEffect(() => {
    const shouldPoll = uploadedTracks.some((track) => track.analysis_status === 'pending' || track.analysis_status === 'analyzing');
    if (!shouldPoll) return;

    const interval = setInterval(() => {
      void loadTracks();
    }, 3000);

    return () => clearInterval(interval);
  }, [uploadedTracks, loadTracks]);

  const applyGenerationStatus = useCallback(
    (generation: ActiveGeneration, data: MashupStatusResponse) => {
      const jobStatus = data.latest_automation_job?.status ?? null;
      if (data.status === 'completed') {
        setGenerationMessage(
          `${generation.label} complete. Open My Mashups to play or download it.`
        );
        setActiveGeneration((current) =>
          current?.mashupId === generation.mashupId ? null : current
        );
        return true;
      }

      if (data.status === 'failed') {
        const errorSuffix = data.latest_automation_job?.last_error
          ? ` Error: ${data.latest_automation_job.last_error}`
          : '';
        setGenerationMessage(`${generation.label} failed.${errorSuffix}`);
        setActiveGeneration((current) =>
          current?.mashupId === generation.mashupId ? null : current
        );
        return true;
      }

      if (jobStatus === 'queued') {
        setGenerationMessage(`${generation.label} queued for processing...`);
      } else if (jobStatus === 'running' || data.status === 'generating') {
        setGenerationMessage(`${generation.label} is processing...`);
      } else {
        setGenerationMessage(`${generation.label} is pending...`);
      }

      return false;
    },
    []
  );

  useEffect(() => {
    if (!activeGeneration) return;

    let cancelled = false;
    let stream: EventSource | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let fallbackStarted = false;
    let receivedStreamUpdate = false;

    const stopPolling = () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };

    const closeStream = () => {
      if (stream) {
        stream.close();
        stream = null;
      }
    };

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/mashups/${activeGeneration.mashupId}`, {
          cache: 'no-store',
        });
        if (!response.ok || cancelled) return;

        const data = (await response.json()) as MashupStatusResponse;
        const finished = applyGenerationStatus(activeGeneration, data);
        if (finished) {
          stopPolling();
          closeStream();
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error);
        }
      }
    };

    const startPollingFallback = () => {
      if (fallbackStarted || cancelled) return;
      fallbackStarted = true;
      void pollStatus();
      pollInterval = setInterval(() => {
        void pollStatus();
      }, GENERATION_POLL_INTERVAL_MS);
    };

    if (typeof window === 'undefined' || typeof window.EventSource === 'undefined') {
      startPollingFallback();
    } else {
      stream = new EventSource(`/api/mashups/${activeGeneration.mashupId}/events`);
      stream.addEventListener('status', (event) => {
        if (cancelled) return;
        try {
          receivedStreamUpdate = true;
          const data = JSON.parse((event as MessageEvent<string>).data) as MashupStatusResponse;
          const finished = applyGenerationStatus(activeGeneration, data);
          if (finished) {
            stopPolling();
            closeStream();
          }
        } catch (error) {
          console.error(error);
        }
      });
      stream.addEventListener('end', () => {
        stopPolling();
        closeStream();
      });
      stream.addEventListener('error', () => {
        closeStream();
        startPollingFallback();
      });

      window.setTimeout(() => {
        if (!cancelled && !fallbackStarted && !receivedStreamUpdate) {
          startPollingFallback();
        }
      }, GENERATION_POLL_INTERVAL_MS);
    }

    return () => {
      cancelled = true;
      stopPolling();
      closeStream();
    };
  }, [activeGeneration, applyGenerationStatus]);

  const handleFileUpload = (files: FileList) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);

    const upload = async () => {
      try {
        const filesArray = Array.from(files);
        const browserAnalysisHints: Awaited<
          ReturnType<typeof collectBrowserAnalysisHintsForUpload>
        > = [];

        if (audioFeatureFlags.browserAnalysisWorker) {
          setPreAnalysisMessage('Running browser pre-analysis...');
          const sectionTaggingRollout = audioPipelineConfig?.rollouts.section_tagging;
          for (const file of filesArray) {
            const stableKey = buildUploadRolloutStableKey(file.name, file.size);
            const rolloutAssignment = assignAudioRolloutVariant({
              domain: 'section_tagging',
              stableKey,
              config: {
                domain: 'section_tagging',
                featureEnabled:
                  sectionTaggingRollout?.featureEnabled ?? audioFeatureFlags.mlSectionTagging,
                candidatePercent: sectionTaggingRollout?.candidatePercent ?? 0,
                salt: sectionTaggingRollout?.salt ?? 'section-tagging-v1',
                defaultVariant: 'control',
              },
              override: sectionTaggingRollout?.override ?? null,
            });
            const [hint] = await collectBrowserAnalysisHintsForUpload([file], {
              enabled: true,
              mlSectionTagging:
                audioFeatureFlags.mlSectionTagging &&
                rolloutAssignment.variant === 'candidate',
            });
            if (hint) {
              if (hint.analysisFeatures?.sectionTagging) {
                hint.analysisFeatures.sectionTagging.rollout = {
                  variant: rolloutAssignment.variant,
                  source: rolloutAssignment.source,
                  bucket: rolloutAssignment.bucket,
                  stableKey: rolloutAssignment.stableKey,
                };
              }
              if (hint.featureSummary) {
                hint.featureSummary.mlSectionTaggingRolloutVariant = rolloutAssignment.variant;
                hint.featureSummary.mlSectionTaggingRolloutSource = rolloutAssignment.source;
              }
              browserAnalysisHints.push(hint);
            }
          }
          if (browserAnalysisHints.length > 0) {
            setPreAnalysisMessage(
              `Browser pre-analysis complete for ${browserAnalysisHints.length}/${filesArray.length} file(s). Uploading...`
            );
          } else {
            setPreAnalysisMessage('Browser pre-analysis unavailable. Uploading and using server analysis...');
          }
        } else {
          setPreAnalysisMessage('Uploading and using server analysis...');
        }

        // Try resumable upload first if flag is enabled
        let usedResumableUpload = false;
        if (audioFeatureFlags.resumableUploads) {
          try {
            for (const file of filesArray) {
              const metadata = buildTusMetadata(
                file.name,
                file.type || 'audio/mpeg',
                'current-user', // Will be resolved server-side from session
                selectedProjectId ?? undefined
              );
              
              await startResumableUpload({
                file,
                endpoint: '/api/audio/upload/tus',
                metadata,
                onProgress: (bytesUploaded, bytesTotal) => {
                  const pct = Math.round((bytesUploaded / bytesTotal) * 100);
                  setPreAnalysisMessage(`Uploading ${file.name}... ${pct}%`);
                },
              });
            }
            usedResumableUpload = true;
            await loadTracks();
            setPreAnalysisMessage(null);
          } catch {
            // Fall through to standard upload
            console.warn('Resumable upload failed, falling back to standard upload');
          }
        }

        // Standard upload fallback
        if (!usedResumableUpload) {
          const formData = new FormData();
          filesArray.forEach((file) => formData.append('files', file));
          if (browserAnalysisHints.length > 0) {
            formData.append('browserAnalysisHints', JSON.stringify(browserAnalysisHints));
          }
          if (selectedProjectId) {
            formData.append('projectId', selectedProjectId);
          }
          const response = await fetch('/api/audio/upload', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const error = await response.json().catch(() => null);
            throw new Error(error?.error || 'Upload failed');
          }

          await loadTracks();
          setPreAnalysisMessage(null);
        }
      } catch (error) {
        console.error(error);
        setPreAnalysisMessage(null);
        alert(error instanceof Error ? error.message : 'Upload failed');
      } finally {
        setIsUploading(false);
      }
    };

    void upload();
  };

  const handleRemoveTrack = (id: string) => {
    const remove = async () => {
      try {
        const response = await fetch(`/api/audio/pool/${id}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to delete track');
        }

        setSelectedTrackIds((current) => current.filter((trackId) => trackId !== id));
        await loadTracks();
      } catch (error) {
        console.error(error);
        alert(error instanceof Error ? error.message : 'Failed to delete track');
      }
    };

    void remove();
  };

  const handleGenerateMashup = async () => {
    if (selectedTrackIds.length < 2) {
      alert('Select at least 2 analyzed tracks');
      return;
    }

    const durationMap = { '1_minute': 60, '2_minutes': 120, '3_minutes': 180, custom: customDurationSeconds ?? 180 } as const;
    const targetDuration = durationMap[durationPreset] ?? 180;

    setIsGenerating(true);
    setGenerationMessage(null);

    try {
      const response = await fetch('/api/mashups/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputFileIds: selectedTrackIds,
          durationPreset,
          durationSeconds: targetDuration,
          projectId: selectedProjectId,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to start mashup generation');
      }

      setGenerationMessage('Mashup request accepted. Queueing generation...');
      setActiveGeneration({
        mashupId: data.id,
        automationJobId: data.automation_job_id ?? null,
        label: 'Mashup',
      });
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Failed to start mashup generation');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateStemMashup = async () => {
    if (!vocalTrackId || !instrumentalTrackId) {
      alert('Select both a vocal track and an instrumental track');
      return;
    }

    // Check that both tracks have stems
    const vocalTrack = uploadedTracks.find(t => t.id === vocalTrackId);
    const instTrack = uploadedTracks.find(t => t.id === instrumentalTrackId);
    
    if (!vocalTrack?.has_stems || !instTrack?.has_stems) {
      alert('Both tracks must have stems generated. Click the scissors icon on each track first.');
      return;
    }

    setIsGenerating(true);
    setGenerationMessage(null);

    try {
      const durationMap = { '1_minute': 60, '2_minutes': 120, '3_minutes': 180, custom: customDurationSeconds ?? 180 } as const;
      const response = await fetch('/api/mashups/stem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vocalTrackId,
          instrumentalTrackId,
          autoKeyMatch,
          durationSeconds: durationMap[durationPreset as keyof typeof durationMap],
          beatAlign,
          beatAlignMode,
          projectId: selectedProjectId,
          crossfade: crossfadeEnabled
            ? {
                enabled: true,
                style: crossfadeStyle,
                duration: crossfadeDuration,
              }
            : undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to start stem mashup generation');
      }

      setGenerationMessage('Stem mashup request accepted. Preparing render...');
      setActiveGeneration({
        mashupId: data.id,
        label: 'Stem mashup',
      });
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Failed to start stem mashup');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateAutoDjMix = async () => {
    if (selectedTrackIds.length < 2) {
      alert('Select at least 2 analyzed tracks');
      return;
    }

    setIsGenerating(true);
    setGenerationMessage(null);

    try {
      const durationMap = { '1_minute': 60, '2_minutes': 120, '3_minutes': 180, custom: customDurationSeconds ?? 180 } as const;
      const targetDuration = durationMap[durationPreset as keyof typeof durationMap];

      const response = await fetch('/api/mashups/djmix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackIds: selectedTrackIds,
          targetDurationSeconds: targetDuration,
          targetBpm: autoDjTargetBpm ?? undefined,
          transitionStyle: autoDjTransitionStyle,
          energyMode: autoDjEnergyMode,
          preferStems,
          keepOrder,
          eventType,
          stylePackId: selectedStylePackId ?? undefined,
          projectId: selectedProjectId,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to start auto DJ mix');
      }

      setGenerationMessage('Auto DJ mix request accepted. Preparing render...');
      setActiveGeneration({
        mashupId: data.id,
        automationJobId: data.automation_job_id ?? null,
        label: 'Auto DJ mix',
      });
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Failed to start auto DJ mix');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePreview = async () => {
    if (selectedTrackIds.length < 2) {
      alert('Select at least 2 analyzed tracks to preview');
      return;
    }
    setIsPreviewing(true);
    setPreviewUrl(null);
    try {
      const res = await fetch('/api/mashups/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackIds: selectedTrackIds, durationSeconds: 20 }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Preview failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Failed to preview');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleSmartMix = async () => {
    try {
      setIsSmartMixing(true);
      const res = await fetch('/api/mashups/recommendations', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error('Smart mix failed');
      }
      const data = await res.json();
      if (Array.isArray(data.track_ids) && data.track_ids.length >= 2) {
        setSelectedTrackIds(data.track_ids);
        setGenerationMessage('Smart mix selected your best combination');
      }
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Smart mix failed');
    } finally {
      setIsSmartMixing(false);
    }
  };

  const completedTracks = useMemo(() => uploadedTracks.filter((t) => t.analysis_status === 'completed'), [uploadedTracks]);
  useEffect(() => {
    const selectedCompleted = selectedTrackIds.filter((id) =>
      completedTracks.some((track) => track.id === id)
    );
    setBrowserPreviewTrackAId((current) => {
      if (current && selectedCompleted.includes(current)) return current;
      return selectedCompleted[0] ?? null;
    });
    setBrowserPreviewTrackBId((current) => {
      if (current && selectedCompleted.includes(current) && current !== (selectedCompleted[0] ?? null)) {
        return current;
      }
      return selectedCompleted.find((id) => id !== (selectedCompleted[0] ?? null)) ?? null;
    });
  }, [completedTracks, selectedTrackIds]);

  const browserPreviewTracks = useMemo(() => {
    const resolveTrack = (id: string | null) =>
      id ? completedTracks.find((track) => track.id === id) ?? null : null;
    return [resolveTrack(browserPreviewTrackAId), resolveTrack(browserPreviewTrackBId)].filter(
      (track): track is Track => Boolean(track)
    );
  }, [browserPreviewTrackAId, browserPreviewTrackBId, completedTracks]);

  // Tracks with stems available for stem mashup mode
  const stemTracks = useMemo(() => completedTracks.filter((t) => t.has_stems), [completedTracks]);

  // Key compatibility info for stem mashup
  const stemKeyInfo = useMemo(() => {
    if (!vocalTrackId || !instrumentalTrackId) return null;
    const vocalTrack = stemTracks.find(t => t.id === vocalTrackId);
    const instTrack = stemTracks.find(t => t.id === instrumentalTrackId);
    if (!vocalTrack || !instTrack) return null;
    
    const vocalKey = vocalTrack.camelot_key ?? vocalTrack.musical_key;
    const instKey = instTrack.camelot_key ?? instTrack.musical_key;
    const keysCompatible = camelotCompatible(vocalKey, instKey);
    
    return {
      vocalKey,
      instKey,
      keysCompatible,
      vocalBpm: vocalTrack.bpm,
      instBpm: instTrack.bpm,
    };
  }, [vocalTrackId, instrumentalTrackId, stemTracks]);

  const anchorTrack = useMemo(() => {
    if (selectedTrackIds.length === 0) return completedTracks[0] ?? null;
    return completedTracks.find((t) => selectedTrackIds.includes(t.id)) ?? completedTracks[0] ?? null;
  }, [completedTracks, selectedTrackIds]);

  const compatibilityHints = useMemo(() => {
    if (!anchorTrack) return [] as Array<{ id: string; name: string; score: number; bpmDiff: number | null; keyOk: boolean }>;
    return completedTracks
      .filter((t) => t.id !== anchorTrack.id)
      .map((t) => {
        const { score, bpmDiff, keyOk } = overallCompatibility(
          anchorTrack.bpm,
          anchorTrack.camelot_key ?? anchorTrack.musical_key,
          {
            bpm: t.bpm,
            camelotKey: t.camelot_key ?? t.musical_key,
            beatGrid: t.beat_grid,
            waveformLite: t.waveform_lite,
            bpmConfidence: t.bpm_confidence ?? null,
            keyConfidence: t.key_confidence ?? null,
            analysisFeatures: t.analysis_features ?? null,
          },
          {
            beatGrid: anchorTrack.beat_grid,
            waveformLite: anchorTrack.waveform_lite,
            bpmConfidence: anchorTrack.bpm_confidence ?? null,
            keyConfidence: anchorTrack.key_confidence ?? null,
            analysisFeatures: anchorTrack.analysis_features ?? null,
          }
        );
        return {
          id: t.id,
          name: t.original_filename,
          score,
          bpmDiff: bpmDiff ?? null,
          keyOk,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  }, [anchorTrack, completedTracks]);

  useEffect(() => {
    if (!isBrowserPreviewing) return;
    stopBrowserPreviewPlayback();
  }, [isBrowserPreviewing, selectedTrackIds, stopBrowserPreviewPlayback]);

  const handleBrowserTransitionPreview = async () => {
    if (!browserPreviewTrackAId || !browserPreviewTrackBId || browserPreviewTrackAId === browserPreviewTrackBId) {
      setBrowserPreviewMessage('Pick two different analyzed tracks for browser FX preview.');
      return;
    }

    if (browserPreviewTracks.length < 2) {
      setBrowserPreviewMessage('Select at least 2 analyzed tracks for browser FX preview.');
      return;
    }

    const [trackA, trackB] = browserPreviewTracks;
    setPreviewUrl(null);
    setBrowserPreviewMessage(null);

    try {
      const graph = await ensureBrowserPreviewGraph();
      if (!graph.capabilities.available) {
        recordPreviewQaTelemetry('capability_unavailable', graph.capabilities.reason);
        setBrowserPreviewMessage(
          `Browser FX preview unavailable${graph.capabilities.reason ? `: ${graph.capabilities.reason}` : ''}.`
        );
        return;
      }

      stopBrowserPreviewPlayback();
      setIsBrowserPreviewing(true);

      await graph.loadPlayers({
        vocalUrl: `/api/audio/stream/track/${trackA.id}`,
        instrumentalUrl: `/api/audio/stream/track/${trackB.id}`,
      });
      graph.setMix({ vocalGain: 1, instrumentalGain: 1, wetFx: 0.22 });

      const style = (crossfadeEnabled ? crossfadeStyle : autoDjTransitionStyle) as PreviewTransitionStyle;
      const durationSeconds = Math.max(1, Math.min(12, crossfadeEnabled ? crossfadeDuration : 4));
      const plan = buildTransitionAutomationPlan(style, durationSeconds);
      await graph.playTransitionPreview(plan);
      recordPreviewQaTelemetry('preview_started', `style:${style}`);

      setBrowserPreviewMessage(
        `Browser FX preview: ${trackA.original_filename} -> ${trackB.original_filename} (${style}, ${plan.durationSeconds.toFixed(1)}s)`
      );

      clearBrowserPreviewTimer();
      browserPreviewTimerRef.current = setTimeout(() => {
        setIsBrowserPreviewing(false);
      }, Math.ceil((plan.durationSeconds + 2) * 1000));
    } catch (error) {
      setIsBrowserPreviewing(false);
      setBrowserPreviewMessage(error instanceof Error ? error.message : 'Failed to run browser FX preview');
      recordPreviewQaTelemetry('preview_failed', error instanceof Error ? error.message : 'unknown');
      emitAudioPipelineTelemetry('preview_graph.create_page_preview_failed', {
        area: 'preview',
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown browser FX preview error',
      });
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans text-foreground relative">
      {/* Navbar */}
      <header className="fixed top-0 w-full z-50 border-b border-white/5 bg-background/60 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link href="/create">
              <div className="flex items-center group cursor-pointer">
                <div className="w-10 h-10 bg-gradient-to-tr from-primary to-orange-600 rounded-xl flex items-center justify-center mr-3 shadow-lg group-hover:shadow-primary/50 transition-all duration-300">
                  <Zap className="w-6 h-6 text-white fill-white" />
                </div>
                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 group-hover:to-white transition-all">InfinityMix</h1>
              </div>
            </Link>
            <nav className="flex items-center space-x-6">
              <Link href="/projects">
                <Button variant="ghost" className="text-gray-400 hover:text-white hover:bg-white/5">Projects</Button>
              </Link>
              <Link href="/mashups">
                <Button variant="ghost" className="text-gray-400 hover:text-white hover:bg-white/5">My Mashups</Button>
              </Link>
              <Link href="/profile">
                <Button variant="ghost" className="text-gray-400 hover:text-white hover:bg-white/5">Profile</Button>
              </Link>
              {isAdminUser && (
                <Link href="/admin/audio-observability">
                  <Button variant="ghost" className="text-amber-300 hover:text-amber-200 hover:bg-amber-500/10">
                    Admin
                  </Button>
                </Link>
              )}
              <Link href="/login">
                <Button variant="outline" className="border-white/10 hover:bg-white/5 hover:text-white">Sign Out</Button>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-4">
            Unleash Your <span className="text-primary glow-text">Sonic Creativity</span>
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Drag, drop, and let our AI engine fuse your tracks into a masterpiece.
          </p>
        </motion.div>

        {/* Project Context Bar */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-6 max-w-md mx-auto relative z-30"
        >
          <ProjectSelector
            selectedProjectId={selectedProjectId}
            onProjectChange={setSelectedProjectId}
            onCreateNew={() => setIsProjectModalOpen(true)}
            className="w-full"
          />
        </motion.div>

        <div className="grid lg:grid-cols-12 gap-8 relative z-10">
          
          {/* Upload Zone (Left/Top) */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:col-span-7 space-y-6"
          >
            <FileUpload 
                onUpload={handleFileUpload} 
                isUploading={isUploading} 
            />
            
            {isLoadingTracks && (
              <p className="text-sm text-gray-500">Refreshing tracks...</p>
            )}
            {isUploading && preAnalysisMessage && (
              <p className="text-sm text-gray-400">{preAnalysisMessage}</p>
            )}
          </motion.div>

          {/* Controls & Generation (Right/Bottom) */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="lg:col-span-5 space-y-6"
          >
            {/* Settings using reusable DurationPicker */}
            <DurationPicker 
                value={durationPreset} 
                customSeconds={customDurationSeconds ?? undefined}
                onChange={(v) => {
                  setDurationPreset(v);
                  if (v !== 'custom' && customDurationSeconds === null) {
                    setCustomDurationSeconds(180);
                  }
                }}
                onCustomChange={(secs) => setCustomDurationSeconds(secs || null)}
            />

            {/* Mix Mode Selector */}
            <Card className="bg-card/60 backdrop-blur-xl border-white/10">
              <CardContent className="pt-6 space-y-3">
                <p className="text-sm text-gray-400">Mix Mode</p>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setMixMode('standard')}
                    className={`p-4 rounded-lg border transition-all ${
                      mixMode === 'standard'
                        ? 'border-primary bg-primary/10 text-white'
                        : 'border-white/10 hover:border-white/20 text-gray-400'
                    }`}
                  >
                    <Music2 className="w-5 h-5 mx-auto mb-2" />
                    <p className="text-sm font-medium">Standard Mix</p>
                    <p className="text-xs text-gray-500">Layer full tracks</p>
                  </button>
                  <button
                    onClick={() => {
                      if (stemMashupAvailable) {
                        setMixMode('stem_mashup');
                      }
                    }}
                    disabled={!stemMashupAvailable}
                    className={`p-4 rounded-lg border transition-all ${
                      mixMode === 'stem_mashup'
                        ? 'border-primary bg-primary/10 text-white'
                        : stemMashupAvailable
                          ? 'border-white/10 hover:border-white/20 text-gray-400'
                          : 'border-white/5 text-gray-600 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <Mic2 className="w-5 h-5 mx-auto mb-2" />
                    <p className="text-sm font-medium">Stem Mashup</p>
                    <p className="text-xs text-gray-500">
                      {stemMashupAvailable ? 'Vocals + Instrumental' : 'Temporarily unavailable'}
                    </p>
                  </button>
                  <button
                    onClick={() => setMixMode('auto_dj')}
                    className={`p-4 rounded-lg border transition-all ${
                      mixMode === 'auto_dj'
                        ? 'border-primary bg-primary/10 text-white'
                        : 'border-white/10 hover:border-white/20 text-gray-400'
                    }`}
                  >
                    <Zap className="w-5 h-5 mx-auto mb-2" />
                    <p className="text-sm font-medium">Auto DJ</p>
                    <p className="text-xs text-gray-500">Event-ready mix</p>
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Stem Mashup Selection - only show when in stem mode */}
            {mixMode === 'stem_mashup' && stemMashupAvailable && (
              <Card className="bg-card/60 backdrop-blur-xl border-primary/20">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <Mic2 className="w-4 h-4 text-primary" />
                    <p className="text-sm font-medium text-white">Stem Mashup Setup</p>
                  </div>
                  
                  {stemTracks.length < 2 ? (
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-400 mb-2">
                        Need at least 2 tracks with stems generated
                      </p>
                      <p className="text-xs text-gray-500">
                        Click the scissors icon on your tracks below to generate stems
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Vocal Track Selection */}
                      <div>
                        <label className="text-xs text-gray-400 mb-2 block">Take VOCALS from:</label>
                        <select
                          value={vocalTrackId || ''}
                          onChange={(e) => setVocalTrackId(e.target.value || null)}
                          className="w-full p-3 rounded-lg bg-black/30 border border-white/10 text-white text-sm focus:border-primary outline-none"
                        >
                          <option value="">Select track for vocals...</option>
                          {stemTracks.map((track) => (
                            <option key={track.id} value={track.id}>
                              {track.original_filename}
                              {track.camelot_key ? ` (${track.camelot_key})` : ''}
                              {track.analysis_quality === 'browser_hint'
                                ? ` [browser${
                                    track.browser_analysis_confidence != null
                                      ? ` ${Math.round(track.browser_analysis_confidence * 100)}%`
                                      : ''
                                  }]`
                                : track.analysis_quality
                                  ? ' [server]'
                                  : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Arrow indicator */}
                      <div className="flex justify-center">
                        <ArrowRight className="w-5 h-5 text-primary rotate-90" />
                      </div>

                      {/* Instrumental Track Selection */}
                      <div>
                        <label className="text-xs text-gray-400 mb-2 block">Take INSTRUMENTAL from:</label>
                        <select
                          value={instrumentalTrackId || ''}
                          onChange={(e) => setInstrumentalTrackId(e.target.value || null)}
                          className="w-full p-3 rounded-lg bg-black/30 border border-white/10 text-white text-sm focus:border-primary outline-none"
                        >
                          <option value="">Select track for instrumental...</option>
                          {stemTracks.map((track) => (
                            <option key={track.id} value={track.id}>
                              {track.original_filename}
                              {track.camelot_key ? ` (${track.camelot_key})` : ''}
                              {track.analysis_quality === 'browser_hint'
                                ? ` [browser${
                                    track.browser_analysis_confidence != null
                                      ? ` ${Math.round(track.browser_analysis_confidence * 100)}%`
                                      : ''
                                  }]`
                                : track.analysis_quality
                                  ? ' [server]'
                                  : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Key compatibility info */}
                      {stemKeyInfo && (
                        <div className={`p-3 rounded-lg border ${
                          stemKeyInfo.keysCompatible 
                            ? 'bg-emerald-500/10 border-emerald-500/30' 
                            : 'bg-amber-500/10 border-amber-500/30'
                        }`}>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-300">
                              {stemKeyInfo.vocalKey || '?'} → {stemKeyInfo.instKey || '?'}
                            </span>
                            <span className={stemKeyInfo.keysCompatible ? 'text-emerald-300' : 'text-amber-300'}>
                              {stemKeyInfo.keysCompatible ? 'Keys match!' : 'Will pitch-shift'}
                            </span>
                          </div>
                          {stemKeyInfo.vocalBpm && stemKeyInfo.instBpm && (
                            <div className="text-xs text-gray-500 mt-1">
                              {stemKeyInfo.vocalBpm} BPM → {stemKeyInfo.instBpm} BPM 
                              {Math.abs(stemKeyInfo.vocalBpm - stemKeyInfo.instBpm) > 5 && ' (will time-stretch)'}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Auto key match toggle */}
                      <label className="flex items-center gap-3 p-3 rounded-lg bg-black/20 border border-white/5 cursor-pointer hover:border-white/10">
                        <input
                          type="checkbox"
                          checked={autoKeyMatch}
                          onChange={(e) => setAutoKeyMatch(e.target.checked)}
                          className="h-4 w-4 accent-primary"
                        />
                        <div>
                          <p className="text-sm text-white">Auto key-match</p>
                          <p className="text-xs text-gray-500">Pitch-shift vocals to match instrumental key</p>
                        </div>
                      </label>

                      {/* Beat alignment */}
                      <div className="grid gap-2 rounded-lg bg-black/20 border border-white/5 p-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={beatAlign}
                            onChange={(e) => setBeatAlign(e.target.checked)}
                            className="h-4 w-4 accent-primary"
                          />
                          <div>
                            <p className="text-sm text-white">Beat-sync alignment</p>
                            <p className="text-xs text-gray-500">Align downbeats for tighter sync</p>
                          </div>
                        </label>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <span className="whitespace-nowrap">Mode</span>
                          <select
                            value={beatAlignMode}
                            onChange={(e) => setBeatAlignMode(e.target.value as 'downbeat' | 'any')}
                            disabled={!beatAlign}
                            className="flex-1 p-2 rounded-md bg-black/30 border border-white/10 text-white text-xs focus:border-primary outline-none disabled:opacity-50"
                          >
                            <option value="downbeat">Downbeat</option>
                            <option value="any">Nearest beat</option>
                          </select>
                        </div>
                      </div>

                      {/* Crossfade */}
                      <div className="grid gap-2 rounded-lg bg-black/20 border border-white/5 p-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={crossfadeEnabled}
                            onChange={(e) => setCrossfadeEnabled(e.target.checked)}
                            className="h-4 w-4 accent-primary"
                          />
                          <div>
                            <p className="text-sm text-white">Crossfade transition</p>
                            <p className="text-xs text-gray-500">Blend vocals and instrumental instead of hard mix</p>
                          </div>
                        </label>
                        {crossfadeEnabled && (
                           <div className="grid gap-2 sm:grid-cols-2">
                             <div className="flex flex-col gap-1">
                               <span className="text-xs text-gray-400">Style</span>
                               <select
                                 value={crossfadeStyle}
                                 onChange={(e) => {
                                   const styleId = e.target.value as TransitionStyle;
                                   const selectedStyle = transitionStyles.find(s => s.id === styleId);
                                   setCrossfadeStyle(styleId);
                                   if (selectedStyle?.duration != null) {
                                     setCrossfadeDuration(selectedStyle.duration);
                                   }
                                 }}
                                 className="w-full p-2 rounded-md bg-black/30 border-white/10 text-white text-xs focus:border-primary outline-none"
                               >
                                 {transitionStyles.length === 0 ? (
                                   <>
                                     <option value="smooth">Smooth (4s)</option>
                                     <option value="drop">Drop punch (0.5s)</option>
                                     <option value="energy">DJ style (2s)</option>
                                     <option value="cut">Hard cut</option>
                                   </>
                                 ) : (
                                   transitionStyles.map((style) => (
                                     <option key={style.id} value={style.id}>
                                       {style.name} ({style.duration}s)
                                     </option>
                                   ))
                                 )}
                               </select>
                             </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-gray-400">Duration (s)</span>
                              <input
                                type="number"
                                min={0}
                                step={0.1}
                                value={crossfadeDuration}
                                onChange={(e) => setCrossfadeDuration(Number(e.target.value) || 0)}
                                className="w-full p-2 rounded-md bg-black/30 border border-white/10 text-white text-xs focus:border-primary outline-none"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Auto DJ options */}
            {mixMode === 'auto_dj' && (
              <Card className="bg-card/60 backdrop-blur-xl border-primary/20">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" />
                    <p className="text-sm font-medium text-white">Auto DJ Setup</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1 sm:col-span-2">
                      <label className="text-xs text-gray-400">Style pack (Phase 3)</label>
                      <select
                        value={selectedStylePackId ?? ''}
                        onChange={(e) => {
                          const nextId = e.target.value || null;
                          setSelectedStylePackId(nextId);
                          const selectedPack = stylePacks.find((pack) => pack.id === nextId);
                          if (selectedPack) {
                            setAutoDjEnergyMode(selectedPack.energyProfile);
                            setAutoDjTransitionStyle(selectedPack.defaultTransitionStyle);
                          }
                        }}
                        className="w-full p-3 rounded-lg bg-black/30 border border-white/10 text-white text-sm focus:border-primary outline-none"
                      >
                        <option value="">Manual controls (no style pack)</option>
                        {stylePacks.map((pack) => (
                          <option key={pack.id} value={pack.id}>
                            {pack.name} ({pack.energyProfile}, {pack.defaultTransitionStyle})
                          </option>
                        ))}
                      </select>
                      {selectedStylePackId && (
                        <p className="text-xs text-gray-500">
                          {stylePacks.find((pack) => pack.id === selectedStylePackId)?.description ?? 'Built-in style preset'}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-400">Event type</label>
                      <select
                        value={eventType}
                        onChange={(e) => setEventType(e.target.value as typeof eventType)}
                        className="w-full p-3 rounded-lg bg-black/30 border border-white/10 text-white text-sm focus:border-primary outline-none"
                      >
                        <option value="default">Any</option>
                        <option value="wedding">Wedding</option>
                        <option value="birthday">Birthday</option>
                        <option value="sweet16">Sweet 16</option>
                        <option value="club">Club</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-400">Energy arc</label>
                      <select
                        value={autoDjEnergyMode}
                        onChange={(e) => setAutoDjEnergyMode(e.target.value as typeof autoDjEnergyMode)}
                        className="w-full p-3 rounded-lg bg-black/30 border border-white/10 text-white text-sm focus:border-primary outline-none"
                      >
                        <option value="steady">Steady</option>
                        <option value="build">Build to peak</option>
                        <option value="wave">Waves</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-400">Transition style</label>
                      <select
                        value={autoDjTransitionStyle}
                        onChange={(e) => setAutoDjTransitionStyle(e.target.value as TransitionStyle)}
                        className="w-full p-3 rounded-lg bg-black/30 border border-white/10 text-white text-sm focus:border-primary outline-none"
                      >
                        {transitionStyles.length === 0 ? (
                          <option value="smooth">Smooth</option>
                        ) : (
                          transitionStyles.map((style) => (
                            <option key={style.id} value={style.id}>
                              {style.name}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-400">Target BPM (optional)</label>
                      <input
                        type="number"
                        min={60}
                        max={200}
                        value={autoDjTargetBpm ?? ''}
                        onChange={(e) => setAutoDjTargetBpm(e.target.value ? Number(e.target.value) : null)}
                        className="w-full p-3 rounded-lg bg-black/30 border border-white/10 text-white text-sm focus:border-primary outline-none"
                        placeholder="e.g. 126"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferStems}
                        onChange={(e) => setPreferStems(e.target.checked)}
                        className="h-4 w-4 accent-primary"
                      />
                      <div>
                        <p className="text-sm text-white">Prefer stems for transitions</p>
                        <p className="text-xs text-gray-500">Uses vocals+instrumental stems when available</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={keepOrder}
                        onChange={(e) => setKeepOrder(e.target.checked)}
                        className="h-4 w-4 accent-primary"
                      />
                      <div>
                        <p className="text-sm text-white">Keep my track order</p>
                        <p className="text-xs text-gray-500">Otherwise we will reorder for smoother flow</p>
                      </div>
                    </label>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Preview + surprise me */}
            <Card className="bg-card/60 backdrop-blur-xl border-white/10">
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-400">Quick actions</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    disabled={isPreviewing || selectedTrackIds.length < 2}
                    onClick={handlePreview}
                    className="h-12 border-white/10 hover:border-primary/30 hover:text-primary"
                  >
                    {isPreviewing ? 'Rendering preview…' : 'Preview 20s'}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleSmartMix}
                    disabled={isSmartMixing}
                    className="h-12 text-primary hover:text-primary"
                  >
                    {isSmartMixing ? 'Selecting…' : 'Smart mix'}
                  </Button>
                </div>
                {audioFeatureFlags.toneJsPreviewGraph && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-primary/90">Browser transition FX preview (Tone.js)</p>
                        <p className="text-[11px] text-gray-400">
                          Uses the first two selected tracks via browser audio graph. Final render remains server-side.
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-3 text-xs border border-primary/20 hover:border-primary/40"
                        onClick={isBrowserPreviewing ? stopBrowserPreviewPlayback : handleBrowserTransitionPreview}
                        disabled={browserPreviewTracks.length < 2 && !isBrowserPreviewing}
                      >
                        {isBrowserPreviewing ? 'Stop FX' : 'Preview FX'}
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                      <span>
                        Source pair:{' '}
                        {browserPreviewTracks.length >= 2
                          ? `${browserPreviewTracks[0].original_filename} -> ${browserPreviewTracks[1].original_filename}`
                          : 'Select 2 analyzed tracks'}
                      </span>
                      <span className="text-gray-500">•</span>
                      <span>
                        Style: {crossfadeEnabled ? crossfadeStyle : autoDjTransitionStyle}
                      </span>
                      <span className="text-gray-500">•</span>
                      <span>
                        Duration: {Math.max(1, Math.min(12, crossfadeEnabled ? crossfadeDuration : 4))}s
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <label className="flex flex-col gap-1 text-[11px] text-gray-400">
                        <span>Track A (outgoing)</span>
                        <select
                          value={browserPreviewTrackAId ?? ''}
                          onChange={(e) => setBrowserPreviewTrackAId(e.target.value || null)}
                          className="h-9 rounded border border-white/10 bg-black/30 px-2 text-xs text-white"
                        >
                          <option value="">Select track A</option>
                          {completedTracks
                            .filter((track) => selectedTrackIds.includes(track.id))
                            .map((track) => (
                              <option key={track.id} value={track.id}>
                                {track.original_filename}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 text-[11px] text-gray-400">
                        <span>Track B (incoming)</span>
                        <select
                          value={browserPreviewTrackBId ?? ''}
                          onChange={(e) => setBrowserPreviewTrackBId(e.target.value || null)}
                          className="h-9 rounded border border-white/10 bg-black/30 px-2 text-xs text-white"
                        >
                          <option value="">Select track B</option>
                          {completedTracks
                            .filter((track) => selectedTrackIds.includes(track.id) && track.id !== browserPreviewTrackAId)
                            .map((track) => (
                              <option key={track.id} value={track.id}>
                                {track.original_filename}
                              </option>
                            ))}
                        </select>
                      </label>
                    </div>
                    {browserPreviewCapabilities && !browserPreviewCapabilities.available && (
                      <p className="text-[11px] text-amber-300/90">
                        Fallback active: {browserPreviewCapabilities.reason ?? 'Web Audio unavailable'}.
                      </p>
                    )}
                    {browserPreviewMessage && (
                      <p className="text-[11px] text-gray-300">{browserPreviewMessage}</p>
                    )}
                  </div>
                )}
                {previewUrl && (
                  <div className="rounded-lg border border-white/5 bg-black/30 p-3">
                    <p className="text-xs text-gray-400 mb-2">Preview (temporary)</p>
                    <audio controls src={previewUrl ?? undefined} className="w-full" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Compatibility helper */}
            <Card className="bg-card/60 backdrop-blur-xl border-white/10">
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-400">Compatibility suggestions</p>
                  <span className="text-xs text-gray-500">Anchor: {anchorTrack ? anchorTrack.original_filename : '—'}</span>
                </div>
                {(!anchorTrack || compatibilityHints.length === 0) && (
                  <p className="text-sm text-gray-500">Select or upload analyzed tracks to see best pairings.</p>
                )}
                {compatibilityHints.length > 0 && (
                  <div className="space-y-2">
                    {compatibilityHints.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-black/20 px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm text-white truncate">{item.name}</p>
                          <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                            <span className={`px-2 py-1 rounded-full text-[11px] font-medium ${scoreStyles(item.score)}`}>
                              Score {(item.score * 100).toFixed(0)}%
                            </span>
                            {item.bpmDiff !== null && <span className="text-gray-400">Δ {Math.round(item.bpmDiff)} BPM</span>}
                            <span className={item.keyOk ? 'text-emerald-300' : 'text-gray-500'}>{item.keyOk ? 'Key match' : 'Key stretch'}</span>
                          </div>
                        </div>
                        <div className="text-xs text-primary/80">Suggested</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card/60 backdrop-blur-xl">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-400">Select analyzed tracks</p>
                  <span className="text-xs text-gray-500">{completedTracks.length} ready</span>
                </div>
                <div className="space-y-3 max-h-48 overflow-auto pr-1">
                  {completedTracks.length === 0 && (
                    <p className="text-sm text-gray-500">No completed tracks yet. Upload files and wait for analysis.</p>
                  )}
                  {completedTracks.map((track) => (
                    <label key={track.id} className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-white/5 hover:border-primary/30 transition-colors cursor-pointer">
                      <div>
                        <p className="text-sm text-white">{track.original_filename}</p>
                        <p className="text-xs text-gray-500">
                          {track.bpm ? `${track.bpm} BPM` : 'BPM TBD'}
                          {track.musical_key ? ` • ${track.musical_key}` : ''}
                          {track.analysis_quality === 'browser_hint'
                            ? ` • browser${
                                track.browser_analysis_confidence != null
                                  ? ` ${Math.round(track.browser_analysis_confidence * 100)}%`
                                  : ''
                              }`
                            : track.analysis_quality
                              ? ' • server'
                              : ''}
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedTrackIds.includes(track.id)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSelectedTrackIds((current) => {
                            if (checked) return [...new Set([...current, track.id])];
                            return current.filter((id) => id !== track.id);
                          });
                        }}
                        className="h-5 w-5 accent-primary"
                      />
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            {/* Generation Action */}
            <Card className="bg-card/60 backdrop-blur-xl">
                <CardContent className="pt-6">
                    {mixMode === 'standard' ? (
                      <>
                        <Button 
                            className="w-full h-14 text-lg font-bold relative overflow-hidden group" 
                            variant="default"
                            onClick={handleGenerateMashup}
                            disabled={isGenerating || selectedTrackIds.length < 2}
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-primary via-orange-400 to-primary opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <span className="relative z-10 flex items-center justify-center">
                            {isGenerating ? (
                                <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3" />
                                Processing...
                                </>
                            ) : (
                                <>
                                <Zap className="w-5 h-5 mr-2 fill-white" />
                                Generate Mashup
                                </>
                            )}
                            </span>
                        </Button>
                        {selectedTrackIds.length < 2 && (
                            <p className="text-xs text-center mt-3 text-gray-500">
                            * Requires at least 2 analyzed tracks
                            </p>
                        )}
                      </>
                    ) : mixMode === 'stem_mashup' ? (
                      <>
                        <Button 
                            className="w-full h-14 text-lg font-bold relative overflow-hidden group" 
                            variant="default"
                            onClick={handleGenerateStemMashup}
                            disabled={true}
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-pink-500 via-primary to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <span className="relative z-10 flex items-center justify-center">
                            <>
                            <Mic2 className="w-5 h-5 mr-2" />
                            Stem Mashup Unavailable
                            </>
                            </span>
                        </Button>
                        <p className="text-xs text-center mt-3 text-gray-500">
                        * Disabled during Phase 0 runtime unification
                        </p>
                      </>
                    ) : (
                      <>
                        <Button 
                            className="w-full h-14 text-lg font-bold relative overflow-hidden group" 
                            variant="default"
                            onClick={handleGenerateAutoDjMix}
                            disabled={isGenerating || selectedTrackIds.length < 2}
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-primary via-orange-400 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <span className="relative z-10 flex items-center justify-center">
                            {isGenerating ? (
                                <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3" />
                                Building Auto DJ mix...
                                </>
                            ) : (
                                <>
                                <Zap className="w-5 h-5 mr-2 fill-white" />
                                Create Auto DJ Mix
                                </>
                            )}
                            </span>
                        </Button>
                        {selectedTrackIds.length < 2 && (
                            <p className="text-xs text-center mt-3 text-gray-500">
                            * Select at least 2 analyzed tracks
                            </p>
                        )}
                      </>
                    )}
                    {generationMessage && (
                      <p className="text-xs text-center mt-3 text-green-500">{generationMessage}</p>
                    )}
                </CardContent>
            </Card>

            {/* Mini Status */}
            <Card className="bg-black/20 border-white/5">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="text-sm text-gray-400">Engine Status</div>
                <div className="flex items-center text-sm text-green-500">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                  Online & Ready
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Track List using reusable component */}
        <div className="mt-8 mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-gray-500">Track Source</span>
            <div className="flex rounded-lg border border-white/10 bg-black/20 p-1">
              {([
                ['all', 'All'],
                ['browser_hint', 'Browser'],
                ['standard', 'Server'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTrackAnalysisFilter(value)}
                  className={`rounded-md px-3 py-1 text-xs transition-colors ${
                    trackAnalysisFilter === value
                      ? 'bg-primary/20 text-primary border border-primary/30'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="text-xs text-gray-400">
            Browser: {trackQualityCounts.browser_hint ?? 0}
            {' • '}
            Server: {trackQualityCounts.standard ?? 0}
            {' • '}
            Total shown: {uploadedTracks.length}
          </div>
        </div>
        <TrackList 
            tracks={uploadedTracks} 
            onRemoveTrack={handleRemoveTrack}
            onStemsUpdated={loadTracks}
        />
        
      </main>
      
      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
      />
    </div>
  );
}
