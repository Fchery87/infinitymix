export type AnalysisConfidenceSnapshot = {
  overall: number;
  tempo: number | null;
  key: number | null;
  phrase: number | null;
  section: number | null;
};

type AudioRolloutVariant = 'control' | 'candidate';

export type AnnotationProvenance = 'browser-heuristic' | 'browser-ml' | 'backend-heuristic' | 'backend-model';

export type BrowserAnalysisHint = {
  source: 'browser-worker';
  version: 'browser-v1';
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  generatedAt: string;
  durationSeconds: number | null;
  bpm: number | null;
  bpmConfidence: number | null;
  keySignature: string | null;
  keyConfidence: number | null;
  phraseConfidence: number | null;
  sectionConfidence: number | null;
  downbeatGrid?: number[];
  beatGrid?: number[];
  phrases?: Array<{ start: number; end: number; energy: number }>;
  structure?: Array<{ label: string; start: number; end: number; confidence: number; provenance: AnnotationProvenance }>;
  dropMoments?: number[];
  cuePoints?: Array<{
    position: number;
    type: 'mix-in' | 'mix-out' | 'drop' | 'breakdown';
    confidence: number;
    provenance: AnnotationProvenance;
  }>;
  waveformLite?: number[];
  analysisFeatures?: {
    version: 'mir-v1';
    source: 'essentia' | 'meyda' | 'hybrid';
    extractionMs?: number | null;
    sectionTagging?: {
      enabled: boolean;
      attempted: boolean;
      backend: 'webgpu' | 'wasm' | 'heuristic' | 'none';
      status: 'success' | 'fallback' | 'disabled' | 'unavailable';
      timing?: {
        totalMs?: number | null;
        modelLoadMs?: number | null;
        inferenceMs?: number | null;
      };
      fallbackReason?: string | null;
      rollout?: {
        variant: AudioRolloutVariant;
        source: 'feature_disabled' | 'override' | 'percentage';
        bucket: number | null;
        stableKey: string;
      };
      model?: string | null;
      error?: string | null;
      tags: Array<{
        start: number;
        end: number;
        tag: 'vocal-dominant' | 'percussive' | 'build' | 'drop-like' | 'ambient';
        confidence: number;
        source: 'ml' | 'heuristic';
      }>;
    };
    descriptors: {
      rms?: number | null;
      energy?: number | null;
      zcr?: number | null;
      spectralCentroid?: number | null;
      spectralRolloff?: number | null;
      flatnessDb?: number | null;
      crest?: number | null;
    };
  };
  featureSummary?: {
    rms?: number | null;
    spectralCentroid?: number | null;
    zcr?: number | null;
    meydaAvailable?: boolean;
    essentiaAvailable?: boolean;
    essentiaAdapterReady?: boolean;
    essentiaExports?: string[];
    essentiaVersion?: string | null;
    essentiaRms?: number | null;
    essentiaZcr?: number | null;
    essentiaSpectralCentroid?: number | null;
    essentiaSpectralRolloff?: number | null;
    essentiaFlatnessDb?: number | null;
    essentiaCrest?: number | null;
    essentiaEnergy?: number | null;
    mlSectionTaggingEnabled?: boolean;
    mlSectionTaggingBackend?: 'webgpu' | 'wasm' | 'heuristic' | 'none';
    mlSectionTaggingStatus?: 'success' | 'fallback' | 'disabled' | 'unavailable';
    mlSectionTaggingTotalMs?: number | null;
    mlSectionTaggingModelLoadMs?: number | null;
    mlSectionTaggingInferenceMs?: number | null;
    mlSectionTaggingFallbackReason?: string | null;
    mlSectionTaggingRolloutVariant?: AudioRolloutVariant;
    mlSectionTaggingRolloutSource?: 'feature_disabled' | 'override' | 'percentage';
    beatDetectorAvailable?: boolean;
  };
  confidence: AnalysisConfidenceSnapshot;
};

export type BrowserAnalysisHintEnvelope = {
  hints: BrowserAnalysisHint[];
};
