# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

PlayingMelodies: a phone web app for relative-pitch ear training. A constant
tonic + fifth drone sounds; the app plays a note (or a short melody) over it and
the player taps its scale degree on a fixed 12-degree pad. React + TypeScript +
Vite + Zustand + Tailwind; no backend, everything persists to `localStorage`.
Sister app to PlayingChord (`E:\GitRepo\PlayingChord`): same look and tooling,
but no MIDI — it targets phone browsers, **iPhone Safari first-class**, as an
installable offline PWA.

Status: the whole app is built and deployed — the pure domain core (`theory/`,
`practice/`, `storage/`), the session runner (`practice/session.ts`, a pure state
machine that emits audio and timer effects), the audio interface (`audio/sound.ts`:
drone and cue playback), the stores that drive the runner (`store/`) and every
screen in §7 (Home, session sheet, Stage with the pad, Report, Settings). Feature
work is picked from TickTick. Players now hold
real v1 state, so a schema change old data can't load needs a version bump and a
migration (`storage/migrate.ts`).

## DESIGN.md — the spec

All requirements live in [DESIGN.md](doc/DESIGN.md), cited by section (e.g. §4
unlocking, §6.3 Melody). Read the sections a change touches before coding; don't
re-decide things it already resolves (§9 lists resolved questions). When a change
intentionally alters product behavior, update [DESIGN.md](doc/DESIGN.md) in the
same commit.

It records **decisions and their rationale**, not type declarations: for shapes it
describes what they mean and points at the source file. Keep it that way — don't
paste `interface` blocks, directory trees or dependency lists into it. Those drift
unnoticed; the prose is what can't be recovered by opening the code. Build
sequencing stays out of it too.

The spec is versioned: [CHANGELOG.md](doc/CHANGELOG.md) holds the revision history
and `package.json` mirrors the current spec version. A behavior change adds a
MINOR entry to the changelog and bumps both, in the same commit as the DESIGN.md
edit; wording-only changes are a PATCH. Don't date code comments by hand — `git
blame` does that better; only comment a version where current behavior must be
read against a previous one (migrations, schema notes).

## Commands

Local `npm` is buggy on this machine: use `npx npm@11 …` for installs
(`npx npm@11 install`, `npx npm@11 install -D pkg`). `npm run …` scripts work.

```sh
npm run dev                         # dev server (http://localhost:5173)
npm test                            # all tests, single run
npm test -- src/audio/piano.test.ts # single test file
npm test -- -t "name"               # tests matching name
npm run test:watch                  # vitest watch mode
npm run lint                        # oxlint (not ESLint)
npm run format                      # prettier --write (md files ignored)
npm run build                       # tsc -b typecheck + vite build
```

CI (GitHub Actions) runs lint → format:check → test → build; run these locally
before committing.

## Architecture ([DESIGN.md](doc/DESIGN.md) §8)

The core rule: **the domain core is pure TypeScript with no DOM or audio
dependencies** — degrees, presets, unlocking, grading, weighting, melody
generation and the persistence schema — and is unit-tested directly. Only the
edges touch the platform:

- `src/audio/` — Web Audio behind one small interface (play these notes at this
  time; start / retune / stop the drone), so the oscillator synth can later be
  swapped for samples. `piano.ts` and `context.ts` are ported from PlayingChord.
- `src/components/` + `src/store/` (Zustand) — UI layer.

The core, following PlayingChord: `src/theory/` (degrees, register, presets
as data), `src/practice/` (stats, confusions, unlocking, the dealer, melody
generation, daily time, settings), `src/storage/` (schema-versioned
persistence, JSON export/import).

Code is **copied** from PlayingChord, not shared, until the two drift enough to
justify a package (§9). When porting, check PlayingChord's version first — it
has solved most session/stats/storage shapes already.

## Conventions

- TypeScript is `strict` **plus `noUncheckedIndexedAccess`** — expect
  `T | undefined` from array indexing.
- Prettier: no semicolons, single quotes; `*.md` is ignored (docs stay
  hand-formatted). Line endings are LF, enforced via `.gitattributes`.
- Presets and their unlock orders are *data*, not logic (§4).
- Degrees are always written as numbers with ♭/♯ (1, ♭2, 2 … ♯4 … 7), never as
  note names (§3).

## Git

Work happens on `dev`; `master` is the deployed branch (CI and the Pages deploy
run on pushes to it), updated by fast-forwarding it to `dev`
(`git push origin dev:master`) — only when asked. Commit only when asked. Origin is
GitHub (`github.com/PlayingSpree/PlayingMelodies`), live at
https://playingspree.github.io/PlayingMelodies/; a self-hosted Gitea pull-mirrors it.

## Working with me

- **Clarify and confirm before acting.** Before making changes, restate how you
  understand the request (scope, approach, files touched) and wait for my
  go-ahead. If anything is ambiguous — unclear scope, more than one reasonable
  interpretation, or a detail the spec doesn't resolve — ask a short clarifying
  question instead of guessing and building the wrong thing.
- Exceptions: simple, unambiguous requests (a one-line fix, a rename, a typo) and
  read-only work (answering questions, exploring or explaining code, running
  tests) can proceed without confirmation.
- In design talks, recommend one shape rather than a battery of options.

## Task tracker (TickTick)

This project's open tasks live in TickTick (`ticktick` MCP server): list
**🤖Claude Projects** (project id `6abf47718f088b3af757530f`), column
**PlayingMelodies** (id `6ac1c9068f084dbfa89e41c5`). The user edits it from the
phone app, so re-read it instead of relying on what the session saw earlier.

- "Add a todo" / "remind me to …" → create a task there. Keep the title short; put the detail in `content`.
- "What's left?" / "my tasks" → list its open tasks.
- When you're confident the work a task covers is done, mark it complete and tell the user you did. At the end of a session, offer to log feature or idea follow-ups only — build and implementation steps never go in TickTick (they live in the status line above); don't add tasks unasked.
- Don't write `#` followed by a word or number in titles or content: TickTick turns it into a tag. Write "item 3", not "#3".
- Keep secrets, credentials and vulnerability details out of task text; point to the local file instead.
