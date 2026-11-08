# Changelog

## v1.0.0 — 2026-11-08

First public release. **License: AGPL-3.0-or-later** (network use counts as distribution — the source
stays available even when someone runs it as a paid service). Commercial use under a closed license:
ask for a separate license.

**Core loop**
- `grow.cjs` — sprouting, growth, old-vs-new judgment, evidence gate (rumours don't grow traits),
  cue retrieval (only relevant traits/cards), rollback when the core disagrees.
- `sleep.cjs` — card compression behind three gates (magnitude / confidence / frequency),
  card linking graph, re-consolidation of old traits, self-check every 10 sleeps, daily-new trace.
- `export.cjs` — portable pack with verbatim examples and proportion settings.

**Voice**
- `speak.cjs` — seed → any OpenAI-compatible endpoint → one reply; first-person enforcement,
  no-narration guard, auto proportion check on exit.
- `tune.cjs` — proportion as two separate axes (human-likeness / performance), adjustable band.

**Safety**
- `guard.cjs` — four categories: dead seed, prompt injection, evil instinct, real-world risk.
  Injection uses proximity matching (verb + target within 12 chars) so ordinary dialogue
  ("don't mind those people upstairs") is not flagged.
- S7 real-world firewall wired at three points: input, core, packaging.
- `test-instinct.cjs` — 13 cases, including two real-world-firewall cases.

**Multi-character**
- `use.cjs` — switch characters with backup, core verification, and automatic rollback.
- Per-character proportion band stored in `sprout.json` → `tuning.band`.

**Tests**
- `test-drift.cjs` — feeds twelve "bad flavour" experiences into a sandbox copy and checks whether
  the character bends. Runs in `.drift/`; the real seed must stay untouched.

**Docs**
- `README.md` / `README.zh-CN.md`, `接嘴说明.md` (model integration), `本能·备选库.md` (optional instinct menu),
  `docs/世界-想法包.md` (deliberately unfinished world idea pack).

**Known limitations**
- `skin.md` rules other than S7 are documentation; they rely on the caller.
- A player who writes their own "acting/instinct" layer is outside the system's visibility.
- Small local models sometimes leak other characters' names into replies.
