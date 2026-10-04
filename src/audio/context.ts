// Shared Web Audio context (DESIGN.md §8): every voice plays through one
// AudioContext, so there's a single autoplay-unlock state and a single
// priming path.

export type AudioContextFactory = () => AudioContext | null

// Safari's Audio Session API (16.4+), not yet in TypeScript's DOM lib.
interface AudioSessionNavigator {
  audioSession?: { type: string }
}

const defaultFactory: AudioContextFactory = () => {
  if (typeof AudioContext === 'undefined') return null
  // iOS mutes Web Audio under the ring/silent switch (§2) unless the page
  // declares itself a playback app, the way a music player does. Set before
  // the context exists; browsers without the API ignore it.
  const { audioSession } = navigator as Navigator & AudioSessionNavigator
  if (audioSession) audioSession.type = 'playback'
  return new AudioContext()
}

export class SharedAudioContext {
  private context: AudioContext | null = null
  private readonly create: AudioContextFactory
  private readonly waiting: Array<(ctx: AudioContext) => void> = []

  constructor(create: AudioContextFactory = defaultFactory) {
    this.create = create
  }

  // Create/resume the context ahead of the first sound. Browsers (iOS
  // Safari above all, §2) unlock audio only inside a user gesture, so this
  // must run from one — the session's Start tap, or the first pointer/key
  // event (primeOnFirstGesture below). Safe to call any number of times.
  prime(): void {
    if (this.context === null) {
      this.context = this.create()
      if (this.context) this.context.onstatechange = () => this.flush()
    }
    // 'suspended' before the unlock; iOS also has 'interrupted', after a
    // call or a trip to the background.
    const state: string | undefined = this.context?.state
    if (state !== undefined && state !== 'running' && state !== 'closed') {
      void this.context?.resume()
    }
  }

  // The context, but only once it's actually running — callers drop the
  // sound instead of queueing it for later.
  running(): AudioContext | null {
    this.prime()
    return this.context?.state === 'running' ? this.context : null
  }

  // For the one sound that must not be dropped (the drone): run `fn` now if
  // the context is running, otherwise as soon as it starts. The Start tap
  // primes and starts the drone in the same tick, before resume() settles.
  whenRunning(fn: (ctx: AudioContext) => void): void {
    const ctx = this.running()
    if (ctx) fn(ctx)
    else this.waiting.push(fn)
  }

  private flush(): void {
    const ctx = this.context
    if (ctx?.state !== 'running') return
    for (const fn of this.waiting.splice(0)) fn(ctx)
  }
}

// A 0–1 volume setting as a gain: squared, so the slider's travel feels
// even to the ear rather than bunching all the change at the bottom.
export function volumeGain(volume: number): number {
  return Math.min(1, Math.max(0, volume)) ** 2
}

// The app-wide instance; tests construct their own.
export const sharedAudioContext = new SharedAudioContext()

// One-shot gesture hooks so the context is already running by the first
// sound: pointer for touch/mouse, keydown for keyboard users. Both fire
// prime() (idempotent); returns a cleanup for React effects.
export function primeOnFirstGesture(
  target: Pick<Window, 'addEventListener' | 'removeEventListener'> = window,
  instance: { prime(): void } = sharedAudioContext,
): () => void {
  const prime = () => instance.prime()
  target.addEventListener('pointerdown', prime, { once: true })
  target.addEventListener('keydown', prime, { once: true })
  return () => {
    target.removeEventListener('pointerdown', prime)
    target.removeEventListener('keydown', prime)
  }
}
