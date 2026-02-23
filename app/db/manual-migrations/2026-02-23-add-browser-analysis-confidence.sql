-- Add browser-side analysis confidence score captured when browser hints are accepted.
ALTER TABLE "uploaded_tracks"
ADD COLUMN IF NOT EXISTS "browser_analysis_confidence" numeric(4, 3);
