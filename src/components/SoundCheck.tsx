// Temporary: a sound check for the audio layer on a real phone (DESIGN.md §2
// asks for iOS audio to be verified on a device). Goes when the screens of §7
// arrive.
import { useState } from 'react'
import { sound } from '../audio'
import {
  CROSSFADE_MS,
  DEFAULT_SETTINGS,
  pickTonic,
  promptCue,
  tonicMidi,
  wrongCue,
  type PitchClass,
} from '../practice'
import { degreeAt, degreeLabel } from '../theory'

const randomPosition = () => Math.floor(Math.random() * 12)

export default function SoundCheck() {
  const [tonic, setTonic] = useState<PitchClass>(() => pickTonic(null, null))
  const [droneOn, setDroneOn] = useState(false)
  const [heard, setHeard] = useState('')
  const [volumes, setVolumes] = useState({
    drone: DEFAULT_SETTINGS.droneVolume,
    note: DEFAULT_SETTINGS.noteVolume,
  })

  const changeVolume = (key: 'drone' | 'note', value: number) => {
    const next = { ...volumes, [key]: value }
    setVolumes(next)
    sound.setVolumes(next)
  }

  const toggleDrone = () => {
    sound.setVolumes(volumes)
    if (droneOn) sound.stopDrone()
    else sound.startDrone(tonicMidi(tonic))
    setDroneOn(!droneOn)
  }

  const retune = () => {
    const next = pickTonic(null, tonic)
    setTonic(next)
    if (droneOn) sound.retuneDrone(tonicMidi(next), CROSSFADE_MS)
  }

  const playPositions = (positions: number[]) => {
    sound.setVolumes(volumes)
    sound.silence()
    sound.play(tonicMidi(tonic), promptCue(positions, 'normal'))
    setHeard(positions.map((p) => degreeLabel(degreeAt(p))).join(' '))
  }

  const playWrong = () => {
    const played = randomPosition()
    const tapped = degreeAt(played + 1 + Math.floor(Math.random() * 11))
    sound.setVolumes(volumes)
    sound.silence()
    sound.play(tonicMidi(tonic), wrongCue(played, tapped))
    setHeard(
      `tapped ${degreeLabel(tapped)}, was ${degreeLabel(degreeAt(played))}`,
    )
  }

  const button =
    'rounded-xl border-2 border-card-border bg-card px-4 py-3 font-bold active:translate-y-0.5'

  return (
    <section className="mt-8 flex w-full max-w-sm flex-col gap-3 rounded-2xl border-2 border-muted-border p-4">
      <h2 className="text-lg font-extrabold">Sound check</h2>
      <div className="grid grid-cols-2 gap-2">
        <button
          className={`${button} ${droneOn ? 'border-primary text-primary-light' : ''}`}
          onClick={toggleDrone}
        >
          Drone {droneOn ? 'on' : 'off'}
        </button>
        <button className={button} onClick={retune}>
          New tonic
        </button>
        <button
          className={button}
          onClick={() => playPositions([randomPosition()])}
        >
          Note
        </button>
        <button
          className={button}
          onClick={() =>
            playPositions(Array.from({ length: 5 }, randomPosition))
          }
        >
          Melody
        </button>
        <button className={button} onClick={playWrong}>
          Wrong answer
        </button>
        <button className={button} onClick={() => sound.silence()}>
          Silence
        </button>
      </div>
      <p className="min-h-5 text-sm font-semibold text-ink-soft">{heard}</p>
      {(['drone', 'note'] as const).map((key) => (
        <label
          key={key}
          className="flex items-center gap-3 text-sm font-semibold"
        >
          <span className="w-12 capitalize">{key}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volumes[key]}
            onChange={(e) => changeVolume(key, Number(e.target.value))}
            className="flex-1 accent-primary"
          />
        </label>
      ))}
    </section>
  )
}
