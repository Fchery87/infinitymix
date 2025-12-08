## Product & Experience
- [ ] One-tap smart mix: auto-select compatible tracks (BPM/key, vocal vs. instrumental roles); “Surprise me” CTA.
- [ ] Social sharing: public links with web playback, social cards; remix/fork (“Make your version”).
- [ ] Personalization: recent/frequent tracks, “because you liked” recs, saved duration/genre presets.
- [ ] Streaks & challenges: weekly prompts, badges, featured mixes.
- [ ] Discovery surfaces: “Trending today,” “Staff picks,” “For you” with filters (BPM/key/genre).

## Audio Delivery
- [ ] CDN-ready streaming: set R2_PUBLIC_BASE with Cloudflare CDN; short-lived signed URLs; consider HLS if needed.
- [ ] Prefetch & cache: prefetch adjacent mashups; client-side caching for mashup pages.
- [ ] Optional stems previews: vocals/drums-only preview if stems detected.

## Growth & Feedback
- [ ] Notifications/email: completion alerts, milestones (“50 plays”), new challenge prompts; rate-limit and easy unsubscribe.
- [ ] Survey v2: trigger after playback thresholds; ask about transition quality via micro-survey.

## Reliability & Safety
- [ ] SLOs/alerts: set budgets for generation latency/error rate and R2 fetch failures; alerts on spikes.
- [ ] Abuse/rate limits: tighten per-IP/user on presign/complete/generate; keep CSP scoped to R2/CDN origins.

## Monetization (optional)
- [ ] Tiering: Free (daily gen limits, lower priority) vs Pro (faster queue, longer duration, batch renders, private links, higher downloads).
