# DD-JSX

A frontend framework built on **[differential dataflow](https://github.com/electric-sql/d2ts)**.

## What is Differential Dataflow?

Differential dataflow is a computational model where:

1. **Data changes are deltas, not snapshots** — Instead of replacing entire datasets, you emit `Insert` and `Retract` operations
2. **Operators are incremental** — When input changes, operators do work proportional to the *change*, not the total data size
3. **Changes compose** — A pipeline of operators propagates deltas end-to-end without materializing intermediate results

This model powers systems like [electric-sql](https://electric-sql.com/) for incremental SQL views. DD-JSX applies it to UI rendering.

## How DD-JSX Uses It

```typescript
// Changes are deltas
type Change<T> = [T, Insert | Retract]

// Collections propagate deltas through operators
type Collection<T> = { map, filter, flatMap, join, reduce, ... }

// VNodes are flat relational data, not nested trees
type VNode = { id, parentId, index, tag, props, text? }

// JSX compiles to collections of VNodes
type JSX.Element = Collection<VNode>
```

The DOM renderer subscribes to a stream of VNode deltas and applies them directly. No virtual DOM diffing—changes flow through as deltas and become DOM mutations.

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         Application                             │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  Input<T>                                                       │
│  ─────────                                                      │
│  Mutable state containers                                       │
│                                                                 │
│  insert(value)  ──────────────────────────▶  [value, Insert]    │
│  retract(value) ──────────────────────────▶  [value, Retract]   │
│  update(fn)     ──────────────────────────▶  [old, -1], [new, 1]│
└─────────────────────────────────────────────────────────────────┘
                               │
                          emit deltas
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  Collection Operators                                           │
│  ────────────────────                                           │
│                                                                 │
│  .map(fn)       Transform each value                            │
│  .filter(fn)    Pass matching deltas                            │
│  .flatMap(fn)   Map to collection, flatten (reactive UI)        │
│  .join(...)     Relational join on keys                         │
│  .reduce(...)   Incremental aggregation                         │
│                                                                 │
│  Each operator processes deltas incrementally                   │
│  Work ∝ size of change, not size of data                        │
└─────────────────────────────────────────────────────────────────┘
                               │
                        transform deltas
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  Collection<VNode>                                              │
│  ─────────────────                                              │
│                                                                 │
│  VNodes are flat relational data:                               │
│  { id, parentId, index, tag, props, text? }                     │
│                                                                 │
│  Tree structure assembled at render time via parentId           │
└─────────────────────────────────────────────────────────────────┘
                               │
                           subscribe
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  Renderer                                                       │
│  ────────                                                       │
│                                                                 │
│  [VNode, Insert]  ──────────────────────▶  createElement()      │
│  [VNode, Retract] ──────────────────────▶  removeChild()        │
│  [props changed]  ──────────────────────▶  setAttribute()       │
│                                                                 │
│  Direct DOM mutations from deltas — no diffing                  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                            DOM                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Why This Matters for UI

**Incremental by default.** When one todo item changes, only that item's delta flows through the pipeline—not the entire list.

**Relational operators.** Joins, filters, and aggregations work on deltas. You can express complex data relationships that update efficiently:

```tsx
// When user OR their posts change, only affected rows recompute
const feed = users.join(posts, u => u.id, p => p.authorId)
  .flatMap(([user, post]) => <PostCard user={user} post={post} />)
```

**No reactivity magic.** No signals, proxies, or decorators. Reactivity emerges from differential dataflow operators—if you're inside a `flatMap`, you react to changes:

```tsx
const items = todos.flatMap(todo => <TodoItem todo={todo} />)
```

**Global context without prop drilling.** The `Context` function creates reactive global state that auto-injects into operators:

```tsx
const user = new Input({ name: 'Alice', theme: 'dark' })
const ctx = Context({ user })

// ctx.user is reactive - when it changes, items re-emit
const items = todos.flatMap(todo => (
  <div class={ctx.user.theme}>{todo.text}</div>
))
```

**O(1) aggregation.** The `reduce` operator maintains aggregates incrementally as items insert/retract:

```tsx
const stats = todos.reduce(
  { total: 0, done: 0 },
  (acc, todo, delta) => ({
    total: acc.total + delta,
    done: acc.done + (todo.completed ? delta : 0)
  })
)
```

## The Delta Model

Changes flow as `[value, delta]` tuples where `delta` is `Insert (1)` or `Retract (-1)`.

```typescript
input.insert(todo)   // emits [todo, 1]
input.retract(todo)  // emits [todo, -1]

// Update = retract old + insert new
input.update(x => ({ ...x, done: true }))
```

**Batch with transactions** to group related deltas:

```typescript
tx(() => {
  input.retract(old)
  input.insert(new)
})  // Both deltas propagate together
```

## Quick Start

```tsx
import { input, render, Input, Context } from 'dd-jsx'

const count = input(0)

function App() {
  return count.flatMap(n => (
    <button onClick={() => count.update(x => x + 1)}>
      Clicked {n} times
    </button>
  ))
}

render(<App />, document.getElementById('app')!)
```

## Context

When you need shared state across multiple collections (user session, theme, feature flags), use `Context`:

```tsx
import { Input, Context } from 'dd-jsx'

// Create inputs for your global state
const user = new Input({ id: 1, name: 'Alice', role: 'admin' })
const settings = new Input({ theme: 'dark', language: 'en' })

// Create context - automatically registers for injection
const ctx = Context({ user, settings })

// Access ctx.user and ctx.settings inside any operator
// When inputs change, dependent operators re-emit
const header = items.flatMap(item => (
  <div class={ctx.settings.theme}>
    Welcome, {ctx.user.name}!
    <span>{item.title}</span>
  </div>
))

// Cleanup when done
ctx.dispose()
```

**How it works:**

1. `Context({ user, settings })` combines inputs into a single reactive collection
2. Operators like `flatMap` automatically detect registered contexts
3. When any context input changes, the operator re-processes all items with the new values
4. `ctx.user` provides synchronous access to the current value inside callbacks

This replaces the need for explicit `withLatest` chains when you have global state.

## Operators

All operators are incremental—they process deltas, not full collections.

| Operator | Purpose |
|----------|---------|
| `map` | Transform each delta |
| `filter` | Pass matching deltas |
| `flatMap` | Map to collection, flatten deltas (the workhorse for reactive UI) |
| `join` | Relational join—emits deltas when either side changes |
| `withLatest` | Pair deltas with latest value from another collection (re-emits when latest changes) |
| `filterBy` | Filter using a reactive predicate collection |
| `reduce` | Incremental aggregation over all deltas |
| `concat` | Merge delta streams |
| `Context` | Create reactive global state that auto-injects into operators |

## TypeScript Config

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "dd-jsx"
  }
}
```

## Acknowledgments

DD-JSX is inspired by [d2ts](https://github.com/electric-sql/d2ts), a TypeScript implementation of differential dataflow by Electric SQL.

## License

MIT
