import { describe, expect, it } from 'vitest'
import { getPreset, type Degree } from '../theory'
import { emptyStatsMap, type DegreeStatsMap } from './stats'
import {
  dealableDegrees,
  freshProgress,
  isModeOpen,
  melodyGrade,
  passedDegrees,
  passesWindow,
  presetGrade,
  presetStar,
  recordMelodyOutcome,
  recordNotesAnswer,
  unlockedDegrees,
  type PresetProgress,
} from './progress'

const major = getPreset('major') // 1 5 3 4 6 2 7

function answer(
  progress: PresetProgress,
  degree: Degree,
  ...outcomes: boolean[]
): PresetProgress {
  return outcomes.reduce(
    (p, correct) => recordNotesAnswer(major, p, degree, correct).progress,
    progress,
  )
}

const FIVE_RIGHT = [true, true, true, true, true]

// Passes every open degree, step by step, until `count` are open.
function openUpTo(count: number): PresetProgress {
  let progress = freshProgress(major)
  while (progress.unlockedCount < count) {
    for (const degree of unlockedDegrees(major, progress)) {
      progress = answer(progress, degree, ...FIVE_RIGHT)
    }
  }
  return progress
}

describe('passesWindow', () => {
  it('needs 4 right among the last 5', () => {
    expect(passesWindow([true, false, true, true, true])).toBe(true)
    expect(passesWindow([true, false, true, false, true])).toBe(false)
  })

  it('needs a full window', () => {
    expect(passesWindow([true, true, true, true])).toBe(false)
  })

  it('reads only the newest 5', () => {
    expect(passesWindow([false, false, true, true, true, true, false])).toBe(
      true,
    )
  })
})

describe('freshProgress', () => {
  it("opens the preset's starting degrees", () => {
    expect(unlockedDegrees(major, freshProgress(major))).toEqual([0, 7])
    const minor = getPreset('minor')
    expect(unlockedDegrees(minor, freshProgress(minor))).toEqual([0, 7, 3])
    const chromatic = getPreset('chromatic')
    expect(unlockedDegrees(chromatic, freshProgress(chromatic))).toEqual([
      0, 7, 4, 3,
    ])
  })
})

describe('recordNotesAnswer', () => {
  it('passes a degree at 4 of its last 5', () => {
    const progress = answer(freshProgress(major), 0, true, false, true, true)
    const result = recordNotesAnswer(major, progress, 0, true)
    expect(result.newlyPassed).toBe(0)
    expect(result.progress.passed).toEqual([0])
    expect(result.newlyUnlocked).toEqual([])
  })

  it('opens the next degree once every open one has passed', () => {
    const progress = answer(freshProgress(major), 0, ...FIVE_RIGHT)
    const result = recordNotesAnswer(
      major,
      answer(progress, 7, true, true, true, true),
      7,
      true,
    )
    expect(result.newlyPassed).toBe(7)
    expect(result.newlyUnlocked).toEqual([4])
    expect(unlockedDegrees(major, result.progress)).toEqual([0, 7, 4])
  })

  it('latches a pass when the degree later slips', () => {
    const progress = answer(
      freshProgress(major),
      0,
      ...FIVE_RIGHT,
      ...[false, false, false, false, false],
    )
    expect(progress.passed).toEqual([0])
  })

  it('reports a pass only once', () => {
    const progress = answer(freshProgress(major), 0, ...FIVE_RIGHT)
    expect(recordNotesAnswer(major, progress, 0, true).newlyPassed).toBeNull()
  })

  it('ignores a degree that is not open', () => {
    const progress = freshProgress(major)
    const result = recordNotesAnswer(major, progress, 4, true)
    expect(result.progress).toBe(progress)
  })

  it('stops once the whole preset is open', () => {
    const progress = openUpTo(major.order.length)
    expect(progress.unlockedCount).toBe(major.order.length)
    const all = major.order.reduce(
      (p, degree) => answer(p, degree, ...FIVE_RIGHT),
      progress,
    )
    expect(all.unlockedCount).toBe(major.order.length)
    expect(all.passed).toHaveLength(major.order.length)
  })

  it('keeps its pass windows to this preset', () => {
    const progress = answer(freshProgress(major), 0, ...FIVE_RIGHT, false)
    expect(progress.passWindows[0]).toEqual([true, true, true, true, false])
  })
})

describe('passedDegrees', () => {
  it('lists passed degrees in preset order', () => {
    const progress: PresetProgress = {
      ...freshProgress(major),
      unlockedCount: 3,
      passed: [4, 0],
    }
    expect(passedDegrees(major, progress)).toEqual([0, 4])
  })
})

describe('mode gates', () => {
  it('always opens Notes and deals the open degrees', () => {
    const progress = freshProgress(major)
    expect(isModeOpen(major, progress, 'notes')).toBe(true)
    expect(dealableDegrees(major, progress, 'notes')).toEqual([0, 7])
  })

  it('opens Melody at 3 passed and deals only passed degrees', () => {
    const two = openUpTo(3) // 1 and 5 passed, 3 open
    expect(isModeOpen(major, two, 'melody')).toBe(false)
    const three = answer(two, 4, ...FIVE_RIGHT)
    expect(isModeOpen(major, three, 'melody')).toBe(true)
    expect(dealableDegrees(major, three, 'melody')).toEqual([0, 7, 4])
  })

  it('opens Speed once the whole preset has passed, and deals all of it', () => {
    const open = openUpTo(major.order.length)
    expect(isModeOpen(major, open, 'speed')).toBe(false)
    const last = major.order.at(-1) ?? 0
    const all = answer(open, last, ...FIVE_RIGHT)
    expect(isModeOpen(major, all, 'speed')).toBe(true)
    expect(dealableDegrees(major, all, 'speed')).toEqual(major.order)
  })
})

describe('melody outcomes', () => {
  it('grades the last 10 melodies on the §5 bands', () => {
    let progress = freshProgress(major)
    for (let i = 0; i < 12; i++) {
      progress = recordMelodyOutcome(progress, i !== 11)
    }
    expect(progress.melodyOutcomes).toHaveLength(10)
    expect(melodyGrade(progress)).toBe('A')
  })

  it('shows no grade until 5 melodies', () => {
    const progress = recordMelodyOutcome(freshProgress(major), true)
    expect(melodyGrade(progress)).toBeNull()
  })
})

// Stats with the given Notes outcomes or Speed times on each degree.
function withStats(
  per: Partial<Record<Degree, { outcomes?: boolean[]; times?: number[] }>>,
): DegreeStatsMap {
  const map = { ...emptyStatsMap() }
  for (const [degree, { outcomes = [], times = [] }] of Object.entries(per)) {
    map[Number(degree) as Degree] = { outcomes, speedTimesMs: times }
  }
  return map
}

const right = (n: number, of = 10) =>
  Array.from({ length: of }, (_, i) => i < n)

describe('presetGrade', () => {
  it('averages the open degrees and rounds down', () => {
    // 1 at A, 5 at C: B
    const stats = withStats({
      0: { outcomes: right(10) },
      7: { outcomes: right(7) },
    })
    expect(presetGrade(major, freshProgress(major), stats)).toBe('B')
  })

  it('leaves out ungraded and locked degrees', () => {
    const stats = withStats({
      0: { outcomes: right(9) },
      7: { outcomes: right(4, 4) }, // too few answers
      4: { outcomes: right(0) }, // 3, still locked
    })
    expect(presetGrade(major, freshProgress(major), stats)).toBe('A')
  })

  it('is "—" until an open degree is graded', () => {
    expect(presetGrade(major, freshProgress(major), emptyStatsMap())).toBeNull()
  })
})

describe('presetStar', () => {
  const gold = [500, 500, 500, 500, 500]
  const slow = [4000, 4000, 4000, 4000, 4000]

  it('averages the rated degrees and rounds down', () => {
    const stats = withStats({ 0: { times: gold }, 7: { times: slow } })
    expect(presetStar(major, stats)).toBe('bronze')
  })

  it('leaves out degrees with fewer than 5 times', () => {
    const stats = withStats({ 0: { times: gold }, 7: { times: [4000] } })
    expect(presetStar(major, stats)).toBe('gold')
  })

  it('is \'none\' when rated without a star, and "—" before that', () => {
    expect(presetStar(major, withStats({ 0: { times: slow } }))).toBe('none')
    expect(presetStar(major, emptyStatsMap())).toBeNull()
  })
})
