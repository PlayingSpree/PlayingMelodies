# PlayingMelodies — Design Document

A phone web app for ear training. A constant drone sounds the tonic; the app plays a
note — or a short melody — over it, and the player taps which scale degree they
heard. Sister app to PlayingChord: same look, same session shape, no MIDI.

Spec version: **0.2.1** (2026-10-04). Revision history lives in
[CHANGELOG.md](CHANGELOG.md); this document describes only what the app *is*. Build
sequencing is intentionally left outside this document.

**Key decisions:**
- **Relative pitch over a drone.** Every prompt is heard against a constant tonic
  drone (tonic + fifth), Sonofield-style, and answered as a scale degree — never as
  an absolute note name (§3).
- **Tap to answer.** A fixed 12-degree pad on a phone screen; no MIDI, no keyboard
  required (§7.3).
- **Three session modes:** **Notes** (one degree at a time — where degrees are
  learned and unlocked), **Speed** (the same against a fixed 5 s limit, rated in
  stars), and **Melody** (2–6 degrees in a row, entered in order) (§6).
- **Presets:** Major, Minor and Combined (all 12 degrees), each unlocking
  flashcard-style — 2 degrees open, 1 more each time everything open has passed (§4).
- **Stats are per degree**, independent of tonic and octave; unlock progress is per
  preset (§5).
- Client-side only: an installable, offline PWA persisting to `localStorage`, with
  JSON export/import (§2).

---

## 1. Goals

- Train hearing a note's **function** — its scale degree against a tonic — so the
  skill carries into playing, singing and transcribing.
- Make practice fit a phone: short sessions, one thumb, no hardware.
- Learn degrees in small batches, the way PlayingChord learns chords, with misses
  dealt again more often and the degrees a player confuses dealt *together*.
- Grow from single notes to melodies, and from hearing a degree at all to hearing
  it fast.
- Track a daily practice-time goal and streak.

### Non-goals

- **No absolute pitch.** Notes are never named as C, F♯ …; the tonic is random by
  default precisely so nothing can be learned by pitch memory (§3.2). The tonic
  lock is the one exception: it picks a pitch, so it names one.
- **No rhythm.** Melody notes are evenly spaced; rhythm dictation is a different
  skill (§6.3).
- **No chords or intervals as answers.** Chord-by-ear lives in PlayingChord, where
  the answer is played on a MIDI keyboard.
- **No backend or accounts** in this version. Everything persists locally with JSON
  export/import; cross-device sync is a possible later addition.
- No daily-practice pool and no detailed stats screen (yet) — with 12 degrees,
  Home shows everything (§7.1).

---

## 2. Tech Stack

React + TypeScript + Vite, Zustand for state, Tailwind, Web Audio for sound,
Vitest for tests — the same stack as PlayingChord, so its patterns and tooling carry
over. `package.json` is the authority on what's actually installed.

**Target:** phone browsers, iPhone Safari first-class. Web Audio is the only
platform API the app needs, which every current mobile browser has — this is the
reason PlayingMelodies is a separate app rather than a PlayingChord mode
(PlayingChord blocks Safari for lack of Web MIDI).

**Installable and offline.** A PWA: a manifest makes it installable to the home
screen as a full-screen app, and a service worker precaches the whole build, so it
runs with no network once visited. It asks for **persistent** storage, since
`localStorage` holds the only copy of the player's stats.

**iOS audio** needs verifying on a real device before the audio layer is built on:
audio can only start from a user gesture (the session's Start tap does it), and
Safari may silence Web Audio when the ring/silent switch is set to silent.

No backend. The app is a static site deployed to GitHub Pages.

---

## 3. Domain Model

**Terms.**
- **Degree** — one of the 12 chromatic scale degrees, written as numbers:
  1, ♭2, 2, ♭3, 3, 4, ♯4, 5, ♭6, 6, ♭7, 7. The unit of everything: it is what is
  asked, answered, unlocked, passed, graded and weighted.
- **Tonic** — the pitch the drone sounds; degrees are heard relative to it.
- **Preset** — a named, ordered set of degrees (§4).
- **Prompt** — one thing to answer: a single degree (Notes, Speed) or a sequence of
  degrees (Melody).
- **Answer** — one graded tap (Notes, Speed) or one filled-in melody (Melody).

### 3.1 Degrees, not keys

With a drone there is no major or minor *key* — only a tonic, against which each of
the 12 degrees has its own color. ♭3 and ♭7 are as basic over a drone as 3 and 7,
which is why the pad is always chromatic (§7.3) and why "Major" and "Minor" are
just presets choosing which degrees to drill.

### 3.2 The tonic

- **Random per session** by default, so nothing can be learned by remembering a
  pitch. The session sheet can **lock** it to a chosen tonic, named by its note
  (C, D♭ … B) — choosing a pitch is the one place a name is the clearest label.
  Everything played over it is still a degree.
- **Change every X answers** (setting: off / 10 / 20 / 30, default off). The new
  tonic is random and always differs from the old one. The drone **crossfades** to
  it over ~2 s, then a ~2 s **settle pause** passes before the next prompt — the
  first note on a new tonic is otherwise heard against the old one.
- Otherwise the drone never stops for the whole session, including between prompts
  and under feedback.

### 3.3 Register

Test notes play in **one octave above the tonic** by default. A setting widens the
range to 2 or 3 octaves: hearing that a degree is the same in every octave is a real
skill, but a second step. Register is never part of a degree's identity — stats
ignore it (§5).

---

## 4. Presets & Unlocking

Three built-in presets, each an **ordered** degree list. The order is the unlock
order and is stored as data, so re-ordering is a one-line edit.

| Preset   | Unlock order                                    |
|----------|-------------------------------------------------|
| Major    | 1 5 3 4 6 2 7                                   |
| Minor    | 1 5 ♭3 4 ♭6 2 ♭7                                |
| Combined | 1 5 3 ♭3 7 ♭7 6 ♭6 4 2 ♭2 ♯4                    |

Every preset opens on 1 and 5, the degrees that merge with the drone; each later
degree adds tension. Minor mirrors Major's shape. Combined is all 12 — not just
Major ∪ Minor, which would leave ♭2 and ♯4 in no preset at all — and introduces
each major/minor partner right after its twin, so the contrast is drilled as soon
as it exists.

**Unlocking** (PlayingChord §5.1's flashcard progression, re-sized):
- A fresh preset starts with its **first 2** degrees unlocked.
- Once **every** unlocked degree has passed, the **next 1** unlocks, until the
  whole preset is open.
- A degree **passes** when **4 of its last 5** Notes answers *in that preset* are
  right — far above guessing (with 3 degrees open, a random tap is right a third
  of the time). The preset keeps its own 5-answer window per degree for this,
  apart from the shared stats (§5), and it must be full: 4 straight right isn't
  yet a pass.
- Passing is a **latch**: a degree that later slips stays passed and its unlocks
  stay open; the live grade is shown elsewhere.
- **Progress is per preset.** Telling 3 from 4 and 5 is easier than telling it from
  ♭3 too, so a pass in Major proves nothing about Combined. Stats, by contrast, are
  shared (§5).
- Only **Notes** answers count toward passing — not Speed, not Melody (§6).
- Progress can be reset per preset in Settings.

---

## 5. Stats, Grades & Weighting

**Keyed per degree only** — 12 records, shared by every preset. The tonic and the
octave a note was played in are deliberately not part of the key: relative pitch is
meant to be one skill on every tonic, and splitting by tonic would spread the data
over 144 slow-filling records. (Should one tonic ever seem to misbehave, it can be
answered from the answer log without changing the key.)

Per degree:
- **Notes outcomes** — the last 10 right/wrong results. The **grade** is a letter
  from accuracy over that window: **A ≥ 90 %, B ≥ 80 %, C ≥ 70 %, D ≥ 60 %, F
  below**, shown as "—" until 5 answers exist. Passing doesn't read this window:
  it reads the preset's own (§4), or answers given in Major would pass a degree
  the moment Combined unlocked it.
- **Speed times** — the last 10 Speed-mode times, a miss or timeout counted as the
  full 5 s limit, so a fast wrong tap can't earn anything. The **star** is from their
  median: **gold < 1 s, silver < 2 s, bronze < 3 s**, none from 3 s up, and none
  until 5 times exist, so one lucky tap can't earn gold. Stars are
  deliberately not letters, so a speed rating is never mistaken for an accuracy
  grade; and "no star" is the visible gap between passing a degree and being fast
  at it. Stars never affect passing.
- **Melody notes** don't touch either — a note heard right after another is partly
  heard against *that* note, a different measurement from a lone note over the
  drone (§6.3).

**Confusions.** Every wrong answer, in any mode, is logged as a **(played, tapped)
pair**. Hearing two degrees side by side is how they're told apart, so when the
dealer weights a missed degree up, it weights the degree it was mistaken for up
too. The Report surfaces the top pairs (§7.4).

**Weighting.** Notes and Speed deal from the eligible degrees with subtle bias
toward recent misses and their confusion partners, never excluding any degree.

---

## 6. Session Modes

A session is started from a preset card on Home (§7.1). Every mode runs over the
drone and ends in the Report (§7.4).

### 6.1 Notes

The core drill, and the only mode that unlocks anything. Deals the preset's
**unlocked** degrees.

- One note plays; the player taps a degree. The **first tap** is graded.
- **Right** → a short confirmation, auto-advance after ~1 s.
- **Wrong** → the app plays the tapped note, then the correct note, then the correct
  note **resolving to the tonic** — the "where does it want to go" cue drone methods
  teach with — and then advances.
- **Replay** is free at any time before answering.
- Response time is recorded and shown on the Report, but never graded here; fast
  guessing is a habit to avoid while a degree is still being learned. Speed is
  Speed mode's job.

### 6.2 Speed

Opens per preset once **every** degree in it has passed, and deals all of them.
Timing degrees not yet heard reliably would only train guessing.

- Plays exactly as Notes, against a **fixed 5 s limit** per note. Running out of
  time is a miss.
- Each answer's time (or 5 s, for a miss) feeds the degree's star (§5).
- Feedback on a miss is the same as in Notes.

### 6.3 Melody

Opens per preset once **3 degrees** have passed in it, and deals only **passed**
degrees — Notes teaches new degrees, Melody practices the ones already known.
Opening at 3 rather than at a fully passed preset lets melodies start early.

- **Length:** 2–6 notes, a session-sheet setting, default 3. It doesn't adapt or
  unlock — the session grade already says when longer melodies are due.
- **Motion:** mostly stepwise between neighboring passed degrees, with occasional
  leaps; starts on any degree; every note stays within the register setting (§3.3).
  Uniformly random notes sound like nothing and are harder to remember than to
  hear, which would drill memory instead of ear.
- **Rhythm:** evenly spaced, ~0.6 s per note, with a slow / normal / fast tempo
  setting.
- **Entry:** a row of slots, one per note; each tap fills the next slot, with an
  undo key. Replay is free until the last slot is filled. Checking happens only
  then — per-note checking would give away the rest of the melody.
- **Feedback:** each slot is marked ✓ or ✗, the melody replays as played, and each
  wrong slot then plays tapped-versus-correct.
- **Grading:** a melody is **clean** only if every note is right. The preset's
  **melody grade** is the share of clean melodies over its last 10, on the same
  letter bands as §5. Wrong notes feed the confusion log; nothing else (§5).

---

## 7. UI / Screens

Same visual language as PlayingChord — Bricolage Grotesque on dark navy — laid out
for a phone in portrait, one-thumb reachable.

### 7.1 Home

- **Top:** the streak and today's active minutes against the daily goal.
- **One card per preset**, showing unlock progress, a strip of its degrees' letter
  grades, their stars once Speed is open, and the preset's melody grade once Melody
  is open. Tapping a card opens its session sheet.

### 7.2 Session sheet

Mode (Notes / Speed / Melody — each shown locked until it opens), **length**
(10 / 20 / 40 prompts or 3 / 5 / 10 minutes, default 20 prompts — a melody counts
as one prompt), tonic lock, tonic change every X, and for Melody its length and
tempo.

### 7.3 Stage and the answer pad

- The **pad** is all 12 degrees in a fixed, piano-like layout: naturals (1 2 3 4 5 6
  7) on the bottom row, the flats/sharps (♭2 ♭3 ♯4 ♭6 ♭7) raised between them.
- Degrees outside the preset are **blank**; degrees in it but not yet unlocked are
  **dimmed**. Nothing ever moves, so the thumb learns positions along with the ear.
- Above the pad: replay, the session's progress, and — in Speed — the time limit
  draining; in Melody, the answer slots and undo.

### 7.4 Report

Accuracy; per-degree grades with deltas since the previous session; the **top 3
confusions**; anything newly passed or unlocked; average response time (Notes,
Melody) or stars earned (Speed); the goal line.

### 7.5 Settings

Drone volume, note volume, register (1 / 2 / 3 octaves), daily goal minutes
(default 10), JSON export/import, and reset progress per preset.

---

## 8. Project Structure

Same rule as PlayingChord: **the domain core — degrees, presets, unlocking,
grading, weighting, melody generation and the persistence schema — is pure
TypeScript with no DOM or audio dependencies** and is unit-tested directly. Only
`audio/`, `components/` and `store/` touch the platform.

**Audio** sits behind one small interface — play these notes at this time, plus
start/retune/stop the drone — so the oscillator synth (piano-ish voice for test
notes, ported from PlayingChord's `piano.ts`; a new sustained voice for the drone,
which must not decay) can be swapped for sampled sounds later without touching the
rest.

**Persisted shapes:** a per-degree stat record (Notes outcome window, Speed time
window), the confusion log of (played, tapped) pairs, a per-preset progress record
(unlocked count, a 5-answer pass window per degree, passed degrees, melody
outcome window), daily records (date, active minutes) and settings.
Schema-versioned from the start.

---

## 9. Resolved Questions

1. **Separate app, or a PlayingChord mode?** — *Separate.* Tap answers on a phone
   need iPhone Safari, which PlayingChord's Web MIDI requirement blocks, and a
   touch-first layout it doesn't have. Chord-by-ear, which *is* answered on a MIDI
   keyboard, belongs in PlayingChord instead. Code is copied, not shared, until the
   two drift enough to justify a package.
2. **Absolute or relative?** — *Relative, over a drone.* Absolute pitch barely
   trains in adults; degree-against-tonic transfers to playing and extends directly
   to melodies. A constant drone replaces a cadence as the key reference.
3. **Grade speed?** — *Separately, as stars, in its own mode.* Notes never times the
   player; Speed has a fixed limit and stars that can't be confused with letter
   grades or affect passing.
