import { describe, it, expect, vi } from 'vitest'
import { Collection } from './collection'
import { Delta } from './delta'

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
})
