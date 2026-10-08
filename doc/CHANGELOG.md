# Changelog

Spec versions for [DESIGN.md](DESIGN.md). The version is the **spec's**, not the
build's: `package.json` tracks it so a screenshot can be traced to the rules that
produced it.

- **MAJOR** — a structural rework of the domain model or the UI shell.
- **MINOR** — a product behavior change.
- **PATCH** — wording, clarification, or restructuring with no behavior change.

---

## 0.15.0 — 2026-10-08

**Alternate starts each session up or down at random**, instead of always up,
so neither way always comes first (§6.1).

## 0.14.0 — 2026-10-08

**A setting picks which parts of the feedback notes play.** The wrong note, the
correct note and its resolve each turn on or off, all on by default. The resolve
needs the correct note and is dropped with it; a held correct note doesn't count
toward alternate's switch. With nothing left to play an answer gets the silent
feedback, and a miss is never held shorter than that. In Melody the wrong and
correct notes of each pair follow the setting and the replay always plays
(§6.1, §6.3, §7.5).

## 0.13.0 — 2026-10-07

**Stats and confusions are per preset.** Grades and stars are kept per preset,
then per degree, instead of once per degree for every preset, so a grade earned
in Major no longer stands for Chromatic. The confusion log tags each entry with
its preset, and the dealer reads only the current preset's. Passing reads the
newest 5 of the preset's grade window instead of a separate pass window, which
now held the same answers. A preset reset clears its stats and confusions too.
Schema v2: the shared v1 stats, the confusions and the pass windows are dropped
(a pass partway done starts over); unlocks, passes, daily time and settings
carry over (§4, §5, §7.5, §8, §9).

## 0.12.0 — 2026-10-07

**A key cue plays 1–5–1 when a tonic comes in.** At Start, on each tonic change
and on Resume, the 1, the 5 and the octave 1 play on the tonic in place of the
settle pause, their pad keys lit as they sound, then a short gap before the
prompt. A setting turns it off, on by default (§3.2, §7.3, §7.5).

## 0.11.0 — 2026-10-07

**A session pauses in the background.** When the app is hidden mid-session, the
notes and the drone stop and every wait holds — feedback, the next prompt, Speed's
limit. A Paused cover waits for a Resume tap, which restarts the drone and
settles; an open prompt then plays again with its response time and Speed limit
started over and Melody's filled slots kept, while cut-off feedback moves on to
what followed it (§6, §7.3).

## 0.10.0 — 2026-10-06

**Feedback notes can follow low grades and resolve a chosen way.** A fourth
feedback-notes option, low grades, plays on every miss and on right answers to a
degree graded below a chosen bar (B, C or D), an ungraded one included; Melody
reads the melody grade. A second setting picks which tonic the correct note
resolves to: closest (as before), always up, always down, alternating every 1–10
resolves, or random. Settings gets its own Feedback section (§6.1, §7.5).

## 0.9.0 — 2026-10-05

**Combined is Chromatic, and presets start at different counts.** The all-12
preset is renamed Chromatic, its id included: progress saved under Combined is
dropped on load and Chromatic starts fresh, while the shared degree stats stay.
Each preset now has its own starting count: Major
opens 2 degrees as before, Minor 3 (1 5 ♭3) and Chromatic 4 (1 5 3 ♭3). Saved
progress below the new count is raised to it on load (§1, §4).

## 0.8.0 — 2026-10-05

**Home has a tab per mode, each with preset grades.** Notes / Speed / Melody tabs
list the presets with only that mode's ratings, and each card shows a preset
grade: the unlocked degrees' letter grades averaged and rounded down, the rated
degrees' stars averaged and rounded down, or the melody grade. A card whose mode
is still locked says what opens it. The tab picks the session's mode, so the
session sheet loses its mode picker; Home reopens on the last tab used (§5, §6,
§7.1, §7.2, §8).

## 0.7.0 — 2026-10-05

**Feedback notes are a setting.** Settings chooses which answers play the feedback
notes: misses only (the default), every answer — a right one plays the correct
note resolving to the tonic — or never, where a miss stays on screen ~2 s instead.
In Melody, a clean melody no longer replays unless every answer is chosen (§6.1,
§6.3, §7.5).

## 0.6.0 — 2026-10-04

**Clearer miss feedback.** The correct note plays once, after a short silent pause
following the tapped note, then resolves to the tonic; Melody's tapped-versus-correct
pairs get the same pause. While feedback plays, each note's pad key lights up as it
sounds. The feedback text is gone: a right answer shows the degree with a ✓, a miss
the tapped degree with a ✗ beside the correct one with a ✓ (§6.1–§6.3, §7.3).

## 0.5.0 — 2026-10-04

**Home offers updates.** When a new version has downloaded, Home shows an Update
ready card with a Reload; the app checks on launch and on returning to the
foreground. An ignored update still takes over once the app is fully closed (§2,
§7.1).

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
