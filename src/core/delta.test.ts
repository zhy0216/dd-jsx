import { describe, it, expect } from 'vitest'
import { Delta, Change } from './delta'

describe('Delta', () => {
  it('has Insert with value 1', () => {
    expect(Delta.Insert).toBe(1)
  })

  it('has Retract with value -1', () => {
    expect(Delta.Retract).toBe(-1)
  })
})

describe('Change', () => {
  it('represents an insert change', () => {
    const change: Change<string> = ['hello', Delta.Insert]
    expect(change[0]).toBe('hello')
    expect(change[1]).toBe(Delta.Insert)
  })

  it('represents a retract change', () => {
    const change: Change<number> = [42, Delta.Retract]
    expect(change[0]).toBe(42)
    expect(change[1]).toBe(Delta.Retract)
  })
})
