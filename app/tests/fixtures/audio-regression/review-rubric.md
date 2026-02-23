# Audio Regression Review Rubric

Use this rubric for manual QA comparisons across baseline and post-change renders/previews.

Score each category on a `1-5` scale (`5` = best).

## Core Quality Categories

1. BPM / Beat Stability
- Are beats aligned consistently through transitions?
- Are obvious tempo drifts or flams present?

2. Harmonic Compatibility
- Do transitions feel harmonically coherent?
- Is pitch-shifting noticeable or artifact-heavy?

3. Phrase Alignment
- Do transitions occur on musical phrase boundaries?
- Are drops/choruses entered cleanly?

4. Section Choice Quality
- Are selected segments musically useful (hook/drop/build/vocal phrase)?
- Does the mix avoid awkward low-energy or dead sections?

5. Transition Musicality
- Are FX/transitions appropriate and not distracting?
- Is perceived energy flow smooth and intentional?

6. Loudness / Output Quality (Phase 4+)
- Is level consistent across the full mix?
- Any clipping, distortion, pumping, or harsh peaks?

## Notes Template

For each fixture pair, capture:

- Fixture ID:
- Build / Commit:
- Feature flags enabled:
- Browser path used? (`yes/no`)
- Analyzer fallback happened? (`yes/no`)
- Browser hint decision reason (if applicable):
- Scores (`1-5`) for categories 1-6:
- Freeform notes:

## Pass/Fail Heuristic (Internal)

- Fail if any of BPM/Beat Stability, Harmonic Compatibility, or Phrase Alignment is `<= 2`
- Review required if average score drops by `>= 0.5` from baseline on any fixture

