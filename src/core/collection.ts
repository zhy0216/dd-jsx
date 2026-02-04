import { Delta, Change } from './delta'

type Subscriber<T> = (item: T, delta: Delta) => void

export class Collection<T> {
  protected subscribers: Set<Subscriber<T>> = new Set()
  protected data: T[]

  constructor(initialData: T[] = []) {
    this.data = initialData
  }

  static from<T>(items: T[]): Collection<T> {
    return new Collection<T>([...items])
  }

  static concat<T>(...collections: Collection<T>[]): Collection<T> {
    return new ConcatCollection(collections)
  }

  subscribe(fn: Subscriber<T>): () => void {
    this.subscribers.add(fn)
    // Emit current data as inserts
    for (const item of this.data) {
      fn(item, Delta.Insert)
    }
    return () => this.subscribers.delete(fn)
  }

  protected emit(item: T, delta: Delta): void {
    for (const fn of this.subscribers) {
      fn(item, delta)
    }
  }

  map<U>(fn: (item: T) => U): Collection<U> {
    return new MappedCollection<T, U>(this, fn)
  }

  filter(predicate: (item: T) => boolean): Collection<T> {
    return new FilteredCollection(this, predicate)
  }

  flatMap<U>(fn: (item: T) => Collection<U>): Collection<U> {
    return new FlatMapCollection(this, fn)
  }

  withLatest<U>(other: Collection<U>): Collection<[T, U]> {
    return new WithLatestCollection(this, other)
  }

  filterBy<U>(context: Collection<U>, predicate: (item: T, ctx: U) => boolean): Collection<T> {
    return new FilterByCollection(this, context, predicate)
  }

  join<U, K>(
    other: Collection<U>,
    keyA: (a: T) => K,
    keyB: (b: U) => K
  ): Collection<[T, U]> {
    return new JoinCollection(this, other, keyA, keyB)
  }

  reduce<S>(
    initial: S,
    fn: (state: S, item: T, delta: Delta) => S
  ): Collection<S> {
    return new ReduceCollection(this, initial, fn)
  }
}

class MappedCollection<T, U> extends Collection<U> {
  constructor(
    private upstream: Collection<T>,
    private mapFn: (item: T) => U
  ) {
    super()
  }

  subscribe(fn: Subscriber<U>): () => void {
    this.subscribers.add(fn)

    // Subscribe to upstream and transform
    const unsub = this.upstream.subscribe((item, delta) => {
      const mapped = this.mapFn(item)
      this.emit(mapped, delta)
    })

    return () => {
      this.subscribers.delete(fn)
      unsub()
    }
  }
}

class FilteredCollection<T> extends Collection<T> {
  constructor(
    private upstream: Collection<T>,
    private predicate: (item: T) => boolean
  ) {
    super()
  }

  subscribe(fn: Subscriber<T>): () => void {
    this.subscribers.add(fn)

    const unsub = this.upstream.subscribe((item, delta) => {
      if (this.predicate(item)) {
        this.emit(item, delta)
      }
    })

    return () => {
      this.subscribers.delete(fn)
      unsub()
    }
  }
}

class ConcatCollection<T> extends Collection<T> {
  constructor(private sources: Collection<T>[]) {
    super()
  }

  subscribe(fn: Subscriber<T>): () => void {
    this.subscribers.add(fn)

    const unsubs = this.sources.map(source =>
      source.subscribe((item, delta) => {
        this.emit(item, delta)
      })
    )

    return () => {
      this.subscribers.delete(fn)
      unsubs.forEach(unsub => unsub())
    }
  }
}

class FlatMapCollection<T, U> extends Collection<U> {
  private innerUnsubs: Map<T, () => void> = new Map()
  private innerValues: Map<T, U[]> = new Map()

  constructor(
    private upstream: Collection<T>,
    private flatMapFn: (item: T) => Collection<U>
  ) {
    super()
  }

  subscribe(fn: Subscriber<U>): () => void {
    this.subscribers.add(fn)

    const unsub = this.upstream.subscribe((item, delta) => {
      if (delta === Delta.Insert) {
        const inner = this.flatMapFn(item)
        const trackedValues: U[] = []
        this.innerValues.set(item, trackedValues)
        
        const innerUnsub = inner.subscribe((innerItem, innerDelta) => {
          if (innerDelta === Delta.Insert) {
            trackedValues.push(innerItem)
          } else {
            const idx = trackedValues.indexOf(innerItem)
            if (idx >= 0) trackedValues.splice(idx, 1)
          }
          this.emit(innerItem, innerDelta)
        })
        this.innerUnsubs.set(item, innerUnsub)
      } else {
        // Retract: unsubscribe from inner and emit retracts for tracked values
        const innerUnsub = this.innerUnsubs.get(item)
        if (innerUnsub) {
          innerUnsub()
          this.innerUnsubs.delete(item)
        }
        
        const values = this.innerValues.get(item)
        if (values) {
          for (const v of values) {
            this.emit(v, Delta.Retract)
          }
          this.innerValues.delete(item)
        }
      }
    })

    return () => {
      this.subscribers.delete(fn)
      unsub()
      this.innerUnsubs.forEach(u => u())
      this.innerUnsubs.clear()
      this.innerValues.clear()
    }
  }
}

class WithLatestCollection<T, U> extends Collection<[T, U]> {
  private latestOther: U | undefined

  constructor(
    private upstream: Collection<T>,
    private other: Collection<U>
  ) {
    super()
  }

  subscribe(fn: Subscriber<[T, U]>): () => void {
    this.subscribers.add(fn)

    // Track latest from other
    const otherUnsub = this.other.subscribe((item, delta) => {
      if (delta === Delta.Insert) {
        this.latestOther = item
      }
    })

    // Combine upstream with latest
    const unsub = this.upstream.subscribe((item, delta) => {
      if (this.latestOther !== undefined) {
        this.emit([item, this.latestOther], delta)
      }
    })

    return () => {
      this.subscribers.delete(fn)
      unsub()
      otherUnsub()
    }
  }
}

class FilterByCollection<T, U> extends Collection<T> {
  private latestContext: U | undefined

  constructor(
    private upstream: Collection<T>,
    private context: Collection<U>,
    private predicate: (item: T, ctx: U) => boolean
  ) {
    super()
  }

  subscribe(fn: Subscriber<T>): () => void {
    this.subscribers.add(fn)

    // Track latest context
    const contextUnsub = this.context.subscribe((item, delta) => {
      if (delta === Delta.Insert) {
        this.latestContext = item
      }
    })

    // Filter upstream using context
    const unsub = this.upstream.subscribe((item, delta) => {
      if (this.latestContext !== undefined && this.predicate(item, this.latestContext)) {
        this.emit(item, delta)
      }
    })

    return () => {
      this.subscribers.delete(fn)
      unsub()
      contextUnsub()
    }
  }
}

class JoinCollection<T, U, K> extends Collection<[T, U]> {
  private indexA: Map<K, T[]> = new Map()
  private indexB: Map<K, U[]> = new Map()

  constructor(
    private upstreamA: Collection<T>,
    private upstreamB: Collection<U>,
    private keyA: (a: T) => K,
    private keyB: (b: U) => K
  ) {
    super()
  }

  subscribe(fn: Subscriber<[T, U]>): () => void {
    this.subscribers.add(fn)

    const unsubA = this.upstreamA.subscribe((item, delta) => {
      const key = this.keyA(item)

      if (delta === Delta.Insert) {
        if (!this.indexA.has(key)) this.indexA.set(key, [])
        this.indexA.get(key)!.push(item)

        // Emit joins with matching B items
        for (const b of this.indexB.get(key) ?? []) {
          this.emit([item, b], Delta.Insert)
        }
      } else {
        const arr = this.indexA.get(key)
        if (arr) {
          const idx = arr.indexOf(item)
          if (idx >= 0) arr.splice(idx, 1)
        }

        for (const b of this.indexB.get(key) ?? []) {
          this.emit([item, b], Delta.Retract)
        }
      }
    })

    const unsubB = this.upstreamB.subscribe((item, delta) => {
      const key = this.keyB(item)

      if (delta === Delta.Insert) {
        if (!this.indexB.has(key)) this.indexB.set(key, [])
        this.indexB.get(key)!.push(item)

        for (const a of this.indexA.get(key) ?? []) {
          this.emit([a, item], Delta.Insert)
        }
      } else {
        const arr = this.indexB.get(key)
        if (arr) {
          const idx = arr.indexOf(item)
          if (idx >= 0) arr.splice(idx, 1)
        }

        for (const a of this.indexA.get(key) ?? []) {
          this.emit([a, item], Delta.Retract)
        }
      }
    })

    return () => {
      this.subscribers.delete(fn)
      unsubA()
      unsubB()
    }
  }
}

class ReduceCollection<T, S> extends Collection<S> {
  private state: S
  private hasEmitted = false

  constructor(
    private upstream: Collection<T>,
    private initial: S,
    private reduceFn: (state: S, item: T, delta: Delta) => S
  ) {
    super()
    this.state = initial
  }

  subscribe(fn: Subscriber<S>): () => void {
    this.subscribers.add(fn)

    // Late subscriber gets current state (if any)
    if (this.hasEmitted) {
      fn(this.state, Delta.Insert)
    }

    const unsub = this.upstream.subscribe((item, delta) => {
      const oldState = this.state
      const newState = this.reduceFn(oldState, item, delta)

      if (this.hasEmitted) {
        this.emit(oldState, Delta.Retract)
      }

      this.state = newState
      this.emit(newState, Delta.Insert)
      this.hasEmitted = true
    })

    return () => {
      this.subscribers.delete(fn)
      unsub()
    }
  }
}
