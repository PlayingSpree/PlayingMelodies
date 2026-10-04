# Changelog

Spec versions for [DESIGN.md](DESIGN.md). The version is the **spec's**, not the
build's: `package.json` tracks it so a screenshot can be traced to the rules that
produced it.

- **MAJOR** — a structural rework of the domain model or the UI shell.
- **MINOR** — a product behavior change.
- **PATCH** — wording, clarification, or restructuring with no behavior change.

---

## 0.1.0 — 2026-10-04

**First draft.** Relative-pitch ear training over a tonic + fifth drone, answered
on a fixed 12-degree tap pad (§3, §7.3). Major, Minor and Combined presets unlock
2 degrees, then 1 at a time, each passing at 4 of its last 5 (§4). Stats are per
degree; misses are logged as confusion pairs that weight both degrees (§5). Three
modes: Notes, Speed (fixed 5 s limit, bronze–gold stars) and Melody (2–6 degrees,
graded clean-or-not) (§6). Installable offline PWA for phone browsers, iPhone
Safari included (§2).
