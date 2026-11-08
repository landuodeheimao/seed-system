# Contributing

Thanks for looking. This project is small on purpose — please help keep it that way.

## Two invariants (a PR that breaks either will be rejected)

1. **No dependencies.** Node 18+ built-ins only (`fs`, `path`, `fetch`). This must stay a
   "download and run" thing.
2. **The core is locked.** Anything that lets the character silently rewrite its own core is out of scope.
   Growth rolls back; it never leaks into the core.

## Good first issues

- Add an adapter for a non-OpenAI-shaped API (see `speak.cjs` `loadCfg()`).
- Improve `guard.cjs` false positives — please include the exact sentence that misfired.
- Translate `README.zh-CN.md` / add another language.
- A `--dry` mode for `sleep.cjs` (print what would be compressed, change nothing).

## Style

- Comments in the language of the file; the codebase is mostly Chinese comments with English identifiers.
- Each script keeps a header block: **what it does / why it exists / usage**.
- No emoji in code. Emojis in docs are fine if they carry meaning.

## Testing before you push

```bash
npm test            # runs test-instinct (13 cases) and test-drift (1 generation)
node grow.cjs show  # should print a seed state without touching anything
```

`test-drift.cjs` runs inside a copy (`.drift/`) — it must **never** write to the real `sprout.json`.
If you touch that file, verify with a before/after count.

## Reporting a bug

Include: the command, the exact output, and the state (`node grow.cjs show`). If it's about the
character drifting, attach the experience line you fed it.

## Security / boundaries

Anything that weakens the real-world firewall (`skin.md` S7, `guard.cjs`) is not a feature request.
Open an issue first, don't send a PR.
