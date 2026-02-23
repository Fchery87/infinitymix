-- Persist browser MIR feature bundles (Essentia/Meyda-derived) for compatibility scoring and debugging.
ALTER TABLE "uploaded_tracks"
ADD COLUMN IF NOT EXISTS "analysis_features" jsonb;
