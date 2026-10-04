import SoundCheck from './components/SoundCheck'

// Placeholder shell until the screens of DESIGN.md §7 are built.
export default function App() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-surface px-4 text-ink">
      <h1 className="text-4xl font-extrabold tracking-tight">
        PlayingMelodies
      </h1>
      <p className="text-sm font-semibold text-ink-muted">
        v{__APP_VERSION__}
        {__APP_BRANCH__ &&
          __APP_BRANCH__ !== 'master' &&
          ` · ${__APP_BRANCH__}`}
      </p>
      <SoundCheck />
    </main>
  )
}
