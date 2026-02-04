# Refs Design for DD-JSX

## Problem

DD-JSX lacks a way to access DOM elements directly. The todo example uses `document.getElementById()` as a workaround to clear the input field after adding a todo. This is fragile and not idiomatic.

## Solution

Add React-style ref callbacks that receive the element on mount and `null` on unmount.

## API

### Callback Ref

```typescript
ref?: (element: Element | null) => void
```

Called with the element when mounted, called with `null` when unmounted.

### Usage

```tsx
let inputEl: HTMLInputElement | null = null

<input
  ref={(el) => inputEl = el}
  placeholder="Type here..."
/>

// Later:
inputEl?.focus()
inputEl.value = ''
```

### Optional Helper

```typescript
function createRef<T extends Element>(): { current: T | null } {
  return { current: null }
}

const inputRef = createRef<HTMLInputElement>()
<input ref={(el) => inputRef.current = el} />
```

## Implementation

### Renderer Changes (`src/render/render.ts`)

1. Filter `ref` from normal prop handling in `createElement()`:

```typescript
if (key === 'ref') continue  // Don't set as attribute
```

2. Call ref in `handleInsert()` after element is in DOM:

```typescript
const ref = vnode.props.ref
if (typeof ref === 'function') {
  ref(state.elements.get(vnode.id))
}
```

3. Call ref in `handleRetract()` before element removal:

```typescript
const ref = vnode.props.ref
if (typeof ref === 'function') {
  ref(null)
}
```

## TypeScript Types

Create `src/jsx/types.ts` with full per-element typing:

```typescript
type RefCallback<T extends Element> = (element: T | null) => void

interface BaseHTMLAttributes<T extends Element> {
  ref?: RefCallback<T>
  key?: string
  class?: string
  id?: string
  style?: string
  onClick?: (e: MouseEvent) => void
  onInput?: (e: Event) => void
  onKeydown?: (e: KeyboardEvent) => void
  onKeyup?: (e: KeyboardEvent) => void
  onFocus?: (e: FocusEvent) => void
  onBlur?: (e: FocusEvent) => void
  onChange?: (e: Event) => void
  onSubmit?: (e: Event) => void
  [key: `data-${string}`]: string
  [key: `aria-${string}`]: string
}

interface InputHTMLAttributes extends BaseHTMLAttributes<HTMLInputElement> {
  type?: string
  value?: string
  placeholder?: string
  disabled?: boolean
  checked?: boolean
  name?: string
}

interface ButtonHTMLAttributes extends BaseHTMLAttributes<HTMLButtonElement> {
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
}

interface AnchorHTMLAttributes extends BaseHTMLAttributes<HTMLAnchorElement> {
  href?: string
  target?: string
  rel?: string
}

declare namespace JSX {
  interface IntrinsicElements {
    div: BaseHTMLAttributes<HTMLDivElement>
    span: BaseHTMLAttributes<HTMLSpanElement>
    p: BaseHTMLAttributes<HTMLParagraphElement>
    input: InputHTMLAttributes
    button: ButtonHTMLAttributes
    form: BaseHTMLAttributes<HTMLFormElement>
    label: BaseHTMLAttributes<HTMLLabelElement>
    textarea: BaseHTMLAttributes<HTMLTextAreaElement>
    select: BaseHTMLAttributes<HTMLSelectElement>
    option: BaseHTMLAttributes<HTMLOptionElement>
    a: AnchorHTMLAttributes
    img: BaseHTMLAttributes<HTMLImageElement> & { src?: string; alt?: string }
    header: BaseHTMLAttributes<HTMLElement>
    footer: BaseHTMLAttributes<HTMLElement>
    main: BaseHTMLAttributes<HTMLElement>
    section: BaseHTMLAttributes<HTMLElement>
    article: BaseHTMLAttributes<HTMLElement>
    nav: BaseHTMLAttributes<HTMLElement>
    aside: BaseHTMLAttributes<HTMLElement>
    h1: BaseHTMLAttributes<HTMLHeadingElement>
    h2: BaseHTMLAttributes<HTMLHeadingElement>
    h3: BaseHTMLAttributes<HTMLHeadingElement>
    h4: BaseHTMLAttributes<HTMLHeadingElement>
    h5: BaseHTMLAttributes<HTMLHeadingElement>
    h6: BaseHTMLAttributes<HTMLHeadingElement>
    ul: BaseHTMLAttributes<HTMLUListElement>
    ol: BaseHTMLAttributes<HTMLOListElement>
    li: BaseHTMLAttributes<HTMLLIElement>
  }
}
```

## Files to Change

1. `src/render/render.ts` - Add ref handling in handleInsert/handleRetract
2. `src/jsx/types.ts` - New file with JSX type definitions
3. `src/jsx/jsx-runtime.ts` - Export types, update JSX namespace
4. `examples/todo/src/main.tsx` - Update to use refs instead of getElementById

## Design Rationale

- **React-compatible API**: Familiar to most developers, no learning curve
- **Zero allocation**: Just a callback, no wrapper objects required
- **Differential dataflow aware**: Internally uses insert/retract, but presents clean API
- **Full type safety**: Each element type has correctly typed ref callback
