# Release Signoff Checklist

Before promoting any significant change to analysis heuristics (Phase 1), the sequence planner (Phase 3), or transition rendering (Phase 5), the following criteria must be met. Changes must be auditable, repeatable, and explicitly measurable. 

## 1. Automation Baseline Captured (Pre-Change)
- [ ] Run `node scripts/capture-audio-baseline.mjs --out ./tests/fixtures/audio-regression/baselines/baseline-control.json` on the `master` branch (or currently deployed production).
- [ ] Ensure the generated baseline JSON looks sane and the overall completeness/acceptance rates are recorded.

## 2. Benchmark Variant Captured (Post-Change)
- [ ] Deploy or run locally the candidate variant branch.
- [ ] Rerun `node scripts/capture-audio-baseline.mjs --out ./tests/fixtures/audio-regression/baselines/candidate.json`.
- [ ] Use `node scripts/compare-audio-baseline.mjs --before ./tests/fixtures/audio-regression/baselines/baseline-control.json --after ./tests/fixtures/audio-regression/baselines/candidate.json` to view aggregate changes.

## 3. Human Evaluation Phase (The Hard Gate)
- [ ] Generate the review template using `node scripts/generate-phase2-review-template.mjs --build <candidate_name>`.
- [ ] For every edge case represented in `manifest.json`, generate a test output and listen.
- [ ] Populate the output json with scores for:
  - Phrase Alignment
  - Section Choice Quality
  - Transition Musicality
  - Vocal Clash Avoidance
- [ ] Evaluate the review against the baseline using `node scripts/evaluate-phase2-review.mjs --before <baseline_review.json> --after <candidate_review.json>`.

## 4. Pass/Fail Decision
A release is considered **FAILED** and must not proceed if:
- [ ] `evaluate-phase2-review.mjs` outputs a `FAIL` (any score <= 2).
- [ ] The average score regresses by >= 0.5.
- [ ] The overall `browserHintAcceptanceRate` (from `compare-audio-baseline.mjs`) falls by over 10% without a strictly defined and documented reason.

## 5. Signoff Report Generation
- [ ] Produce the markdown report: `node scripts/generate-phase2-signoff-report.mjs --reviewBefore <baseline_review.json> --reviewAfter <candidate_review.json> --previewQa <preview_qa.json> --outMd ./tests/fixtures/audio-regression/signoff-report-<date>.md`.
- [ ] Attach `signoff-report-<date>.md` to the Pull Request.

If all checks pass, the backend planner or analysis update is ready for `master`.
