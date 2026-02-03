import { describe, it, expect } from 'vitest'
import { tx, isBatching } from './tx'
import { input } from './input'
import { Delta } from './delta'

describe('tx', () => {
  it('batches multiple mutations', () => {
    const i = input<number>()
    const changes: [number, Delta][] = []

    i.subscribe((item, delta) => {
      changes.push([item, delta])
    })

    tx(() => {
      i.insert(1)
      i.insert(2)
      i.insert(3)
    })

    // All changes should be emitted after tx completes
    expect(changes).toEqual([
      [1, Delta.Insert],
      [2, Delta.Insert],
      [3, Delta.Insert]
    ])
  })

  it('exposes batching state', () => {
    expect(isBatching()).toBe(false)

    tx(() => {
      expect(isBatching()).toBe(true)
    })

    expect(isBatching()).toBe(false)
  })
})
