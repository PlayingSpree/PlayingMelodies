import { describe, expect, it } from 'vitest'
import { primeOnFirstGesture, SharedAudioContext } from './context'
import { FakeAudioContext, sharedOn } from './fakeAudio'

const asContext = (fake: FakeAudioContext) => fake as unknown as AudioContext

describe('SharedAudioContext', () => {
  it('creates the context once and reuses it', () => {
    const ctx = new FakeAudioContext()
    let created = 0
    const shared = new SharedAudioContext(() => {
      created += 1
      return asContext(ctx)
    })
    shared.prime()
    shared.running()
    shared.running()
    expect(created).toBe(1)
  })

  it('does nothing without Web Audio (factory yields null)', () => {
    const shared = new SharedAudioContext(() => null)
    expect(() => {
      shared.prime()
      shared.whenRunning(() => {
        throw new Error('never runs')
      })
      expect(shared.running()).toBeNull()
    }).not.toThrow()
  })

  it('stays silent while the context is suspended, but asks it to resume', () => {
    const ctx = new FakeAudioContext()
    ctx.state = 'suspended'
    expect(sharedOn(ctx).running()).toBeNull()
    expect(ctx.resumeCalls).toBe(1)
  })

  it('resumes an interrupted context (iOS, after a call)', () => {
    const ctx = new FakeAudioContext()
    ctx.state = 'interrupted' as AudioContextState
    sharedOn(ctx).prime()
    expect(ctx.resumeCalls).toBe(1)
  })

  it('returns the context once running', () => {
    const ctx = new FakeAudioContext()
    expect(sharedOn(ctx).running()).toBe(asContext(ctx))
  })
})

describe('whenRunning', () => {
  it('runs at once on a running context', () => {
    const ctx = new FakeAudioContext()
    const ran: unknown[] = []
    sharedOn(ctx).whenRunning((c) => ran.push(c))
    expect(ran).toEqual([ctx])
  })

  it('waits for the unlock, then runs each callback once, in order', () => {
    const ctx = new FakeAudioContext()
    ctx.state = 'suspended'
    const shared = sharedOn(ctx)
    const ran: string[] = []
    shared.whenRunning(() => ran.push('a'))
    shared.whenRunning(() => ran.push('b'))
    expect(ran).toEqual([])
    ctx.unlock()
    expect(ran).toEqual(['a', 'b'])
    ctx.onstatechange?.()
    expect(ran).toEqual(['a', 'b'])
  })
})

describe('primeOnFirstGesture', () => {
  it('primes on the first gesture and cleans its listeners up', () => {
    const ctx = new FakeAudioContext()
    ctx.state = 'suspended'
    const shared = sharedOn(ctx)
    const listeners = new Map<string, EventListener>()
    const target = {
      addEventListener: (type: string, fn: EventListener) => {
        listeners.set(type, fn)
      },
      removeEventListener: (type: string) => {
        listeners.delete(type)
      },
    } as unknown as Window

    const cleanup = primeOnFirstGesture(target, shared)
    expect([...listeners.keys()].sort()).toEqual(['keydown', 'pointerdown'])
    listeners.get('pointerdown')?.(new Event('pointerdown'))
    expect(ctx.resumeCalls).toBe(1)
    cleanup()
    expect(listeners.size).toBe(0)
  })
})
