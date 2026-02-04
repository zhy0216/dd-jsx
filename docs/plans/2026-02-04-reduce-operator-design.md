# Design: `reduce` Operator for Collection

## Problem

The todo app uses an imperative pattern to sync footer state with todos:

```typescript
todos.subscribe(() => {
  const all = todos.getAll()  // O(n)
  footerState.set({
    total: all.length,
    remaining: all.filter(t => !t.completed).length,  // O(n)
    hasCompleted: all.some(t => t.completed)  // O(n)
  })
})
```

This is O(n) on every change and doesn't align with DD-JSX's declarative dataflow philosophy.

## Solution

Add a `reduce` operator that computes aggregates incrementally from deltas.

## API

```typescript
class Collection<T> {
  reduce<S>(
    initial: S,
    fn: (state: S, item: T, delta: Delta) => S
  ): Collection<S>
}
```

## Behavior (Pure DD Semantics)

- Maintains a single aggregated state
- On each upstream delta, calls `fn` to compute new state
- **No emission until first upstream delta** (empty collection initially)
- Emits `(oldState, Retract)` then `(newState, Insert)` when state changes
- Late subscribers receive current state if it exists

## Implementation

```typescript
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
```

## Usage in Todo App

```typescript
const footerState = todos.reduce(
  { total: 0, completedCount: 0 },
  (state, todo, delta) => {
    const mult = delta === Delta.Insert ? 1 : -1
    return {
      total: state.total + mult,
      completedCount: state.completedCount + (todo.completed ? mult : 0)
    }
  }
)

const footer = footerState.flatMap(({ total, completedCount }) => {
  if (total === 0) return <></>
  const remaining = total - completedCount
  const hasCompleted = completedCount > 0
  return (
    <div class="todo-footer">
      <span>{remaining} item{remaining !== 1 ? 's' : ''} left</span>
      {hasCompleted ? (
        <button class="clear-btn" onClick={clearCompleted}>
          Clear completed
        </button>
      ) : <span></span>}
    </div>
  )
})
```

## Design Decisions

1. **Global-only** - No keyed reduction (GROUP BY) for now. Can extend later.

2. **Pure DD semantics** - Collection starts empty, only emits after first upstream delta.

3. **Shallow equality** - Reducer must return new object to trigger update.

4. **Decomposable aggregates** - Use counts instead of booleans (e.g., `completedCount` instead of `hasCompleted`) for O(1) incremental updates.

## Files to Change

- `src/core/collection.ts` - Add `ReduceCollection` class and `reduce` method
- `examples/todo/src/app.tsx` - Replace imperative subscription with `reduce`
- `tests/` - Add tests for `reduce` operator

## Future Extensions

- Keyed reduction (`reduceByKey`) for GROUP BY semantics
- Built-in helpers: `count()`, `sum(fn)` as shortcuts
