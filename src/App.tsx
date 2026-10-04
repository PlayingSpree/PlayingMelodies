// The app shell (DESIGN.md §7): the view follows the session — none is Home,
// a running one the Stage, a finished one its Report — with the session
// sheet over Home.
import { useState } from 'react'
import { Home } from './components/Home'
import { Report } from './components/Report'
import { SessionSheet } from './components/SessionSheet'
import { Stage } from './components/Stage'
import { usePractice } from './store'
import type { PresetId } from './theory'

export default function App() {
  const phase = usePractice((s) => s.session?.phase.kind ?? null)
  const [sheet, setSheet] = useState<PresetId | null>(null)

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] text-ink">
      {phase === null && <Home onOpen={setSheet} />}
      {phase === 'done' && <Report />}
      {phase !== null && phase !== 'done' && <Stage />}
      {phase === null && sheet !== null && (
        <SessionSheet presetId={sheet} onClose={() => setSheet(null)} />
      )}
    </main>
  )
}
