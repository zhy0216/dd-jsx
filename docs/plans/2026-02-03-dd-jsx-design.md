# DD-JSX: Differential Dataflow Frontend Framework

A frontend framework where VNodes are data flowing through a differential dataflow system.

## Core Concepts

- **Everything is a Collection**: Reactive containers that propagate changes incrementally
- **VNodes are rows**: Parent-child relationships expressed via foreign keys, tree is a derived view
- **JSX = Collection literals**: JSX compiles to `Collection<VNode>`
- **Structural reactivity**: Components are plain functions; reactivity comes from being inside collection operators

## Core Types

```ts
enum Delta {
  Insert = 1,
  Retract = -1
}

type Change<T> = [T, Delta]
```

## Collection API

```ts
interface Collection<T> {
  // Transform
  map<U>(fn: (item: T) => U): Collection<U>
  filter(fn: (item: T) => boolean): Collection<T>
  flatMap<U>(fn: (item: T) => Collection<U>): Collection<U>

  // Combine
  join<U, K>(other: Collection<U>, keyA: (a: T) => K, keyB: (b: U) => K): Collection<[T, U]>
  leftJoin<U, K>(other: Collection<U>, keyA: (a: T) => K, keyB: (b: U) => K): Collection<[T, U | null]>
  withLatest<U>(other: Collection<U>): Collection<[T, U]>

  // Filter with context
  filterBy<U>(context: Collection<U>, fn: (item: T, ctx: U) => boolean): Collection<T>

  // Aggregate
  reduce<K, V>(keyFn: (item: T) => K, reduceFn: (acc: V, item: T) => V, init: V): Collection<[K, V]>
  distinct(): Collection<T>
  count(): Collection<number>

  // Debug
  inspect(fn: (change: Change<T>) => void): Collection<T>
}

// Construction
function Collection.from<T>(items: T[]): Collection<T>
function Collection.concat<T>(...collections: Collection<T>[]): Collection<T>
```

## Input API

```ts
interface Input<T> extends Collection<T> {
  set(value: T): void           // retract all, insert one
  insert(value: T): void        // insert
  retract(value: T): void       // retract
  update(fn: (current: T) => T): void  // retract old, insert new
}

function input<T>(initial?: T): Input<T>
```

## Batching

```ts
function tx(fn: () => void): void  // batch mutations atomically
```

## VNode Schema

```ts
type VNode = {
  id: string                      // auto-generated or user-provided key
  parentId: string | null         // foreign key to parent (null = root)
  index: number                   // sibling order under parent
  tag: string | ComponentFn       // 'div', 'span', or component function
  props: Props                    // attributes + event handlers
  text?: string                   // for text nodes
}

type Props = Record<string, any> & {
  key?: string                    // user-provided stable identity
}

type ComponentFn = (props: Props) => Collection<VNode>
```

## JSX Compilation

JSX always compiles to `Collection<VNode>`. Plain values are auto-wrapped in `Collection.from()`.

```tsx
// Static element
<div class="foo">hello</div>
// Compiles to:
Collection.from([
  { id: "auto_1", parentId: null, index: 0, tag: "div", props: { class: "foo" } },
  { id: "auto_2", parentId: "auto_1", index: 0, tag: "#text", text: "hello" }
])

// Collection children - reparented under parent
<ul>{items}</ul>
// Compiles to:
Collection.concat(
  Collection.from([{ id: "auto_3", parentId: null, index: 0, tag: "ul", props: {} }]),
  items.map(item => ({ ...item, parentId: "auto_3" }))
)

// Component usage
<Title label="hello" />
// Compiles to:
Title({ label: Collection.from(["hello"]) })
```

## Components

Components are functions taking plain props, returning `Collection<VNode>`. Reactivity is structural - being inside `.map()`, `.filter()`, etc. makes it reactive.

```tsx
// Component with plain props
const TodoItem = ({ todo }: { todo: Todo }) => (
  <li key={todo.id} class={todo.done ? "done" : ""}>
    {todo.text}
  </li>
)

// Reactive usage - inside .map()
todos.map(todo => <TodoItem todo={todo} />)
```

## Rendering

```ts
function render(app: Collection<VNode>, container: HTMLElement): Disposable

interface Disposable {
  dispose(): void
}
```

Rendering:
1. Subscribe to app collection's deltas
2. Batch deltas per animation frame via `requestAnimationFrame`
3. Tree assembly at render time (join parentId → id)
4. Direct DOM mutation: Insert creates element, Retract removes element
5. Same-id retract+insert pairs patch in place

## Dataflow Internals

Collections form a DAG. Each operator creates a node that:
- Subscribes to upstream changes
- Maintains state (multiset: data → count)
- Emits deltas downstream

Propagation is push-based and eager. `tx()` defers propagation until transaction ends.

## Complete Example

```tsx
import { input, Collection, render, tx } from 'dd-jsx'

type Todo = { id: string, text: string, done: boolean }

// Inputs
const todos = input<Todo>()
const filter = input<"all" | "active" | "done">("all")

// Derived
const visibleTodos = todos.filterBy(filter, (todo, f) =>
  f === "all" || (f === "active" ? !todo.done : todo.done)
)

// Components
const TodoItem = ({ todo }: { todo: Todo }) => (
  <li key={todo.id} class={todo.done ? "done" : ""}>
    <input
      type="checkbox"
      checked={todo.done}
      onChange={() => tx(() => {
        todos.retract(todo)
        todos.insert({ ...todo, done: !todo.done })
      })}
    />
    {todo.text}
  </li>
)

const App = () => (
  <>
    <h1>Todos</h1>
    <ul>
      {visibleTodos.map(todo => <TodoItem todo={todo} />)}
    </ul>
    <footer>
      <button onClick={() => filter.set("all")}>All</button>
      <button onClick={() => filter.set("active")}>Active</button>
      <button onClick={() => filter.set("done")}>Done</button>
    </footer>
  </>
)

render(<App />, document.getElementById("root"))
```

## Implementation Phases

1. **Core Collection runtime** - Delta, Change, Collection, Input, operators
2. **JSX transform** - Babel/TypeScript plugin to compile JSX to Collection<VNode>
3. **Renderer** - DOM mounting, delta processing, batching via rAF
4. **Developer tooling** - Inspect, debugging, devtools integration
