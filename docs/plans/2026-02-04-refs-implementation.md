# Refs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add React-style ref callbacks that receive DOM elements on mount and `null` on unmount.

**Architecture:** Refs are callback props (`ref={(el) => ...}`) handled specially by the renderer. On VNode insert, the renderer calls `ref(element)`. On retract, it calls `ref(null)`. TypeScript types provide per-element type safety.

**Tech Stack:** TypeScript, Vitest, Bun

---

## Task 1: Add Ref Tests to Renderer

**Files:**
- Modify: `src/render/render.test.ts`

**Step 1: Add test for ref called on insert**

Add this test after the existing tests:

```typescript
it('calls ref callback with element on insert', () => {
  const container = new MockElement('div')
  const doc = createMockDocument()

  let refElement: any = null
  const vnode = createVNode({
    tag: 'div',
    props: { ref: (el: any) => { refElement = el } }
  })

  const vnodes = Collection.from([vnode])
  render(vnodes, container as any, doc as any)

  expect(refElement).not.toBeNull()
  expect(refElement.tagName).toBe('DIV')
})
```

**Step 2: Run test to verify it fails**

Run: `cd /home/orangepi/dd-jsx/.worktrees/refs && bun test src/render/render.test.ts`

Expected: PASS (ref is currently set as attribute, but callback not called - test may pass incorrectly or fail)

**Step 3: Add test for ref called with null on retract**

```typescript
it('calls ref callback with null on retract', () => {
  const container = new MockElement('div')
  const doc = createMockDocument()

  let refElement: any = 'not-called'
  const vnode = createVNode({
    tag: 'div',
    props: { ref: (el: any) => { refElement = el } }
  })

  const vnodes = Collection.from<VNode>([])
  render(vnodes, container as any, doc as any)

  // Insert
  ;(vnodes as any).emit(vnode, Delta.Insert)
  expect(refElement).not.toBeNull()
  expect(refElement.tagName).toBe('DIV')

  // Retract
  ;(vnodes as any).emit(vnode, Delta.Retract)
  expect(refElement).toBeNull()
})
```

**Step 4: Run tests to verify they fail**

Run: `cd /home/orangepi/dd-jsx/.worktrees/refs && bun test src/render/render.test.ts`

Expected: FAIL - ref callback not called with null on retract

**Step 5: Add test that ref is not set as attribute**

```typescript
it('does not set ref as DOM attribute', () => {
  const container = new MockElement('div')
  const doc = createMockDocument()

  const vnode = createVNode({
    tag: 'div',
    props: { ref: () => {}, class: 'test' }
  })

  const vnodes = Collection.from([vnode])
  render(vnodes, container as any, doc as any)

  expect(container.children[0].attributes.get('class')).toBe('test')
  expect(container.children[0].attributes.has('ref')).toBe(false)
})
```

**Step 6: Run all ref tests**

Run: `cd /home/orangepi/dd-jsx/.worktrees/refs && bun test src/render/render.test.ts`

Expected: Some tests FAIL

**Step 7: Commit test file**

```bash
cd /home/orangepi/dd-jsx/.worktrees/refs && git add src/render/render.test.ts && git commit -m "test: add ref callback tests"
```

---

## Task 2: Implement Ref Handling in Renderer

**Files:**
- Modify: `src/render/render.ts:61-81` (createElement)
- Modify: `src/render/render.ts:45-50` (handleInsert)
- Modify: `src/render/render.ts:52-59` (handleRetract)

**Step 1: Filter ref from attributes in createElement**

In `createElement()`, add ref filtering at line 70 (after the `key` check):

```typescript
function createElement(vnode: VNode, state: RendererState): Node {
  if (vnode.tag === '#text') {
    return state.document.createTextNode(vnode.text ?? '')
  }

  const el = state.document.createElement(vnode.tag as string)

  // Set attributes
  for (const [key, value] of Object.entries(vnode.props)) {
    if (key === 'key') continue
    if (key === 'ref') continue  // Don't set ref as attribute
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
```

**Step 2: Run test for ref not set as attribute**

Run: `cd /home/orangepi/dd-jsx/.worktrees/refs && bun test src/render/render.test.ts -t "does not set ref"`

Expected: PASS

**Step 3: Call ref in handleInsert**

Modify `handleInsert()` to call ref after element is attached:

```typescript
function handleInsert(vnode: VNode, state: RendererState): void {
  const el = createElement(vnode, state)
  state.elements.set(vnode.id, el)
  state.vnodes.set(vnode.id, vnode)
  attachToParent(el, vnode, state)

  // Call ref callback with element
  const ref = vnode.props.ref
  if (typeof ref === 'function') {
    ref(el)
  }
}
```

**Step 4: Run test for ref called on insert**

Run: `cd /home/orangepi/dd-jsx/.worktrees/refs && bun test src/render/render.test.ts -t "calls ref callback with element"`

Expected: PASS

**Step 5: Call ref in handleRetract**

Modify `handleRetract()` to call ref with null before removal:

```typescript
function handleRetract(vnode: VNode, state: RendererState): void {
  const el = state.elements.get(vnode.id)
  if (!el) return

  // Call ref callback with null
  const ref = vnode.props.ref
  if (typeof ref === 'function') {
    ref(null)
  }

  (el as ChildNode).remove()
  state.elements.delete(vnode.id)
  state.vnodes.delete(vnode.id)
}
```

**Step 6: Run all tests**

Run: `cd /home/orangepi/dd-jsx/.worktrees/refs && bun test`

Expected: All 37 tests PASS (34 original + 3 new)

**Step 7: Commit implementation**

```bash
cd /home/orangepi/dd-jsx/.worktrees/refs && git add src/render/render.ts && git commit -m "feat: implement ref callbacks in renderer"
```

---

## Task 3: Create JSX Types File

**Files:**
- Create: `src/jsx/types.ts`

**Step 1: Create types file with RefCallback and BaseHTMLAttributes**

```typescript
// Ref callback type
export type RefCallback<T extends Element> = (element: T | null) => void

// Base attributes shared by all HTML elements
export interface BaseHTMLAttributes<T extends Element> {
  ref?: RefCallback<T>
  key?: string
  class?: string
  id?: string
  style?: string
  title?: string
  tabIndex?: number
  hidden?: boolean
  // Event handlers
  onClick?: (e: MouseEvent) => void
  onDblClick?: (e: MouseEvent) => void
  onMouseDown?: (e: MouseEvent) => void
  onMouseUp?: (e: MouseEvent) => void
  onMouseEnter?: (e: MouseEvent) => void
  onMouseLeave?: (e: MouseEvent) => void
  onMouseMove?: (e: MouseEvent) => void
  onInput?: (e: Event) => void
  onKeydown?: (e: KeyboardEvent) => void
  onKeyup?: (e: KeyboardEvent) => void
  onKeypress?: (e: KeyboardEvent) => void
  onFocus?: (e: FocusEvent) => void
  onBlur?: (e: FocusEvent) => void
  onChange?: (e: Event) => void
  onSubmit?: (e: Event) => void
  onScroll?: (e: Event) => void
  // Data and ARIA attributes
  [key: `data-${string}`]: string | undefined
  [key: `aria-${string}`]: string | undefined
}

// Form element attributes
export interface InputHTMLAttributes extends BaseHTMLAttributes<HTMLInputElement> {
  type?: string
  value?: string
  placeholder?: string
  disabled?: boolean
  checked?: boolean
  name?: string
  readonly?: boolean
  required?: boolean
  maxLength?: number
  minLength?: number
  min?: string | number
  max?: string | number
  step?: string | number
  pattern?: string
  autoComplete?: string
  autoFocus?: boolean
}

export interface ButtonHTMLAttributes extends BaseHTMLAttributes<HTMLButtonElement> {
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  name?: string
  value?: string
}

export interface TextareaHTMLAttributes extends BaseHTMLAttributes<HTMLTextAreaElement> {
  value?: string
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  rows?: number
  cols?: number
  maxLength?: number
  minLength?: number
  name?: string
}

export interface SelectHTMLAttributes extends BaseHTMLAttributes<HTMLSelectElement> {
  value?: string
  disabled?: boolean
  multiple?: boolean
  required?: boolean
  name?: string
}

export interface OptionHTMLAttributes extends BaseHTMLAttributes<HTMLOptionElement> {
  value?: string
  disabled?: boolean
  selected?: boolean
}

export interface AnchorHTMLAttributes extends BaseHTMLAttributes<HTMLAnchorElement> {
  href?: string
  target?: '_blank' | '_self' | '_parent' | '_top'
  rel?: string
  download?: string | boolean
}

export interface ImageHTMLAttributes extends BaseHTMLAttributes<HTMLImageElement> {
  src?: string
  alt?: string
  width?: number | string
  height?: number | string
  loading?: 'eager' | 'lazy'
}

export interface FormHTMLAttributes extends BaseHTMLAttributes<HTMLFormElement> {
  action?: string
  method?: 'get' | 'post'
  encType?: string
  target?: string
  noValidate?: boolean
}

export interface LabelHTMLAttributes extends BaseHTMLAttributes<HTMLLabelElement> {
  htmlFor?: string
}

// JSX namespace declaration
declare global {
  namespace JSX {
    interface IntrinsicElements {
      // Container elements
      div: BaseHTMLAttributes<HTMLDivElement>
      span: BaseHTMLAttributes<HTMLSpanElement>
      p: BaseHTMLAttributes<HTMLParagraphElement>
      pre: BaseHTMLAttributes<HTMLPreElement>
      code: BaseHTMLAttributes<HTMLElement>

      // Form elements
      input: InputHTMLAttributes
      button: ButtonHTMLAttributes
      form: FormHTMLAttributes
      label: LabelHTMLAttributes
      textarea: TextareaHTMLAttributes
      select: SelectHTMLAttributes
      option: OptionHTMLAttributes

      // Links and media
      a: AnchorHTMLAttributes
      img: ImageHTMLAttributes

      // Structure
      header: BaseHTMLAttributes<HTMLElement>
      footer: BaseHTMLAttributes<HTMLElement>
      main: BaseHTMLAttributes<HTMLElement>
      section: BaseHTMLAttributes<HTMLElement>
      article: BaseHTMLAttributes<HTMLElement>
      nav: BaseHTMLAttributes<HTMLElement>
      aside: BaseHTMLAttributes<HTMLElement>

      // Headings
      h1: BaseHTMLAttributes<HTMLHeadingElement>
      h2: BaseHTMLAttributes<HTMLHeadingElement>
      h3: BaseHTMLAttributes<HTMLHeadingElement>
      h4: BaseHTMLAttributes<HTMLHeadingElement>
      h5: BaseHTMLAttributes<HTMLHeadingElement>
      h6: BaseHTMLAttributes<HTMLHeadingElement>

      // Lists
      ul: BaseHTMLAttributes<HTMLUListElement>
      ol: BaseHTMLAttributes<HTMLOListElement>
      li: BaseHTMLAttributes<HTMLLIElement>

      // Table
      table: BaseHTMLAttributes<HTMLTableElement>
      thead: BaseHTMLAttributes<HTMLTableSectionElement>
      tbody: BaseHTMLAttributes<HTMLTableSectionElement>
      tfoot: BaseHTMLAttributes<HTMLTableSectionElement>
      tr: BaseHTMLAttributes<HTMLTableRowElement>
      th: BaseHTMLAttributes<HTMLTableCellElement>
      td: BaseHTMLAttributes<HTMLTableCellElement>

      // Other
      br: BaseHTMLAttributes<HTMLBRElement>
      hr: BaseHTMLAttributes<HTMLHRElement>
      strong: BaseHTMLAttributes<HTMLElement>
      em: BaseHTMLAttributes<HTMLElement>
      small: BaseHTMLAttributes<HTMLElement>

      // SVG (basic support)
      svg: BaseHTMLAttributes<SVGSVGElement> & { viewBox?: string; xmlns?: string }
      path: BaseHTMLAttributes<SVGPathElement> & { d?: string; fill?: string; stroke?: string }
    }
  }
}

// Helper function to create ref objects
export function createRef<T extends Element>(): { current: T | null } {
  return { current: null }
}
```

**Step 2: Verify file created correctly**

Run: `cd /home/orangepi/dd-jsx/.worktrees/refs && bun run build`

Expected: Build succeeds

**Step 3: Commit types file**

```bash
cd /home/orangepi/dd-jsx/.worktrees/refs && git add src/jsx/types.ts && git commit -m "feat: add JSX types with per-element ref typing"
```

---

## Task 4: Export Types from JSX Runtime

**Files:**
- Modify: `src/jsx/jsx-runtime.ts`

**Step 1: Add types import and re-export**

Add at the top of the file:

```typescript
import './types'
export { createRef } from './types'
export type { RefCallback, BaseHTMLAttributes, InputHTMLAttributes } from './types'
```

The full file should be:

```typescript
import { Collection } from '../core/collection'
import { VNode, Props, createVNode } from '../vnode/types'
import './types'
export { createRef } from './types'
export type { RefCallback, BaseHTMLAttributes, InputHTMLAttributes } from './types'

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
  return processChild(children, parentId, 0)
}

function processChild(child: JSXChild | undefined, parentId: string | null, index: number): Collection<VNode> {
  if (child === undefined || child === null) {
    return Collection.from<VNode>([])
  }

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
      parentId: vnode.parentId === null ? parentId : vnode.parentId,
      index: vnode.parentId === null ? index : vnode.index
    }))
  }

  if (Array.isArray(child)) {
    const collections = child.map((item, i) => processChild(item, parentId, i))
    return Collection.concat(...collections)
  }

  return Collection.from<VNode>([])
}

// For JSX automatic runtime
export { jsx as jsxs, jsx as jsxDEV }
```

**Step 2: Run build to verify types work**

Run: `cd /home/orangepi/dd-jsx/.worktrees/refs && bun run build`

Expected: Build succeeds

**Step 3: Run all tests**

Run: `cd /home/orangepi/dd-jsx/.worktrees/refs && bun test`

Expected: All tests PASS

**Step 4: Commit**

```bash
cd /home/orangepi/dd-jsx/.worktrees/refs && git add src/jsx/jsx-runtime.ts && git commit -m "feat: export JSX types and createRef helper"
```

---

## Task 5: Export createRef from Main Index

**Files:**
- Modify: `src/index.ts`

**Step 1: Add createRef export**

Add to exports:

```typescript
export { createRef } from './jsx/jsx-runtime'
```

The full file should be:

```typescript
export { Delta, Change } from './core/delta'
export { Collection } from './core/collection'
export { Input, input } from './core/input'
export { tx, isBatching } from './core/tx'
export { VNode, Props, ComponentFn, createVNode } from './vnode/types'
export { render } from './render/render'
export { createRef } from './jsx/jsx-runtime'
```

**Step 2: Run build**

Run: `cd /home/orangepi/dd-jsx/.worktrees/refs && bun run build`

Expected: Build succeeds

**Step 3: Run all tests**

Run: `cd /home/orangepi/dd-jsx/.worktrees/refs && bun test`

Expected: All tests PASS

**Step 4: Commit**

```bash
cd /home/orangepi/dd-jsx/.worktrees/refs && git add src/index.ts && git commit -m "feat: export createRef from main index"
```

---

## Task 6: Update Todo Example to Use Refs

**Files:**
- Modify: `examples/todo/src/main.tsx`

**Step 1: Replace getElementById with ref**

Change the input handling:

```typescript
import { render, input, Input, Collection } from 'dd-jsx'

type Todo = {
  id: string
  text: string
  completed: boolean
}

// State
const todos = input<Todo[]>([])
const newTodoText = input('')

// Ref for input element
let inputEl: HTMLInputElement | null = null

// Generate unique ID
let nextId = 1
function generateId(): string {
  return `todo-${nextId++}`
}

// Actions
function addTodo() {
  const currentTodos = getCurrentValue(todos)
  const text = getCurrentValue(newTodoText).trim()

  if (!text) return

  todos.set([
    ...currentTodos,
    { id: generateId(), text, completed: false }
  ])
  newTodoText.set('')

  // Clear the input using ref
  if (inputEl) inputEl.value = ''
}

function toggleTodo(id: string) {
  const currentTodos = getCurrentValue(todos)
  todos.set(
    currentTodos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    )
  )
}

function deleteTodo(id: string) {
  const currentTodos = getCurrentValue(todos)
  todos.set(currentTodos.filter(todo => todo.id !== id))
}

function clearCompleted() {
  const currentTodos = getCurrentValue(todos)
  todos.set(currentTodos.filter(todo => !todo.completed))
}

// Helper to get current value from Input
function getCurrentValue<T>(inp: Input<T>): T {
  let value: T = undefined as T
  const unsub = inp.subscribe((item) => {
    value = item
  })
  unsub()
  return value
}

// Components
function TodoItem({ todo }: { todo: Todo }) {
  return (
    <div class={`todo-item ${todo.completed ? 'completed' : ''}`} key={todo.id}>
      <div
        class={`todo-checkbox ${todo.completed ? 'checked' : ''}`}
        onClick={() => toggleTodo(todo.id)}
      >
        {todo.completed ? '✓' : ''}
      </div>
      <span class="todo-text">{todo.text}</span>
      <button class="delete-btn" onClick={() => deleteTodo(todo.id)}>
        Delete
      </button>
    </div>
  )
}

function TodoList({ todos: todoList }: { todos: Todo[] }) {
  if (todoList.length === 0) {
    return (
      <div class="empty-state">
        No todos yet. Add one above!
      </div>
    )
  }

  return (
    <div class="todo-list">
      {todoList.map(todo => (
        <TodoItem todo={todo} key={todo.id} />
      ))}
    </div>
  )
}

function TodoFooter({ todos: todoList }: { todos: Todo[] }) {
  const remaining = todoList.filter(t => !t.completed).length
  const hasCompleted = todoList.some(t => t.completed)

  if (todoList.length === 0) {
    return <></>
  }

  return (
    <div class="todo-footer">
      <span>{remaining} item{remaining !== 1 ? 's' : ''} left</span>
      {hasCompleted ? (
        <button class="clear-btn" onClick={clearCompleted}>
          Clear completed
        </button>
      ) : (
        <span></span>
      )}
    </div>
  )
}

function App() {
  return todos.flatMap(todoList => (
    <div class="todo-container">
      <div class="todo-header">
        <h1>DD-JSX Todo</h1>
        <div class="todo-input-container">
          <input
            ref={(el) => inputEl = el}
            class="todo-input"
            type="text"
            placeholder="What needs to be done?"
            onInput={(e: Event) => newTodoText.set((e.target as HTMLInputElement).value)}
            onKeydown={(e: KeyboardEvent) => {
              if (e.key === 'Enter') addTodo()
            }}
          />
          <button class="add-btn" onClick={addTodo}>
            Add
          </button>
        </div>
      </div>
      <TodoList todos={todoList} />
      <TodoFooter todos={todoList} />
    </div>
  ))
}

// Mount
const container = document.getElementById('app')!
render(App(), container)
```

**Step 2: Run build**

Run: `cd /home/orangepi/dd-jsx/.worktrees/refs && bun run build`

Expected: Build succeeds

**Step 3: Run all tests**

Run: `cd /home/orangepi/dd-jsx/.worktrees/refs && bun test`

Expected: All tests PASS

**Step 4: Commit**

```bash
cd /home/orangepi/dd-jsx/.worktrees/refs && git add examples/todo/src/main.tsx && git commit -m "refactor: use ref instead of getElementById in todo example"
```

---

## Summary

| Task | Description | Tests Added |
|------|-------------|-------------|
| 1 | Add ref tests | 3 |
| 2 | Implement ref handling in renderer | - |
| 3 | Create JSX types file | - |
| 4 | Export types from JSX runtime | - |
| 5 | Export createRef from main index | - |
| 6 | Update todo example | - |

**Final verification:**

```bash
cd /home/orangepi/dd-jsx/.worktrees/refs && bun test && bun run build
```

Expected: 37 tests pass, build succeeds.
