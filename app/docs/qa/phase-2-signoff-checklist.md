# Phase 2 Signoff Checklist

Use this checklist to close Phase 2 in `Detailed-Analysis-Execution-Tracker.md`.

## Section Tagging QA

- Run the regression fixture process for Phase 2 builds.
- Record whether section choice quality improved, stayed flat, or regressed.
- Use `tests/fixtures/audio-regression/review-rubric.md` and focus on:
  - Phrase Alignment
  - Section Choice Quality
  - Transition Musicality
- Generate a structured review sheet with:
  - `npm run phase2:review:template -- --build <label>`
- Compare baseline and candidate review sheets with:
  - `npm run phase2:review:evaluate -- --before <baseline.json> --after <candidate.json>`

## Browser Preview Stability QA

Target browser set:
- Chrome latest on Windows
- Edge latest on Windows
- Safari latest on macOS

For each browser:
- Load the `Create` page and verify preview capability detection.
- Run at least one transition preview in the main create flow.
- Run at least one transition preview in `StemPlayer`.
- Confirm fallback behavior is non-blocking if preview is unavailable.
- Capture local QA telemetry in `/admin/audio-preview-qa`.
- Use the `Phase 2 Browser Signoff` card to confirm each target browser is `pass` or `pass_with_fallback`.
- Export the local QA evidence JSON from `/admin/audio-preview-qa`.

## Required Evidence

- No blocking preview errors for the target browser set.
- Local QA telemetry shows capability probes and failure rates that are explainable.
- Preview/render parity documentation exists and is current.
- Regression fixture review notes are attached to the release or change record.
- A consolidated signoff report can be generated with:
  - `npm run phase2:signoff:report -- --reviewBefore <baseline.json> --reviewAfter <candidate.json> --previewQa <preview-qa.json> --outMd <report.md>`

## Tracker Update Rule

Only mark Phase 2 complete when:
- Task 2.1 through Task 2.4 are implemented
- preview/render parity is documented
- fixture QA evidence exists
- target-browser preview stability evidence exists
