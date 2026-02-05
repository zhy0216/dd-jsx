import { describe, it, expect, vi } from 'vitest'
import { Collection } from './collection'
import { Delta } from './delta'
import { Input } from './input'

describe('Collection', () => {
  describe('from', () => {
    it('creates a collection from array', () => {
      const col = Collection.from([1, 2, 3])
      expect(col).toBeInstanceOf(Collection)
    })

    it('emits inserts for initial values when subscribed', () => {
      const col = Collection.from(['a', 'b'])
      const changes: [string, Delta][] = []

      col.subscribe((item, delta) => {
        changes.push([item, delta])
      })

      expect(changes).toEqual([
        ['a', Delta.Insert],
        ['b', Delta.Insert]
      ])
    })
  })

  describe('map', () => {
    it('transforms values', () => {
      const col = Collection.from([1, 2, 3])
      const mapped = col.map(x => x * 2)
      const values: number[] = []

      mapped.subscribe((item, delta) => {
        if (delta === Delta.Insert) values.push(item)
      })

      expect(values).toEqual([2, 4, 6])
    })

    it('propagates changes from upstream', () => {
      const col = Collection.from<number>([])
      const mapped = col.map(x => x * 2)
      const changes: [number, Delta][] = []

      mapped.subscribe((item, delta) => {
        changes.push([item, delta])
      })

      // Simulate upstream insert (we'll implement Input later)
      ;(col as any).emit(5, Delta.Insert)

      expect(changes).toEqual([[10, Delta.Insert]])
    })
  })

  describe('filter', () => {
    it('filters values based on predicate', () => {
      const col = Collection.from([1, 2, 3, 4, 5])
      const evens = col.filter(x => x % 2 === 0)
      const values: number[] = []

      evens.subscribe((item, delta) => {
        if (delta === Delta.Insert) values.push(item)
      })

      expect(values).toEqual([2, 4])
    })

    it('propagates matching changes from upstream', () => {
      const col = Collection.from<number>([])
      const evens = col.filter(x => x % 2 === 0)
      const changes: [number, Delta][] = []

      evens.subscribe((item, delta) => {
        changes.push([item, delta])
      })

      ;(col as any).emit(3, Delta.Insert)  // odd - filtered out
      ;(col as any).emit(4, Delta.Insert)  // even - passed through

      expect(changes).toEqual([[4, Delta.Insert]])
    })
  })

  describe('concat', () => {
    it('merges multiple collections', () => {
      const a = Collection.from([1, 2])
      const b = Collection.from([3, 4])
      const combined = Collection.concat(a, b)
      const values: number[] = []

      combined.subscribe((item, delta) => {
        if (delta === Delta.Insert) values.push(item)
      })

      expect(values).toEqual([1, 2, 3, 4])
    })

    it('propagates changes from all sources', () => {
      const a = Collection.from<number>([])
      const b = Collection.from<number>([])
      const combined = Collection.concat(a, b)
      const changes: [number, Delta][] = []

      combined.subscribe((item, delta) => {
        changes.push([item, delta])
      })

      ;(a as any).emit(1, Delta.Insert)
      ;(b as any).emit(2, Delta.Insert)

      expect(changes).toEqual([
        [1, Delta.Insert],
        [2, Delta.Insert]
      ])
    })
  })

  describe('flatMap', () => {
    it('flattens nested collections', () => {
      const col = Collection.from([1, 2])
      const flatMapped = col.flatMap(x => Collection.from([x, x * 10]))
      const values: number[] = []

      flatMapped.subscribe((item, delta) => {
        if (delta === Delta.Insert) values.push(item)
      })

      expect(values).toEqual([1, 10, 2, 20])
    })
  })

  describe('withLatest', () => {
    it('combines each item with latest from other collection', () => {
      const items = Collection.from([1, 2, 3])
      const multiplier = Collection.from([10])
      const combined = items.withLatest(multiplier)
      const values: [number, number][] = []

      combined.subscribe((item, delta) => {
        if (delta === Delta.Insert) values.push(item)
      })

      expect(values).toEqual([[1, 10], [2, 10], [3, 10]])
    })

    it('re-emits all items when the latest side changes', () => {
      const items = new Input<number>()
      const context = new Input<string>()
      const combined = items.withLatest(context)

      const current: Map<number, [number, string]> = new Map()

      combined.subscribe(([item, ctx]: [number, string], delta: Delta) => {
        if (delta === Delta.Insert) {
          current.set(item, [item, ctx])
        } else {
          current.delete(item)
        }
      })

      // Set initial context
      context.set('v1')

      // Add items
      items.insert(1)
      items.insert(2)
      expect(current.get(1)).toEqual([1, 'v1'])
      expect(current.get(2)).toEqual([2, 'v1'])

      // Change context - all items should re-emit with new context
      context.set('v2')
      expect(current.get(1)).toEqual([1, 'v2'])
      expect(current.get(2)).toEqual([2, 'v2'])
    })
  })

  describe('combineLatest', () => {
    it('emits when either side changes', () => {
      const a = new Input<number>()
      const b = new Input<string>()
      const combined = a.combineLatest(b)
      const changes: [Delta, [number, string]][] = []

      combined.subscribe((item, delta) => {
        changes.push([delta, item])
      })

      // No emission until both have values
      a.set(1)
      expect(changes).toEqual([])

      // First emission when both have values
      b.set('x')
      expect(changes).toEqual([[Delta.Insert, [1, 'x']]])

      // Emits when A changes
      a.set(2)
      expect(changes).toEqual([
        [Delta.Insert, [1, 'x']],
        [Delta.Retract, [1, 'x']],
        [Delta.Insert, [2, 'x']]
      ])

      // Emits when B changes
      b.set('y')
      expect(changes).toEqual([
        [Delta.Insert, [1, 'x']],
        [Delta.Retract, [1, 'x']],
        [Delta.Insert, [2, 'x']],
        [Delta.Retract, [2, 'x']],
        [Delta.Insert, [2, 'y']]
      ])
    })

    it('can be used to trigger re-render on multiple sources', () => {
      const state = new Input<{ selected: boolean }>()
      const data = new Input<{ value: string }>()
      const trigger = state.combineLatest(data)

      let renderCount = 0
      let lastRender: [{ selected: boolean }, { value: string }] | null = null

      trigger.subscribe((item, delta) => {
        if (delta === Delta.Insert) {
          renderCount++
          lastRender = item
        }
      })

      state.set({ selected: false })
      data.set({ value: 'hello' })
      expect(renderCount).toBe(1)
      expect(lastRender).toEqual([{ selected: false }, { value: 'hello' }])

      // State change triggers re-render
      state.set({ selected: true })
      expect(renderCount).toBe(2)
      expect(lastRender).toEqual([{ selected: true }, { value: 'hello' }])

      // Data change triggers re-render
      data.set({ value: 'world' })
      expect(renderCount).toBe(3)
      expect(lastRender).toEqual([{ selected: true }, { value: 'world' }])
    })
  })

  describe('startWith', () => {
    it('emits initial value immediately', () => {
      const upstream = new Input<string>()
      const withDefault = upstream.startWith('default')
      const changes: [Delta, string][] = []

      withDefault.subscribe((item, delta) => {
        changes.push([delta, item])
      })

      expect(changes).toEqual([[Delta.Insert, 'default']])
    })

    it('retracts initial when upstream emits', () => {
      const upstream = new Input<string>()
      const withDefault = upstream.startWith('default')
      const changes: [Delta, string][] = []

      withDefault.subscribe((item, delta) => {
        changes.push([delta, item])
      })

      upstream.set('real')
      expect(changes).toEqual([
        [Delta.Insert, 'default'],
        [Delta.Retract, 'default'],
        [Delta.Insert, 'real']
      ])
    })

    it('works with combineLatest for sparse collections', () => {
      const state = new Input<{ selected: boolean }>()
      const sparseData = new Input<{ value: string }>()

      // sparseData might never emit, but startWith ensures combineLatest works
      const trigger = state.combineLatest(sparseData.startWith({ value: '' }))

      let lastValue: [{ selected: boolean }, { value: string }] | null = null
      trigger.subscribe((item, delta) => {
        if (delta === Delta.Insert) lastValue = item
      })

      // Works immediately because startWith provides initial value
      state.set({ selected: true })
      expect(lastValue).toEqual([{ selected: true }, { value: '' }])

      // When real data arrives, it replaces the default
      sparseData.set({ value: 'hello' })
      expect(lastValue).toEqual([{ selected: true }, { value: 'hello' }])
    })
  })

  describe('filterBy', () => {
    it('filters using context from another collection', () => {
      const items = Collection.from([1, 2, 3, 4, 5])
      const threshold = Collection.from([3])
      const filtered = items.filterBy(threshold, (item, t) => item > t)
      const values: number[] = []

      filtered.subscribe((item, delta) => {
        if (delta === Delta.Insert) values.push(item)
      })

      expect(values).toEqual([4, 5])
    })
  })

  describe('join', () => {
    it('joins two collections by key', () => {
      const users = Collection.from([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ])
      const posts = Collection.from([
        { userId: 1, title: 'Hello' },
        { userId: 1, title: 'World' },
        { userId: 2, title: 'Hi' }
      ])

      const joined = users.join(
        posts,
        u => u.id,
        p => p.userId
      )

      const values: [any, any][] = []
      joined.subscribe((item, delta) => {
        if (delta === Delta.Insert) values.push(item)
      })

      expect(values).toEqual([
        [{ id: 1, name: 'Alice' }, { userId: 1, title: 'Hello' }],
        [{ id: 1, name: 'Alice' }, { userId: 1, title: 'World' }],
        [{ id: 2, name: 'Bob' }, { userId: 2, title: 'Hi' }]
      ])
    })
  })

  describe('reduce', () => {
    it('does not emit until first upstream delta (pure DD semantics)', () => {
      const col = Collection.from<number>([])
      const sum = col.reduce(0, (state, item, delta) => {
        return state + (delta === Delta.Insert ? item : -item)
      })
      const changes: [number, Delta][] = []

      sum.subscribe((item, delta) => {
        changes.push([item, delta])
      })

      // No emissions yet - collection is empty
      expect(changes).toEqual([])
    })

    it('emits on first upstream delta', () => {
      const col = Collection.from<number>([])
      const sum = col.reduce(0, (state, item, delta) => {
        return state + (delta === Delta.Insert ? item : -item)
      })
      const changes: [number, Delta][] = []

      sum.subscribe((item, delta) => {
        changes.push([item, delta])
      })

      ;(col as any).emit(5, Delta.Insert)

      expect(changes).toEqual([[5, Delta.Insert]])
    })

    it('emits retract then insert when state changes', () => {
      const col = Collection.from<number>([])
      const sum = col.reduce(0, (state, item, delta) => {
        return state + (delta === Delta.Insert ? item : -item)
      })
      const changes: [number, Delta][] = []

      sum.subscribe((item, delta) => {
        changes.push([item, delta])
      })

      ;(col as any).emit(5, Delta.Insert)
      ;(col as any).emit(3, Delta.Insert)

      expect(changes).toEqual([
        [5, Delta.Insert],
        [5, Delta.Retract],
        [8, Delta.Insert]
      ])
    })

    it('handles retractions correctly', () => {
      const col = Collection.from<number>([])
      const sum = col.reduce(0, (state, item, delta) => {
        return state + (delta === Delta.Insert ? item : -item)
      })
      const changes: [number, Delta][] = []

      sum.subscribe((item, delta) => {
        changes.push([item, delta])
      })

      ;(col as any).emit(5, Delta.Insert)
      ;(col as any).emit(3, Delta.Insert)
      ;(col as any).emit(5, Delta.Retract)

      expect(changes).toEqual([
        [5, Delta.Insert],
        [5, Delta.Retract],
        [8, Delta.Insert],
        [8, Delta.Retract],
        [3, Delta.Insert]
      ])
    })

    it('works with object state (count example)', () => {
      type Item = { completed: boolean }
      const col = Collection.from<Item>([])
      const counts = col.reduce(
        { total: 0, completedCount: 0 },
        (state, item, delta) => {
          const mult = delta === Delta.Insert ? 1 : -1
          return {
            total: state.total + mult,
            completedCount: state.completedCount + (item.completed ? mult : 0)
          }
        }
      )

      const states: { total: number; completedCount: number }[] = []
      counts.subscribe((item, delta) => {
        if (delta === Delta.Insert) states.push(item)
      })

      ;(col as any).emit({ completed: false }, Delta.Insert)
      ;(col as any).emit({ completed: true }, Delta.Insert)
      ;(col as any).emit({ completed: false }, Delta.Insert)

      expect(states).toEqual([
        { total: 1, completedCount: 0 },
        { total: 2, completedCount: 1 },
        { total: 3, completedCount: 1 }
      ])
    })

    it('late subscriber gets current state', () => {
      const col = Collection.from<number>([])
      const sum = col.reduce(0, (state, item, delta) => {
        return state + (delta === Delta.Insert ? item : -item)
      })

      // First subscriber
      sum.subscribe(() => {})

      // Emit some values
      ;(col as any).emit(5, Delta.Insert)
      ;(col as any).emit(3, Delta.Insert)

      // Late subscriber should get current state
      const lateChanges: [number, Delta][] = []
      sum.subscribe((item, delta) => {
        lateChanges.push([item, delta])
      })

      expect(lateChanges).toEqual([[8, Delta.Insert]])
    })

    it('works with initial data in collection', () => {
      const col = Collection.from([1, 2, 3])
      const sum = col.reduce(0, (state, item, delta) => {
        return state + (delta === Delta.Insert ? item : -item)
      })

      const states: number[] = []
      sum.subscribe((item, delta) => {
        if (delta === Delta.Insert) states.push(item)
      })

      // Should have processed all initial values
      expect(states).toEqual([1, 3, 6])
    })
  })

  describe('distinct', () => {
    it('only emits when value changes (using JSON comparison)', () => {
      const input = new Input<{ x: number }>()
      const distinct = input.distinct()
      const changes: [{ x: number }, Delta][] = []

      distinct.subscribe((item, delta) => {
        changes.push([item, delta])
      })

      input.set({ x: 1 })
      input.set({ x: 1 })  // same value, should not emit
      input.set({ x: 2 })  // different value, should emit
      input.set({ x: 2 })  // same value, should not emit

      expect(changes).toEqual([
        [{ x: 1 }, Delta.Insert],
        [{ x: 1 }, Delta.Retract],
        [{ x: 2 }, Delta.Insert]
      ])
    })

    it('only emits when derived key changes', () => {
      const input = new Input<{ col: number; row: number; other: string }>()
      // Only care about col and row, not other
      const distinct = input.distinct(item => `${item.col}:${item.row}`)
      const changes: [{ col: number; row: number; other: string }, Delta][] = []

      distinct.subscribe((item, delta) => {
        changes.push([item, delta])
      })

      input.set({ col: 0, row: 0, other: 'a' })
      input.set({ col: 0, row: 0, other: 'b' })  // same key, should not emit
      input.set({ col: 1, row: 0, other: 'c' })  // different key, should emit

      expect(changes).toEqual([
        [{ col: 0, row: 0, other: 'a' }, Delta.Insert],
        [{ col: 0, row: 0, other: 'a' }, Delta.Retract],
        [{ col: 1, row: 0, other: 'c' }, Delta.Insert]
      ])
    })

    it('prevents redundant re-renders in withLatest chains', () => {
      const items = new Input<number>()
      const selection = new Input<number | null>()

      // Simulates per-cell selection state: only re-emit when THIS cell's selection changes
      const cellIsSelected = selection
        .map(sel => sel === 1)  // Is cell 1 selected?
        .distinct()

      const changes: [boolean, Delta][] = []
      cellIsSelected.subscribe((item, delta) => {
        changes.push([item, delta])
      })

      selection.set(null)   // false
      selection.set(2)      // still false for cell 1
      selection.set(3)      // still false for cell 1
      selection.set(1)      // now true for cell 1
      selection.set(1)      // still true

      // Should only have 2 state changes: null->false->true
      expect(changes).toEqual([
        [false, Delta.Insert],
        [false, Delta.Retract],
        [true, Delta.Insert]
      ])
    })
  })
})
