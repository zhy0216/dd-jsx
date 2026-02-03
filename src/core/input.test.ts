import { describe, it, expect } from 'vitest'
import { input } from './input'
import { Delta } from './delta'

describe('Input', () => {
  describe('creation', () => {
    it('creates empty input', () => {
      const i = input<number>()
      const values: number[] = []

      i.subscribe((item, delta) => {
        if (delta === Delta.Insert) values.push(item)
      })

      expect(values).toEqual([])
    })

    it('creates input with initial value', () => {
      const i = input('hello')
      const values: string[] = []

      i.subscribe((item, delta) => {
        if (delta === Delta.Insert) values.push(item)
      })

      expect(values).toEqual(['hello'])
    })
  })

  describe('insert', () => {
    it('emits insert delta', () => {
      const i = input<number>()
      const changes: [number, Delta][] = []

      i.subscribe((item, delta) => {
        changes.push([item, delta])
      })

      i.insert(42)

      expect(changes).toEqual([[42, Delta.Insert]])
    })
  })

  describe('retract', () => {
    it('emits retract delta', () => {
      const i = input<number>()
      const changes: [number, Delta][] = []

      i.subscribe((item, delta) => {
        changes.push([item, delta])
      })

      i.insert(42)
      i.retract(42)

      expect(changes).toEqual([
        [42, Delta.Insert],
        [42, Delta.Retract]
      ])
    })
  })

  describe('set', () => {
    it('retracts old value and inserts new', () => {
      const i = input('old')
      const changes: [string, Delta][] = []

      i.subscribe((item, delta) => {
        changes.push([item, delta])
      })

      i.set('new')

      expect(changes).toEqual([
        ['old', Delta.Insert],   // initial
        ['old', Delta.Retract],  // set retracts old
        ['new', Delta.Insert]    // set inserts new
      ])
    })
  })

  describe('update', () => {
    it('transforms and replaces value', () => {
      const i = input(5)
      const changes: [number, Delta][] = []

      i.subscribe((item, delta) => {
        changes.push([item, delta])
      })

      i.update(x => x * 2)

      expect(changes).toEqual([
        [5, Delta.Insert],   // initial
        [5, Delta.Retract],  // update retracts old
        [10, Delta.Insert]   // update inserts transformed
      ])
    })
  })
})
