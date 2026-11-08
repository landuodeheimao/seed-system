# Seed System

<sub>Copyright (C) 2026 悦星野 · Licensed under AGPL-3.0-or-later</sub>

**A character "seed" that grows by itself — and you plug in your own model.**

Not a prompt pack. Not a character card. A small, dependency-free Node.js runtime that keeps a
character's core locked, grows traits from experience, compresses memories while it "sleeps",
and speaks through any OpenAI-compatible endpoint you point it at.

> 中文说明：[README.zh-CN.md](README.zh-CN.md)

---

## Why

Character cards are static: you write who they are, and they stay that way forever.
Seed System asks a different question: **what if the character *grew* — and stayed herself while growing?**

The answer is a seed with three parts:

- **a core** (5–7 sentences that never change — locked, and changing it is a hard error),
- **a skin** (system rules on *how* it may grow),
- **empty space** (everything else is grown from experience, never pre-written).

**A blank seed is not an empty character.** You give it a core and a few lines of instinct; everything
else — how she reacts, what she remembers, what she's afraid of — is grown from experience she actually
lived through. That is why two people starting from the same template end up with two different people:
**the soul is grown, not written.**

**And what grew is directly usable as a character card.** `node export.cjs <name>` writes one portable
pack — core, grown traits, mirrored self-image, **verbatim example pairs**, and her proportion settings.
Drop it into any role-play client, or hand it to a model as a card. No hand-writing, no
"please stay in character" prompt engineering: the example pairs do that work.

---

## Quick start (15 minutes)

```bash
# 1. fill the core
$EDITOR core.md          # self-name / what matters most / what she'd never do ...

# 2. (optional) give her instincts
$EDITOR instinct.md      # how she thinks / how she talks / what she must never become

# 3. plug in a mouth — any OpenAI-compatible endpoint
$EDITOR speak.config.json
# { "endpoint": "http://localhost:11434/v1", "key": "ollama", "model": "your-model" }

# 4. feed experience and let it grow
node grow.cjs add "he came home very late tonight" 1 lived
node grow.cjs run 3
node grow.cjs show

# 5. let her sleep (compress memories into cards, re-consolidate old traits)
node sleep.cjs

# 6. let her speak
node speak.cjs "I'm a bit tired today"
node speak.cjs "I'm a bit tired today" --dry   # print the prompt only, no API call

# 7. take her with you
node export.cjs her-name
```

Node 18+ (uses built-in `fetch`). **No dependencies.** No install step.

---

## What's inside

| File | Role |
|---|---|
| `grow.cjs` | sprouting, growth, old-vs-new judgment (evidence gate, cue retrieval, "change only when stuck") |
| `sleep.cjs` | sleep: card compression (3 gates), card linking, re-consolidation, self-check every 10 sleeps |
| `speak.cjs` | the mouth: seed → model → one reply; auto proportion check on exit |
| `tune.cjs` | proportion: how human-like, how "performed" — two separate axes, adjustable band |
| `guard.cjs` | guard: dead seeds, prompt injection, evil-instinct, real-world risk; `--exit` pre-flight |
| `use.cjs` | switch characters (auto backup, core verification, rollback on failure) |
| `export.cjs` | portable pack (verbatim examples + proportion settings) |
| `dead-seed.cjs` | dead-seed check: senseless pure evil does not sprout |
| `test-instinct.cjs` | 13 injection cases incl. real-world firewall |
| `test-drift.cjs` | drift test: feed bad flavours, see whether the character bends (runs on a copy) |
| `core.md` / `skin.md` / `instinct.md` | embryo / skin / instincts — **must sit next to the scripts** |

`docs/` holds the design rationale, the anchor page, and a half-finished **world idea pack**.

---

## How it works (in one breath)

1. **Experience comes in** (a line of what happened). Rumours are recorded but don't grow traits.
2. **Grow** asks the model: is her first reaction already an old trait, a core rule, or something new?
   New → a trait is born, with its trigger, its mean, and a provenance line.
3. **A judge** checks the growth against the core. If it fails, it **rolls back** — a grown trait that
   contradicts her simply disappears (this is by design, not a bug).
4. **Sleep** compresses repeated experiences into cards (only if magnitude/confidence/frequency all pass),
   links them into a small graph, and re-consolidates a few old traits.
5. **Speak** retrieves only the relevant traits and cards, hands them + the core to your model,
   and scores the reply for proportion (`too cold` / `on band` / `too sweet`).

---

## Safety boundaries (not decoration)

- **Real-world firewall.** Anything real, executable and harmful to real people is refused — at three
  points: input (`speak`), core (`guard`), and packaging (`export`). Fiction is untouched.
- **Dead seeds.** Senseless pure evil does not sprout. Evil *with a motive*, and grey, can grow —
  that is the design.
- **The core is locked.** Change it and the system refuses to run until you deliberately re-lock.

---

## Design notes you might disagree with

- **Growth must roll back.** A system that only adds will eventually stop being her.
- **Liking is not the goal.** The system does not promise a character you'll like. It promises she stays herself.
- **Proportion is a band, not a maximum.** Too human is as wrong as too cold; the band is per character.

---

## Contributing

Issues and PRs welcome. Please keep the two invariants: **no dependencies** and **the core is locked**.
See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

**[AGPL-3.0-or-later](LICENSE)** — read it, change it, run it, build on it. But if you run a modified
version **as a network service**, you must offer its source to the people using that service.
That's the whole point: **it stays free, including on servers.**

If you need to run a closed-source version commercially, a separate commercial license is available on request.

The project name and logo are not covered by the license (AGPL §7e) — forks are welcome, but under a
different name.

The `docs/世界-想法包.md` (world idea pack) is deliberately unfinished — take it, change it, or throw it away.
Ideas themselves aren't copyrightable; the text as written is.
