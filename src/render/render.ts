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
    if ((el as HTMLElement).remove) {
      (el as HTMLElement).remove()
    } else if (el.parentElement) {
      el.parentElement.removeChild(el)
    }
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
