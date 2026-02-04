# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

Uses **bun** as package manager.

```bash
bun run build        # Compile TypeScript to dist/
bun test             # Run Vitest tests (34 tests)
bun run test:watch   # Watch mode for development
```

For the todo example:
```bash
cd examples/todo && bun run dev   # Vite dev server
```

## Architecture

DD-JSX is a frontend framework built on **differential dataflow** semantics. The core innovation is treating VNodes as relational data flowing through reactive collections.

### Key Concepts

1. **Everything is a Collection**: `Collection<T>` is the reactive primitive. Changes propagate as deltas (`Insert = 1`, `Retract = -1`).

2. **VNodes are flat relational data**: Not hierarchical trees. Parent-child relationships use `parentId` foreign keys. Tree structure is assembled at render time.

3. **JSX = Collection<VNode>**: All JSX compiles to collections. `<div>hello</div>` becomes a Collection containing VNode rows.

4. **Structural reactivity**: Components are plain functions. Reactivity comes from being inside collection operators (`.map()`, `.filter()`, `.flatMap()`), not from special decorators or syntax.

### Data Flow

```
Input<T> (mutable state)
    ↓ emit deltas
Collection operators (map, filter, flatMap, join, etc.)
    ↓ transform deltas
Collection<VNode>
    ↓ subscribe
Renderer → DOM mutations
```

### Core Types

- `Delta` enum: `Insert = 1`, `Retract = -1`
- `Change<T> = [T, Delta]`: A typed change tuple
- `Collection<T>`: Reactive container with operators (map, filter, flatMap, join, withLatest, filterBy, concat)
- `Input<T>`: Mutable collection with `insert()`, `retract()`, `set()`, `update()`
- `VNode`: `{ id, parentId, index, tag, props, text? }`

### Source Structure

```
src/
├── core/           # Dataflow runtime
│   ├── delta.ts    # Delta enum, Change type
│   ├── collection.ts   # Collection + 7 operator classes
│   ├── input.ts    # Input (mutable state)
│   └── tx.ts       # Transaction batching
├── vnode/          # VNode type definitions
├── jsx/            # JSX runtime (jsx, jsxs, Fragment)
└── render/         # DOM renderer (subscribe to deltas → DOM ops)
```

### JSX Compilation

Static elements become `Collection.from([...vnodes])`. Collection children get reparented with `parentId`. Components are called directly as functions.

### Transaction Batching

Use `tx(() => {...})` to batch multiple mutations. Defers delta propagation until the transaction completes.

```typescript
tx(() => {
  input.retract(old)
  input.insert(new)
})  // Both changes propagate together
```
