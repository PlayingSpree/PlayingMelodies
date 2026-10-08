// The app shell (DESIGN.md §7): the view follows the session — none is Home,
// a running one the Stage, a finished one its Report — with the session
// sheet over Home. Settings stands in for Home while no session runs.
import { useState } from 'react'
import { Home } from './components/Home'
import { Report } from './components/Report'
import { SessionSheet } from './components/SessionSheet'
import { Settings } from './components/Settings'
import { Stage } from './components/Stage'
import { usePractice } from './store'
import type { PresetId } from './theory'

export default function App() {
  const phase = usePractice((s) => s.session?.phase.kind ?? null)
  const [sheet, setSheet] = useState<PresetId | null>(null)
  const [settings, setSettings] = useState(false)
  const home = phase === null && !settings

  // The shell is a fixed box that scrolls itself rather than a page sized in
  // dvh: Chrome on Android can keep a stale, too-tall dvh after the update's
  // reload until the app relaunches, which overflowed the Stage. A fixed box
  // always covers exactly the screen the browser shows.
  return (
    <div className="fixed inset-0 overflow-y-auto bg-surface">
      <main className="mx-auto flex min-h-full w-full max-w-md flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] text-ink">
        {home && (
          <Home onOpen={setSheet} onSettings={() => setSettings(true)} />
        )}
        {phase === null && settings && (
          <Settings onBack={() => setSettings(false)} />
        )}
        {phase === 'done' && <Report />}
        {phase !== null && phase !== 'done' && <Stage />}
        {home && sheet !== null && (
          <SessionSheet presetId={sheet} onClose={() => setSheet(null)} />
        )}
      </main>
    </div>
  )
}
