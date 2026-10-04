# PlayingMelodies

A phone web app for ear training: a drone holds the tonic, the app plays a note or
a short melody over it, and you tap the scale degree you heard.

See **[DESIGN.md](doc/DESIGN.md)** for the full product/technical design.

> Created by an LLM (Claude Code).

## Requirements

- Any current browser with Web Audio — phone browsers first, iPhone Safari
  included. Installable to the home screen and works offline.
- Node.js 24+ for development.

## Development

```sh
npm install
npm run dev        # start the dev server
npm test           # run unit tests (vitest)
npm run lint       # oxlint
npm run format     # prettier
npm run build      # typecheck + production build
```

Stack: React + TypeScript + Vite, Zustand, Tailwind CSS, Vitest. Client-side only —
no accounts, no server; everything persists to `localStorage`.

## Deployment

The app is a fully static site. `npm run build` produces `dist/` with a **relative
base path**, so the output runs from any static host or subdirectory unchanged.
