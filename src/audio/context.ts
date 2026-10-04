// Shared Web Audio context (DESIGN.md §8): every voice plays through one
// AudioContext, so there's a single autoplay-unlock state and a single
// priming path.

export type AudioContextFactory = () => AudioContext | null

const defaultFactory: AudioContextFactory = () =>
  typeof AudioContext === 'undefined' ? null : new AudioContext()

export class SharedAudioContext {
  private context: AudioContext | null = null
  private readonly create: AudioContextFactory

  constructor(create: AudioContextFactory = defaultFactory) {
    this.create = create
  }

  // Create/resume the context ahead of the first sound. Browsers (iOS
  // Safari above all, §2) unlock audio only inside a user gesture, so this
  // must run from one — the session's Start tap, or the first pointer/key
  // event (primeOnFirstGesture below). Safe to call any number of times.
  prime(): void {
    this.context ??= this.create()
    if (this.context?.state === 'suspended') void this.context.resume()
  }

  // The context, but only once it's actually running — callers drop the
  // sound instead of queueing it for later.
  running(): AudioContext | null {
    this.prime()
    return this.context?.state === 'running' ? this.context : null
  }
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
