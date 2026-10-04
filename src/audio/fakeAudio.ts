// Test-only: a minimal structural fake of the Web Audio surface the voices
// touch. Params record their automation events; nodes record where they're
// connected; the context only advances time when a test sets currentTime.

import { SharedAudioContext } from './context'

export interface ParamEvent {
  kind: 'set' | 'linear' | 'exp' | 'target' | 'cancel'
  value: number
  at: number
}

export class FakeParam {
  value: number
  events: ParamEvent[] = []

  constructor(value = 0) {
    this.value = value
  }

  setValueAtTime(value: number, at: number) {
    this.value = value
    this.events.push({ kind: 'set', value, at })
  }

  linearRampToValueAtTime(value: number, at: number) {
    this.value = value
    this.events.push({ kind: 'linear', value, at })
  }

  exponentialRampToValueAtTime(value: number, at: number) {
    this.value = value
    this.events.push({ kind: 'exp', value, at })
  }

  setTargetAtTime(value: number, at: number) {
    this.value = value
    this.events.push({ kind: 'target', value, at })
  }

  cancelScheduledValues(at: number) {
    this.events.push({ kind: 'cancel', value: 0, at })
  }

  last(kind: ParamEvent['kind']): ParamEvent | undefined {
    return this.events.filter((e) => e.kind === kind).at(-1)
  }
}

export class FakeNode {
  outputs: unknown[] = []

  connect<T>(node: T): T {
    this.outputs.push(node)
    return node
  }
}

export class FakeOscillator extends FakeNode {
  type = ''
  frequency = new FakeParam()
  startedAt: number[] = []
  stoppedAt: number[] = []

  start(at: number) {
    this.startedAt.push(at)
  }

  stop(at: number) {
    this.stoppedAt.push(at)
  }
}

export class FakeGain extends FakeNode {
  gain = new FakeParam(1)
}

export class FakeFilter extends FakeNode {
  type = ''
  frequency = new FakeParam()
  Q = new FakeParam()
}

export class FakeAudioContext {
  state: AudioContextState = 'running'
  currentTime = 2
  destination = new FakeNode()
  oscillators: FakeOscillator[] = []
  gains: FakeGain[] = []
  filters: FakeFilter[] = []
  resumeCalls = 0
  onstatechange: (() => void) | null = null

  createOscillator() {
    const osc = new FakeOscillator()
    this.oscillators.push(osc)
    return osc
  }

  createGain() {
    const gain = new FakeGain()
    this.gains.push(gain)
    return gain
  }

  createBiquadFilter() {
    const filter = new FakeFilter()
    this.filters.push(filter)
    return filter
  }

  // resume() deliberately does NOT flip state — real contexts stay
  // 'suspended' until the unlock lands, which is the window the drone must
  // wait out. Tests call unlock() to land it.
  resume() {
    this.resumeCalls += 1
    return Promise.resolve()
  }

  unlock() {
    this.state = 'running'
    this.onstatechange?.()
  }

  // Oscillators that haven't been told to stop.
  sounding(): FakeOscillator[] {
    return this.oscillators.filter((o) => o.stoppedAt.length === 0)
  }
}

export function sharedOn(ctx: FakeAudioContext): SharedAudioContext {
  return new SharedAudioContext(() => ctx as unknown as AudioContext)
}
