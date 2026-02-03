# DD-JSX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a frontend framework using Differential Dataflow semantics where VNodes are relational data flowing through collections.

**Architecture:** Push-based incremental dataflow. Collections emit `(data, delta)` changes. JSX compiles to `Collection<VNode>`. Renderer subscribes to deltas and patches DOM via requestAnimationFrame batching.

**Tech Stack:** TypeScript, Vitest (testing), Babel (JSX transform), Vite (bundling/dev)

---

## Phase 1: Project Setup

### Task 1.1: Initialize TypeScript Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`

**Step 1: Create package.json**

```json
{
  "name": "dd-jsx",
  "version": "0.0.1",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "vitest": "^2.0.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

**Step 3: Install dependencies**

Run: `npm install`
Expected: node_modules created, package-lock.json created

**Step 4: Commit**

```bash
git add package.json tsconfig.json package-lock.json
git commit -m "chore: initialize TypeScript project with Vitest"
```

---

## Phase 2: Core Types

### Task 2.1: Delta Enum

**Files:**
- Create: `src/core/delta.ts`
- Create: `src/core/delta.test.ts`

**Step 1: Write the test**

```typescript
// src/core/delta.test.ts
import { describe, it, expect } from 'vitest'
import { Delta } from './delta'

describe('Delta', () => {
  it('has Insert with value 1', () => {
    expect(Delta.Insert).toBe(1)
  })

  it('has Retract with value -1', () => {
    expect(Delta.Retract).toBe(-1)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - Cannot find module './delta'

**Step 3: Write implementation**

```typescript
// src/core/delta.ts
export enum Delta {
  Insert = 1,
  Retract = -1
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/delta.ts src/core/delta.test.ts
git commit -m "feat: add Delta enum"
```

---

### Task 2.2: Change Type

**Files:**
- Modify: `src/core/delta.ts`
- Modify: `src/core/delta.test.ts`

**Step 1: Add test for Change type**

```typescript
// Add to src/core/delta.test.ts
import { Delta, Change } from './delta'

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
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - Change is not exported

**Step 3: Add Change type**

```typescript
// src/core/delta.ts
export enum Delta {
  Insert = 1,
  Retract = -1
}

export type Change<T> = [T, Delta]
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/delta.ts src/core/delta.test.ts
git commit -m "feat: add Change type"
```

---

## Phase 3: Collection Base

### Task 3.1: Collection Interface and Base Class

**Files:**
- Create: `src/core/collection.ts`
- Create: `src/core/collection.test.ts`

**Step 1: Write test for basic collection creation**

```typescript
// src/core/collection.test.ts
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
})
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - Cannot find module './collection'

**Step 3: Write minimal implementation**

```typescript
// src/core/collection.ts
import { Delta, Change } from './delta'

type Subscriber<T> = (item: T, delta: Delta) => void

export class Collection<T> {
  protected subscribers: Set<Subscriber<T>> = new Set()
  protected data: T[] = []

  static from<T>(items: T[]): Collection<T> {
    const col = new Collection<T>()
    col.data = [...items]
    return col
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
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/collection.ts src/core/collection.test.ts
git commit -m "feat: add Collection base class with from() and subscribe()"
```

---

### Task 3.2: Collection.map Operator

**Files:**
- Modify: `src/core/collection.ts`
- Modify: `src/core/collection.test.ts`

**Step 1: Write test for map**

```typescript
// Add to src/core/collection.test.ts
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
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - col.map is not a function

**Step 3: Implement map**

```typescript
// Add to Collection class in src/core/collection.ts
map<U>(fn: (item: T) => U): Collection<U> {
  const result = new MappedCollection<T, U>(this, fn)
  return result
}

// Add new class after Collection class
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
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/collection.ts src/core/collection.test.ts
git commit -m "feat: add Collection.map operator"
```

---

### Task 3.3: Collection.filter Operator

**Files:**
- Modify: `src/core/collection.ts`
- Modify: `src/core/collection.test.ts`

**Step 1: Write test for filter**

```typescript
// Add to src/core/collection.test.ts
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
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - col.filter is not a function

**Step 3: Implement filter**

```typescript
// Add to Collection class in src/core/collection.ts
filter(predicate: (item: T) => boolean): Collection<T> {
  return new FilteredCollection(this, predicate)
}

// Add new class
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
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/collection.ts src/core/collection.test.ts
git commit -m "feat: add Collection.filter operator"
```

---

### Task 3.4: Collection.concat

**Files:**
- Modify: `src/core/collection.ts`
- Modify: `src/core/collection.test.ts`

**Step 1: Write test for concat**

```typescript
// Add to src/core/collection.test.ts
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
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - Collection.concat is not a function

**Step 3: Implement concat**

```typescript
// Add static method to Collection class
static concat<T>(...collections: Collection<T>[]): Collection<T> {
  return new ConcatCollection(collections)
}

// Add new class
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
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/collection.ts src/core/collection.test.ts
git commit -m "feat: add Collection.concat operator"
```

---

## Phase 4: Input

### Task 4.1: Input Class

**Files:**
- Create: `src/core/input.ts`
- Create: `src/core/input.test.ts`

**Step 1: Write tests for Input**

```typescript
// src/core/input.test.ts
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
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - Cannot find module './input'

**Step 3: Implement Input**

```typescript
// src/core/input.ts
import { Collection } from './collection'
import { Delta } from './delta'

type Subscriber<T> = (item: T, delta: Delta) => void

export class Input<T> extends Collection<T> {
  private values: Set<T> = new Set()

  constructor(initial?: T) {
    super()
    if (initial !== undefined) {
      this.values.add(initial)
      ;(this as any).data = [initial]
    }
  }

  insert(value: T): void {
    this.values.add(value)
    this.emit(value, Delta.Insert)
  }

  retract(value: T): void {
    this.values.delete(value)
    this.emit(value, Delta.Retract)
  }

  set(value: T): void {
    // Retract all current values
    for (const v of this.values) {
      this.retract(v)
    }
    // Insert new value
    this.insert(value)
  }

  update(fn: (current: T) => T): void {
    const current = [...this.values][0]
    if (current !== undefined) {
      const newValue = fn(current)
      this.retract(current)
      this.insert(newValue)
    }
  }

  protected emit(item: T, delta: Delta): void {
    for (const fn of this.subscribers) {
      fn(item, delta)
    }
  }
}

export function input<T>(initial?: T): Input<T> {
  return new Input(initial)
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/input.ts src/core/input.test.ts
git commit -m "feat: add Input class with insert/retract/set/update"
```

---

## Phase 5: Transaction Batching

### Task 5.1: tx() Function

**Files:**
- Create: `src/core/tx.ts`
- Create: `src/core/tx.test.ts`

**Step 1: Write tests for tx**

```typescript
// src/core/tx.test.ts
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
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - Cannot find module './tx'

**Step 3: Implement tx**

```typescript
// src/core/tx.ts
let batching = false
const pendingEmits: Array<() => void> = []

export function isBatching(): boolean {
  return batching
}

export function tx(fn: () => void): void {
  batching = true
  try {
    fn()
  } finally {
    batching = false
    // Flush pending emits
    const toFlush = [...pendingEmits]
    pendingEmits.length = 0
    for (const emit of toFlush) {
      emit()
    }
  }
}

export function scheduleEmit(emit: () => void): void {
  if (batching) {
    pendingEmits.push(emit)
  } else {
    emit()
  }
}
```

**Step 4: Update Input to use scheduleEmit**

```typescript
// Modify src/core/input.ts - import scheduleEmit
import { scheduleEmit } from './tx'

// Modify emit method in Input class
protected emit(item: T, delta: Delta): void {
  scheduleEmit(() => {
    for (const fn of this.subscribers) {
      fn(item, delta)
    }
  })
}
```

**Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 6: Commit**

```bash
git add src/core/tx.ts src/core/tx.test.ts src/core/input.ts
git commit -m "feat: add tx() for batching mutations"
```

---

## Phase 6: Additional Operators

### Task 6.1: flatMap Operator

**Files:**
- Modify: `src/core/collection.ts`
- Modify: `src/core/collection.test.ts`

**Step 1: Write test for flatMap**

```typescript
// Add to src/core/collection.test.ts
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
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - col.flatMap is not a function

**Step 3: Implement flatMap**

```typescript
// Add to Collection class
flatMap<U>(fn: (item: T) => Collection<U>): Collection<U> {
  return new FlatMapCollection(this, fn)
}

// Add new class
class FlatMapCollection<T, U> extends Collection<U> {
  private innerUnsubs: Map<T, () => void> = new Map()

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
        const innerUnsub = inner.subscribe((innerItem, innerDelta) => {
          this.emit(innerItem, innerDelta)
        })
        this.innerUnsubs.set(item, innerUnsub)
      } else {
        // Retract: unsubscribe from inner and emit retracts
        const innerUnsub = this.innerUnsubs.get(item)
        if (innerUnsub) {
          innerUnsub()
          this.innerUnsubs.delete(item)
        }
        // Note: proper retraction would require tracking inner values
        // This is simplified for now
      }
    })

    return () => {
      this.subscribers.delete(fn)
      unsub()
      this.innerUnsubs.forEach(u => u())
      this.innerUnsubs.clear()
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/collection.ts src/core/collection.test.ts
git commit -m "feat: add Collection.flatMap operator"
```

---

### Task 6.2: withLatest Operator

**Files:**
- Modify: `src/core/collection.ts`
- Modify: `src/core/collection.test.ts`

**Step 1: Write test for withLatest**

```typescript
// Add to src/core/collection.test.ts
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
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - items.withLatest is not a function

**Step 3: Implement withLatest**

```typescript
// Add to Collection class
withLatest<U>(other: Collection<U>): Collection<[T, U]> {
  return new WithLatestCollection(this, other)
}

// Add new class
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
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/collection.ts src/core/collection.test.ts
git commit -m "feat: add Collection.withLatest operator"
```

---

### Task 6.3: filterBy Operator

**Files:**
- Modify: `src/core/collection.ts`
- Modify: `src/core/collection.test.ts`

**Step 1: Write test for filterBy**

```typescript
// Add to src/core/collection.test.ts
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
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - items.filterBy is not a function

**Step 3: Implement filterBy**

```typescript
// Add to Collection class
filterBy<U>(context: Collection<U>, predicate: (item: T, ctx: U) => boolean): Collection<T> {
  return new FilterByCollection(this, context, predicate)
}

// Add new class
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
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/collection.ts src/core/collection.test.ts
git commit -m "feat: add Collection.filterBy operator"
```

---

### Task 6.4: join Operator

**Files:**
- Modify: `src/core/collection.ts`
- Modify: `src/core/collection.test.ts`

**Step 1: Write test for join**

```typescript
// Add to src/core/collection.test.ts
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
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - users.join is not a function

**Step 3: Implement join**

```typescript
// Add to Collection class
join<U, K>(
  other: Collection<U>,
  keyA: (a: T) => K,
  keyB: (b: U) => K
): Collection<[T, U]> {
  return new JoinCollection(this, other, keyA, keyB)
}

// Add new class
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
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/collection.ts src/core/collection.test.ts
git commit -m "feat: add Collection.join operator"
```

---

## Phase 7: Index Exports

### Task 7.1: Create Index File

**Files:**
- Create: `src/index.ts`

**Step 1: Create index.ts**

```typescript
// src/index.ts
export { Delta, Change } from './core/delta'
export { Collection } from './core/collection'
export { Input, input } from './core/input'
export { tx, isBatching } from './core/tx'
```

**Step 2: Run build to verify exports**

Run: `npm run build`
Expected: dist/ created with .js and .d.ts files

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: add index exports"
```

---

## Phase 8: VNode Types

### Task 8.1: VNode Type Definition

**Files:**
- Create: `src/vnode/types.ts`
- Create: `src/vnode/types.test.ts`

**Step 1: Write test**

```typescript
// src/vnode/types.test.ts
import { describe, it, expect } from 'vitest'
import { VNode, Props, createVNode } from './types'

describe('VNode', () => {
  it('creates a vnode with required fields', () => {
    const vnode = createVNode({
      tag: 'div',
      props: { class: 'foo' }
    })

    expect(vnode.id).toBeDefined()
    expect(vnode.parentId).toBeNull()
    expect(vnode.index).toBe(0)
    expect(vnode.tag).toBe('div')
    expect(vnode.props).toEqual({ class: 'foo' })
  })

  it('uses provided key as id', () => {
    const vnode = createVNode({
      tag: 'div',
      props: { key: 'my-key' }
    })

    expect(vnode.id).toBe('my-key')
  })

  it('creates text node', () => {
    const vnode = createVNode({
      tag: '#text',
      props: {},
      text: 'Hello'
    })

    expect(vnode.tag).toBe('#text')
    expect(vnode.text).toBe('Hello')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - Cannot find module './types'

**Step 3: Implement types**

```typescript
// src/vnode/types.ts
export type Props = Record<string, any> & {
  key?: string
}

export type ComponentFn = (props: Props) => any  // Will be Collection<VNode>

export type VNode = {
  id: string
  parentId: string | null
  index: number
  tag: string | ComponentFn
  props: Props
  text?: string
}

let autoId = 0

export function createVNode(options: {
  tag: string | ComponentFn
  props: Props
  text?: string
  parentId?: string | null
  index?: number
}): VNode {
  const id = options.props.key ?? `__auto_${++autoId}`

  return {
    id,
    parentId: options.parentId ?? null,
    index: options.index ?? 0,
    tag: options.tag,
    props: options.props,
    text: options.text
  }
}

export function resetAutoId(): void {
  autoId = 0
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/vnode/types.ts src/vnode/types.test.ts
git commit -m "feat: add VNode types and createVNode helper"
```

---

## Phase 9: JSX Runtime

### Task 9.1: JSX Factory

**Files:**
- Create: `src/jsx/jsx-runtime.ts`
- Create: `src/jsx/jsx-runtime.test.ts`

**Step 1: Write test**

```typescript
// src/jsx/jsx-runtime.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { jsx, Fragment } from './jsx-runtime'
import { Collection } from '../core/collection'
import { Delta } from '../core/delta'
import { resetAutoId } from '../vnode/types'

describe('jsx', () => {
  beforeEach(() => {
    resetAutoId()
  })

  it('creates collection from element', () => {
    const result = jsx('div', { class: 'foo' })

    expect(result).toBeInstanceOf(Collection)

    const vnodes: any[] = []
    result.subscribe((vnode, delta) => {
      if (delta === Delta.Insert) vnodes.push(vnode)
    })

    expect(vnodes.length).toBe(1)
    expect(vnodes[0].tag).toBe('div')
    expect(vnodes[0].props.class).toBe('foo')
  })

  it('handles text children', () => {
    const result = jsx('span', { children: 'Hello' })

    const vnodes: any[] = []
    result.subscribe((vnode, delta) => {
      if (delta === Delta.Insert) vnodes.push(vnode)
    })

    expect(vnodes.length).toBe(2)
    expect(vnodes[0].tag).toBe('span')
    expect(vnodes[1].tag).toBe('#text')
    expect(vnodes[1].text).toBe('Hello')
    expect(vnodes[1].parentId).toBe(vnodes[0].id)
  })

  it('handles component functions', () => {
    const MyComponent = (props: { name: string }) =>
      jsx('div', { children: props.name })

    const result = jsx(MyComponent, { name: 'Test' })

    const vnodes: any[] = []
    result.subscribe((vnode, delta) => {
      if (delta === Delta.Insert) vnodes.push(vnode)
    })

    expect(vnodes.length).toBe(2)
    expect(vnodes[0].tag).toBe('div')
  })
})

describe('Fragment', () => {
  beforeEach(() => {
    resetAutoId()
  })

  it('concatenates children', () => {
    const child1 = jsx('div', {})
    const child2 = jsx('span', {})
    const result = jsx(Fragment, { children: [child1, child2] })

    const vnodes: any[] = []
    result.subscribe((vnode, delta) => {
      if (delta === Delta.Insert) vnodes.push(vnode)
    })

    expect(vnodes.length).toBe(2)
    expect(vnodes[0].tag).toBe('div')
    expect(vnodes[1].tag).toBe('span')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - Cannot find module './jsx-runtime'

**Step 3: Implement jsx-runtime**

```typescript
// src/jsx/jsx-runtime.ts
import { Collection } from '../core/collection'
import { VNode, Props, createVNode } from '../vnode/types'

export const Fragment = Symbol('Fragment')

type JSXChild = string | number | Collection<VNode> | JSXChild[]

export function jsx(
  tag: string | typeof Fragment | ((props: Props) => Collection<VNode>),
  props: Props & { children?: JSXChild }
): Collection<VNode> {
  const { children, ...restProps } = props

  // Fragment: concatenate children
  if (tag === Fragment) {
    return processChildren(children, null)
  }

  // Component function
  if (typeof tag === 'function') {
    return tag({ ...restProps, children })
  }

  // Regular element
  const vnode = createVNode({ tag, props: restProps })
  const selfCollection = Collection.from([vnode])

  if (children === undefined || children === null) {
    return selfCollection
  }

  const childrenCollection = processChildren(children, vnode.id)
  return Collection.concat(selfCollection, childrenCollection)
}

function processChildren(children: JSXChild | undefined, parentId: string | null): Collection<VNode> {
  if (children === undefined || children === null) {
    return Collection.from([])
  }

  if (typeof children === 'string' || typeof children === 'number') {
    const textNode = createVNode({
      tag: '#text',
      props: {},
      text: String(children),
      parentId,
      index: 0
    })
    return Collection.from([textNode])
  }

  if (children instanceof Collection) {
    // Reparent collection items
    return children.map(vnode => ({
      ...vnode,
      parentId
    }))
  }

  if (Array.isArray(children)) {
    const collections = children.map((child, index) => {
      const col = processChild(child, parentId, index)
      return col
    })
    return Collection.concat(...collections)
  }

  return Collection.from([])
}

function processChild(child: JSXChild, parentId: string | null, index: number): Collection<VNode> {
  if (typeof child === 'string' || typeof child === 'number') {
    const textNode = createVNode({
      tag: '#text',
      props: {},
      text: String(child),
      parentId,
      index
    })
    return Collection.from([textNode])
  }

  if (child instanceof Collection) {
    return child.map(vnode => ({
      ...vnode,
      parentId,
      index
    }))
  }

  if (Array.isArray(child)) {
    return processChildren(child, parentId)
  }

  return Collection.from([])
}

// For JSX automatic runtime
export { jsx as jsxs, jsx as jsxDEV }
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/jsx/jsx-runtime.ts src/jsx/jsx-runtime.test.ts
git commit -m "feat: add JSX runtime with jsx() and Fragment"
```

---

## Phase 10: Renderer

### Task 10.1: Basic Renderer

**Files:**
- Create: `src/render/render.ts`
- Create: `src/render/render.test.ts`

**Step 1: Write test**

```typescript
// src/render/render.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { render } from './render'
import { Collection } from '../core/collection'
import { VNode, createVNode, resetAutoId } from '../vnode/types'
import { Delta } from '../core/delta'

// Mock DOM for testing
class MockElement {
  tagName: string
  children: MockElement[] = []
  attributes: Map<string, string> = new Map()
  textContent: string = ''
  parentElement: MockElement | null = null

  constructor(tag: string) {
    this.tagName = tag.toUpperCase()
  }

  appendChild(child: MockElement) {
    child.parentElement = this
    this.children.push(child)
  }

  remove() {
    if (this.parentElement) {
      const idx = this.parentElement.children.indexOf(this)
      if (idx >= 0) this.parentElement.children.splice(idx, 1)
    }
  }

  setAttribute(key: string, value: string) {
    this.attributes.set(key, value)
  }
}

function createMockDocument() {
  return {
    createElement: (tag: string) => new MockElement(tag),
    createTextNode: (text: string) => {
      const el = new MockElement('#text')
      el.textContent = text
      return el
    }
  }
}

describe('render', () => {
  beforeEach(() => {
    resetAutoId()
  })

  it('renders vnodes to container', () => {
    const container = new MockElement('div')
    const doc = createMockDocument()

    const vnodes = Collection.from([
      createVNode({ tag: 'div', props: { class: 'foo' } })
    ])

    render(vnodes, container as any, doc as any)

    expect(container.children.length).toBe(1)
    expect(container.children[0].tagName).toBe('DIV')
    expect(container.children[0].attributes.get('class')).toBe('foo')
  })

  it('renders nested vnodes', () => {
    const container = new MockElement('div')
    const doc = createMockDocument()

    const parent = createVNode({ tag: 'ul', props: {} })
    const child = createVNode({ tag: 'li', props: {}, parentId: parent.id, index: 0 })

    const vnodes = Collection.from([parent, child])

    render(vnodes, container as any, doc as any)

    expect(container.children.length).toBe(1)
    expect(container.children[0].tagName).toBe('UL')
    expect(container.children[0].children.length).toBe(1)
    expect(container.children[0].children[0].tagName).toBe('LI')
  })

  it('removes elements on retract', () => {
    const container = new MockElement('div')
    const doc = createMockDocument()

    const vnode = createVNode({ tag: 'div', props: {} })
    const vnodes = Collection.from<VNode>([])

    render(vnodes, container as any, doc as any)

    // Manually emit insert then retract
    ;(vnodes as any).emit(vnode, Delta.Insert)
    expect(container.children.length).toBe(1)

    ;(vnodes as any).emit(vnode, Delta.Retract)
    expect(container.children.length).toBe(0)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - Cannot find module './render'

**Step 3: Implement render**

```typescript
// src/render/render.ts
import { Collection } from '../core/collection'
import { VNode } from '../vnode/types'
import { Delta } from '../core/delta'

type Disposable = {
  dispose: () => void
}

type RendererState = {
  elements: Map<string, HTMLElement | Text>
  vnodes: Map<string, VNode>
  container: HTMLElement
  document: Document
}

export function render(
  app: Collection<VNode>,
  container: HTMLElement,
  doc: Document = document
): Disposable {
  const state: RendererState = {
    elements: new Map(),
    vnodes: new Map(),
    container,
    document: doc
  }

  const unsub = app.subscribe((vnode, delta) => {
    if (delta === Delta.Insert) {
      handleInsert(vnode, state)
    } else {
      handleRetract(vnode, state)
    }
  })

  return {
    dispose: () => {
      unsub()
      state.elements.clear()
      state.vnodes.clear()
    }
  }
}

function handleInsert(vnode: VNode, state: RendererState): void {
  const el = createElement(vnode, state)
  state.elements.set(vnode.id, el)
  state.vnodes.set(vnode.id, vnode)
  attachToParent(el, vnode, state)
}

function handleRetract(vnode: VNode, state: RendererState): void {
  const el = state.elements.get(vnode.id)
  if (el) {
    (el as HTMLElement).remove?.() || el.parentElement?.removeChild(el)
    state.elements.delete(vnode.id)
    state.vnodes.delete(vnode.id)
  }
}

function createElement(vnode: VNode, state: RendererState): HTMLElement | Text {
  if (vnode.tag === '#text') {
    return state.document.createTextNode(vnode.text ?? '')
  }

  const el = state.document.createElement(vnode.tag as string)

  // Set attributes
  for (const [key, value] of Object.entries(vnode.props)) {
    if (key === 'key') continue
    if (key.startsWith('on')) {
      // Event handler
      const event = key.slice(2).toLowerCase()
      el.addEventListener(event, value)
    } else {
      el.setAttribute(key, String(value))
    }
  }

  return el
}

function attachToParent(el: HTMLElement | Text, vnode: VNode, state: RendererState): void {
  const parent = vnode.parentId
    ? state.elements.get(vnode.parentId)
    : state.container

  if (parent) {
    // Simple append for now - sibling ordering can be improved later
    (parent as HTMLElement).appendChild(el as any)
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/render/render.ts src/render/render.test.ts
git commit -m "feat: add basic renderer"
```

---

## Phase 11: Final Exports and TypeScript Config

### Task 11.1: Update Exports

**Files:**
- Modify: `src/index.ts`
- Create: `src/jsx/index.ts`

**Step 1: Update exports**

```typescript
// src/index.ts
export { Delta, Change } from './core/delta'
export { Collection } from './core/collection'
export { Input, input } from './core/input'
export { tx, isBatching } from './core/tx'
export { VNode, Props, ComponentFn, createVNode } from './vnode/types'
export { render } from './render/render'
```

```typescript
// src/jsx/index.ts
export { jsx, jsxs, jsxDEV, Fragment } from './jsx-runtime'
```

**Step 2: Update tsconfig for JSX**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "jsx": "react-jsx",
    "jsxImportSource": "."
  },
  "include": ["src/**/*"]
}
```

**Step 3: Run build and tests**

Run: `npm run build && npm test`
Expected: All pass

**Step 4: Commit**

```bash
git add src/index.ts src/jsx/index.ts tsconfig.json
git commit -m "feat: update exports and enable JSX support"
```

---

## Summary

**Core Runtime (Phase 1-6):**
- Delta enum, Change type
- Collection with map, filter, flatMap, concat, join, withLatest, filterBy
- Input with insert, retract, set, update
- tx() for batching

**VNode & JSX (Phase 7-9):**
- VNode type with id, parentId, index, tag, props, text
- jsx() factory
- Fragment support

**Renderer (Phase 10):**
- render() function
- Delta-based DOM patching

**Total: 11 tasks, ~35 commits**
