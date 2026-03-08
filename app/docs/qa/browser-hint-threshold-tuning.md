# Browser Hint Threshold Tuning

Use this workflow to tune browser-analysis acceptance thresholds without changing code.

## Objective

Accept browser-derived analysis only when it is reliable enough to improve automation throughput without degrading mashup quality.

The browser hint gate is intentionally conservative because professional automated mashup quality matters more than browser-side speed.

## Runtime Controls

Set these server-side environment variables:

- `IMX_BROWSER_HINT_CONFIDENCE_THRESHOLD`
- `IMX_BROWSER_HINT_TEMPO_CONFIDENCE_THRESHOLD`
- `IMX_BROWSER_HINT_KEY_CONFIDENCE_THRESHOLD`

Valid range for each value is `0.0` to `1.0`. Invalid values fall back to defaults.

Current defaults:

- overall confidence: `0.70`
- BPM confidence: `0.65`
- key confidence: `0.50`

## How To Tune

1. Review `/admin/audio-observability`.
2. Check `Browser Hint Acceptance` against `Fallback Reason Trends`.
3. Inspect the `Browser Hint Thresholds` card to confirm the active runtime values.
4. If `low_overall_confidence` dominates, lower `IMX_BROWSER_HINT_CONFIDENCE_THRESHOLD` carefully in small steps such as `0.70 -> 0.67`.
5. If accepted tracks show weak tempo decisions, raise `IMX_BROWSER_HINT_TEMPO_CONFIDENCE_THRESHOLD`.
6. If accepted tracks show weak harmonic decisions, raise `IMX_BROWSER_HINT_KEY_CONFIDENCE_THRESHOLD`.
7. Re-run fixture QA or spot-check resulting mashup quality before keeping the new values.

## Recommended Guardrails

- Change one threshold family at a time.
- Move in small increments (`0.02` to `0.05`).
- Do not optimize for acceptance rate alone.
- Prefer fallback to server analysis when acceptance gains create tempo/key regressions.

## Observable Signals

Use these signals together:

- `Browser Hint Acceptance`
- `Fallback Reason Trends`
- `Global Decision Reasons`
- fixture review results
- downstream mashup QA outcomes

## Completion Standard

Threshold tuning is considered complete when:

- active thresholds are visible in observability
- fallback reasons clearly explain non-acceptance
- threshold changes can be made through env config
- the team has a repeatable procedure for tuning without code edits
