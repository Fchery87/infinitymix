import { emitAudioPipelineTelemetry } from '@/lib/audio/telemetry';

export type PreviewTransitionStyle =
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

type ToneModule = typeof import('tone');

type ToneLike = {
  Destination: unknown;
  now: () => number;
  context?: { state?: string };
  start: () => Promise<void>;
  Gain: new (value?: number) => {
    gain?: { value: number };
    connect: (node: unknown) => unknown;
    disconnect?: () => void;
    toDestination?: () => unknown;
    dispose?: () => void;
  };
  Filter: new (freq?: number, type?: string) => {
    frequency?: { value: number };
    Q?: { value: number };
    type?: string;
    connect: (node: unknown) => unknown;
    dispose?: () => void;
  };
  Reverb: new (opts?: { decay?: number; wet?: number }) => {
    wet?: { value: number };
    connect: (node: unknown) => unknown;
    dispose?: () => void;
    generate?: () => Promise<void>;
  };
  FeedbackDelay: new (opts?: { delayTime?: number; feedback?: number; wet?: number }) => {
    wet?: { value: number };
    feedback?: { value: number };
    delayTime?: { value: number };
    connect: (node: unknown) => unknown;
    dispose?: () => void;
  };
  CrossFade: new (fade?: number) => {
    fade?: { value: number };
    a: { connect: (node: unknown) => unknown };
    b: { connect: (node: unknown) => unknown };
    connect: (node: unknown) => unknown;
    dispose?: () => void;
  };
  Player: new (opts?: { url?: string; autostart?: boolean; loop?: boolean }) => {
    connect: (node: unknown) => unknown;
    start: (time?: number, offset?: number, duration?: number) => unknown;
    stop: (time?: number) => unknown;
    load?: (url: string) => Promise<void>;
    dispose?: () => void;
    volume?: { value: number };
    playbackRate?: number;
    loaded?: boolean;
  };
};

type AutomatableParam = {
  value: number;
  setValueAtTime?: (value: number, time: number) => unknown;
  linearRampToValueAtTime?: (value: number, time: number) => unknown;
  exponentialRampToValueAtTime?: (value: number, time: number) => unknown;
  rampTo?: (value: number, rampTime?: number, startTime?: number) => unknown;
};

export type PreviewGraphCapabilities = {
  available: boolean;
  webAudioAvailable: boolean;
  toneAvailable: boolean;
  reason?: string;
};

export type PreviewTransitionAutomationPlan = {
  style: PreviewTransitionStyle;
  durationSeconds: number;
  crossfadeCurve: 'linear' | 'exp' | 'log' | 'cut';
  filterSweep?: { fromHz: number; toHz: number; q?: number };
  delaySend?: number;
  reverbSend?: number;
  playbackRateRamp?: { from: number; to: number };
};

type EnvelopePoint = {
  t: number; // normalized 0..1
  value: number;
  curve?: 'linear' | 'exp';
};

type PreviewAutomationEnvelope = {
  crossfade?: EnvelopePoint[];
  filterHz?: EnvelopePoint[];
  delayWet?: EnvelopePoint[];
  reverbWet?: EnvelopePoint[];
  playbackRate?: EnvelopePoint[];
};

export async function ensurePreviewPlayerLoaded(
  player: {
    load?: (url: string) => Promise<unknown>;
    loaded?: boolean;
  },
  url: string
) {
  if (player.loaded) return;
  if (typeof player.load === 'function') {
    await player.load(url);
  }
}

export function getPreviewGraphCapabilities(): PreviewGraphCapabilities {
  const webAudioAvailable =
    typeof window !== 'undefined' &&
    (typeof window.AudioContext !== 'undefined' ||
      typeof (window as Window & { webkitAudioContext?: unknown }).webkitAudioContext !== 'undefined');
  if (!webAudioAvailable) {
    return {
      available: false,
      webAudioAvailable: false,
      toneAvailable: false,
      reason: 'Web Audio API unavailable',
    };
  }
  return {
    available: true,
    webAudioAvailable: true,
    toneAvailable: true,
  };
}

function setParamAtTime(param: AutomatableParam | undefined, value: number, time: number) {
  if (!param) return;
  if (typeof param.setValueAtTime === 'function') {
    param.setValueAtTime(value, time);
    return;
  }
  param.value = value;
}

function rampParamAtTime(
  param: AutomatableParam | undefined,
  value: number,
  time: number,
  curve: 'linear' | 'exp'
) {
  if (!param) return;
  if (typeof param.rampTo === 'function') {
    const startTime = Math.max(0, time - 0.05);
    param.rampTo(value, Math.max(0.05, time - startTime), startTime);
    return;
  }
  if (curve === 'exp' && typeof param.exponentialRampToValueAtTime === 'function') {
    param.exponentialRampToValueAtTime(Math.max(0.0001, value), time);
    return;
  }
  if (typeof param.linearRampToValueAtTime === 'function') {
    param.linearRampToValueAtTime(value, time);
    return;
  }
  param.value = value;
}

function getAutomationEnvelope(plan: PreviewTransitionAutomationPlan): PreviewAutomationEnvelope {
  const envelope: PreviewAutomationEnvelope = {
    crossfade:
      plan.crossfadeCurve === 'cut'
        ? [
            { t: 0, value: 0 },
            { t: 0.15, value: 1, curve: 'linear' },
          ]
        : [
            { t: 0, value: 0 },
            {
              t: 1,
              value: 1,
              curve: plan.crossfadeCurve === 'exp' ? 'exp' : 'linear',
            },
          ],
  };

  if (plan.filterSweep) {
    envelope.filterHz =
      plan.style === 'drop' || plan.style === 'bass_drop'
        ? [
            { t: 0, value: plan.filterSweep.fromHz },
            { t: 0.7, value: Math.max(plan.filterSweep.toHz * 2.2, 260), curve: 'exp' },
            { t: 1, value: plan.filterSweep.toHz, curve: 'exp' },
          ]
        : [
            { t: 0, value: plan.filterSweep.fromHz },
            { t: 1, value: plan.filterSweep.toHz, curve: 'exp' },
          ];
  }

  if (typeof plan.delaySend === 'number') {
    const target = clamp(plan.delaySend, 0, 1);
    envelope.delayWet =
      plan.style === 'echo_reverb' || plan.style === 'echo_out'
        ? [
            { t: 0, value: 0.02 },
            { t: 0.35, value: target, curve: 'linear' },
            { t: 1, value: Math.max(0.06, target * 0.65), curve: 'linear' },
          ]
        : [
            { t: 0, value: 0.03 },
            { t: 1, value: target, curve: 'linear' },
          ];
  }

  if (typeof plan.reverbSend === 'number') {
    const target = clamp(plan.reverbSend, 0, 1);
    envelope.reverbWet =
      plan.style === 'reverb_wash' || plan.style === 'noise_riser'
        ? [
            { t: 0, value: 0.05 },
            { t: 0.7, value: target, curve: 'linear' },
            { t: 1, value: Math.max(0.08, target * 0.9), curve: 'linear' },
          ]
        : [
            { t: 0, value: 0.04 },
            { t: 1, value: target, curve: 'linear' },
          ];
  }

  if (plan.playbackRateRamp) {
    envelope.playbackRate = [
      { t: 0, value: plan.playbackRateRamp.from },
      {
        t: plan.style === 'tape_stop' ? 1 : 0.65,
        value: plan.playbackRateRamp.to,
        curve: 'linear',
      },
    ];
  }

  return envelope;
}

export function buildTransitionAutomationPlan(
  style: PreviewTransitionStyle,
  durationSeconds: number
): PreviewTransitionAutomationPlan {
  const base: PreviewTransitionAutomationPlan = {
    style,
    durationSeconds,
    crossfadeCurve: 'linear',
  };

  switch (style) {
    case 'cut':
      return { ...base, crossfadeCurve: 'cut', durationSeconds: Math.min(durationSeconds, 0.15) };
    case 'drop':
    case 'bass_drop':
      return {
        ...base,
        crossfadeCurve: 'exp',
        filterSweep: { fromHz: 14000, toHz: 180, q: 0.9 },
      };
    case 'energy':
    case 'snare_roll':
      return {
        ...base,
        crossfadeCurve: 'exp',
        delaySend: 0.18,
        reverbSend: 0.12,
      };
    case 'filter_sweep':
      return {
        ...base,
        filterSweep: { fromHz: 250, toHz: 12000, q: 1.1 },
        crossfadeCurve: 'log',
      };
    case 'echo_reverb':
    case 'echo_out':
      return {
        ...base,
        delaySend: 0.28,
        reverbSend: 0.24,
        crossfadeCurve: 'log',
      };
    case 'reverb_wash':
    case 'noise_riser':
      return {
        ...base,
        reverbSend: 0.32,
        crossfadeCurve: 'linear',
      };
    case 'tape_stop':
    case 'backspin':
      return {
        ...base,
        crossfadeCurve: 'log',
        playbackRateRamp: { from: 1, to: style === 'tape_stop' ? 0.6 : 0.75 },
      };
    default:
      return base;
  }
}

export type PreviewGraph = {
  capabilities: PreviewGraphCapabilities;
  loadPlayers: (input: { vocalUrl?: string | null; instrumentalUrl?: string | null }) => Promise<void>;
  setMix: (params: { vocalGain?: number; instrumentalGain?: number; wetFx?: number }) => void;
  applyTransitionAutomation: (plan: PreviewTransitionAutomationPlan) => Promise<void>;
  playTransitionPreview: (plan: PreviewTransitionAutomationPlan) => Promise<void>;
  stopPlayback: () => void;
  dispose: () => void;
};

let toneImportPromise: Promise<ToneModule> | null = null;

async function loadTone(): Promise<ToneLike> {
  if (!toneImportPromise) {
    toneImportPromise = import('tone');
  }
  return (await toneImportPromise) as unknown as ToneLike;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export async function createPreviewGraph(): Promise<PreviewGraph> {
  const capabilities = getPreviewGraphCapabilities();
  if (!capabilities.available) {
    emitAudioPipelineTelemetry('preview_graph.capability_unavailable', {
      area: 'preview',
      status: 'error',
      reason: capabilities.reason,
      webAudioAvailable: capabilities.webAudioAvailable,
    });
    return {
      capabilities,
      loadPlayers: async () => undefined,
      setMix: () => undefined,
      applyTransitionAutomation: async () => undefined,
      playTransitionPreview: async () => undefined,
      stopPlayback: () => undefined,
      dispose: () => undefined,
    };
  }

  try {
    const Tone = await loadTone();
    await Tone.start();

    const vocalBus = new Tone.Gain(1);
    const instrumentalBus = new Tone.Gain(1);
    const masterBus = new Tone.Gain(1);
    const fxSendBus = new Tone.Gain(0);
    const crossfade = new Tone.CrossFade(0.5);
    const filter = new Tone.Filter(18000, 'lowpass');
    const delay = new Tone.FeedbackDelay({ delayTime: 0.2, feedback: 0.25, wet: 0.15 });
    const reverb = new Tone.Reverb({ decay: 2.5, wet: 0.12 });

    vocalBus.connect(crossfade.a);
    instrumentalBus.connect(crossfade.b);
    crossfade.connect(filter);
    filter.connect(masterBus);
    masterBus.connect(Tone.Destination);

    fxSendBus.connect(delay);
    delay.connect(masterBus);
    fxSendBus.connect(reverb);
    reverb.connect(masterBus);

    let vocalPlayer: InstanceType<ToneLike['Player']> | null = null;
    let instrumentalPlayer: InstanceType<ToneLike['Player']> | null = null;
    let stopPlaybackTimeout: ReturnType<typeof setTimeout> | null = null;

    const clearStopPlaybackTimeout = () => {
      if (stopPlaybackTimeout) {
        clearTimeout(stopPlaybackTimeout);
        stopPlaybackTimeout = null;
      }
    };

    const loadPlayers = async (input: { vocalUrl?: string | null; instrumentalUrl?: string | null }) => {
      if (input.vocalUrl) {
        if (!vocalPlayer) {
          vocalPlayer = new Tone.Player({ autostart: false, loop: false });
          vocalPlayer.connect(vocalBus);
          vocalPlayer.connect(fxSendBus);
        }
        await ensurePreviewPlayerLoaded(vocalPlayer, input.vocalUrl);
      }
      if (input.instrumentalUrl) {
        if (!instrumentalPlayer) {
          instrumentalPlayer = new Tone.Player({ autostart: false, loop: false });
          instrumentalPlayer.connect(instrumentalBus);
          instrumentalPlayer.connect(fxSendBus);
        }
        await ensurePreviewPlayerLoaded(instrumentalPlayer, input.instrumentalUrl);
      }
    };

    const setMix = (params: { vocalGain?: number; instrumentalGain?: number; wetFx?: number }) => {
      if (typeof params.vocalGain === 'number' && vocalBus.gain) {
        vocalBus.gain.value = clamp(params.vocalGain, 0, 2);
      }
      if (typeof params.instrumentalGain === 'number' && instrumentalBus.gain) {
        instrumentalBus.gain.value = clamp(params.instrumentalGain, 0, 2);
      }
      if (typeof params.wetFx === 'number' && fxSendBus.gain) {
        fxSendBus.gain.value = clamp(params.wetFx, 0, 1);
      }
    };

    const resetPlaybackState = () => {
      if (crossfade.fade) {
        crossfade.fade.value = 0;
      }
      if (filter.frequency) {
        filter.frequency.value = 18000;
      }
      if (delay.wet) {
        delay.wet.value = 0.15;
      }
      if (reverb.wet) {
        reverb.wet.value = 0.12;
      }
      if (vocalPlayer) {
        vocalPlayer.playbackRate = 1;
      }
      if (instrumentalPlayer) {
        instrumentalPlayer.playbackRate = 1;
      }
    };

    const stopPlayback = () => {
      clearStopPlaybackTimeout();
      try {
        vocalPlayer?.stop();
      } catch {
        // no-op
      }
      try {
        instrumentalPlayer?.stop();
      } catch {
        // no-op
      }
      resetPlaybackState();
    };

    const applyTransitionAutomation = async (plan: PreviewTransitionAutomationPlan) => {
      const now = Tone.now();
      const safeDuration = Math.max(0.1, plan.durationSeconds);
      const startAt = now + 0.02;
      const envelope = getAutomationEnvelope(plan);
      const scheduleParamEnvelope = (
        param: AutomatableParam | undefined,
        points: EnvelopePoint[] | undefined
      ) => {
        if (!param || !points || points.length === 0) return;
        const [first, ...rest] = points;
        setParamAtTime(param, first.value, startAt + first.t * safeDuration);
        for (const point of rest) {
          const t = startAt + point.t * safeDuration;
          rampParamAtTime(param, point.value, t, point.curve ?? 'linear');
        }
      };

      scheduleParamEnvelope(crossfade.fade as AutomatableParam | undefined, envelope.crossfade);
      scheduleParamEnvelope(filter.frequency as AutomatableParam | undefined, envelope.filterHz);
      scheduleParamEnvelope(delay.wet as AutomatableParam | undefined, envelope.delayWet);
      scheduleParamEnvelope(reverb.wet as AutomatableParam | undefined, envelope.reverbWet);

      if (vocalPlayer && envelope.playbackRate && envelope.playbackRate.length > 0) {
        const [firstRate, ...restRates] = envelope.playbackRate;
        vocalPlayer.playbackRate = firstRate.value;
        for (const point of restRates) {
          const delayMs = Math.max(0, Math.round(point.t * safeDuration * 1000));
          setTimeout(() => {
            if (vocalPlayer) {
              vocalPlayer.playbackRate = point.value;
            }
          }, delayMs);
        }
      }

      emitAudioPipelineTelemetry('preview_graph.transition_applied', {
        area: 'preview',
        status: 'success',
        style: plan.style,
        duration_ms: Math.round(plan.durationSeconds * 1000),
        scheduled_at: now,
        automation: 'timed_ramps',
        envelopePreset: `style:${plan.style}`,
      });
    };

    const playTransitionPreview = async (plan: PreviewTransitionAutomationPlan) => {
      if (!vocalPlayer || !instrumentalPlayer) {
        throw new Error('Preview graph players are not loaded');
      }

      await Tone.start();
      stopPlayback();

      const startAt = Tone.now() + 0.05;
      const playbackSeconds = Math.max(1.5, plan.durationSeconds + 1.5);

      vocalPlayer.start(startAt, 0, playbackSeconds);
      instrumentalPlayer.start(startAt, 0, playbackSeconds);
      await applyTransitionAutomation(plan);

      stopPlaybackTimeout = setTimeout(() => {
        stopPlayback();
      }, Math.ceil(playbackSeconds * 1000));

      emitAudioPipelineTelemetry('preview_graph.transition_preview_started', {
        area: 'preview',
        status: 'success',
        style: plan.style,
        duration_ms: Math.round(playbackSeconds * 1000),
      });
    };

    const dispose = () => {
      try {
        stopPlayback();
        vocalPlayer?.dispose?.();
        instrumentalPlayer?.dispose?.();
        reverb.dispose?.();
        delay.dispose?.();
        filter.dispose?.();
        crossfade.dispose?.();
        fxSendBus.dispose?.();
        masterBus.dispose?.();
        vocalBus.dispose?.();
        instrumentalBus.dispose?.();
      } catch {
        // no-op
      }
    };

    return {
      capabilities: { ...capabilities, toneAvailable: true },
      loadPlayers,
      setMix,
      applyTransitionAutomation,
      playTransitionPreview,
      stopPlayback,
      dispose,
    };
  } catch (error) {
    emitAudioPipelineTelemetry('preview_graph.init_failed', {
      area: 'preview',
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown Tone.js init error',
    });
    return {
      capabilities: {
        ...capabilities,
        available: false,
        toneAvailable: false,
        reason: error instanceof Error ? error.message : 'Tone.js unavailable',
      },
      loadPlayers: async () => undefined,
      setMix: () => undefined,
      applyTransitionAutomation: async () => undefined,
      playTransitionPreview: async () => undefined,
      stopPlayback: () => undefined,
      dispose: () => undefined,
    };
  }
}
