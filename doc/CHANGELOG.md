# Changelog

Spec versions for [DESIGN.md](DESIGN.md). The version is the **spec's**, not the
build's: `package.json` tracks it so a screenshot can be traced to the rules that
produced it.

- **MAJOR** — a structural rework of the domain model or the UI shell.
- **MINOR** — a product behavior change.
- **PATCH** — wording, clarification, or restructuring with no behavior change.

---

## 0.4.0 — 2026-10-04

**The session sheet remembers its choices across reloads.** The last session's
mode, length, tonic lock, change interval, melody length and tempo are saved,
shared by all presets, and travel in an export (§7.2, §8).

## 0.3.0 — 2026-10-04

**Settings gets a test sound.** The drone with a few degrees over it plays until
stopped, so the volumes can be set by ear. Also spelled out: export/import is the
whole stored state, and an import asks before replacing it; a preset reset clears
that preset's progress only, leaving the shared stats and daily time (§7.5).

## 0.2.1 — 2026-10-04

**The tonic lock names its pitch.** The session sheet's tonic lock lists the 12
tonics by note name (C, D♭ … B); the "never a note name" rule is about degrees,
and choosing a pitch is the one place a name is the clearest label (§1, §3.2).

## 0.2.0 — 2026-10-04

**Passing reads per-preset answers.** Each preset keeps its own last-5 Notes
window per degree, and a degree passes on 4 right in a full window — so answers
given in Major no longer pass a degree the moment Combined unlocks it, as reading
the shared stats window did (§4, §5, §8). Stars, like grades, need 5 timed
answers before one shows (§5).

## 0.1.0 — 2026-10-04

**First draft.** Relative-pitch ear training over a tonic + fifth drone, answered
on a fixed 12-degree tap pad (§3, §7.3). Major, Minor and Combined presets unlock
2 degrees, then 1 at a time, each passing at 4 of its last 5 (§4). Stats are per
degree; misses are logged as confusion pairs that weight both degrees (§5). Three
modes: Notes, Speed (fixed 5 s limit, bronze–gold stars) and Melody (2–6 degrees,
graded clean-or-not) (§6). Installable offline PWA for phone browsers, iPhone
Safari included (§2).
