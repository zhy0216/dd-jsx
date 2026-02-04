import { Collection } from '../core/collection'
import { VNode } from '../vnode/types'
import { Delta } from '../core/delta'

type Disposable = {
  dispose: () => void
  flush: () => Promise<void>
}

type RendererState = {
  elements: Map<string, Node>
  vnodes: Map<string, VNode>
  container: HTMLElement
  document: Document
  pendingRetracts: Map<string, VNode>  // Track retracts for potential updates
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
    document: doc,
    pendingRetracts: new Map()
  }

  const unsub = app.subscribe((vnode, delta) => {
    if (delta === Delta.Insert) {
      // Check if this is an update (retract + insert with same ID)
      if (state.pendingRetracts.has(vnode.id)) {
        const oldVnode = state.pendingRetracts.get(vnode.id)!
        state.pendingRetracts.delete(vnode.id)
        handleUpdate(oldVnode, vnode, state)
      } else {
        handleInsert(vnode, state)
      }
    } else {
      // Defer retract to allow for update detection
      state.pendingRetracts.set(vnode.id, vnode)
      queueMicrotask(() => {
        // Only process if still pending (wasn't converted to update)
        if (state.pendingRetracts.has(vnode.id)) {
          state.pendingRetracts.delete(vnode.id)
          handleRetract(vnode, state)
        }
      })
    }
  })

  return {
    dispose: () => {
      unsub()
      state.elements.clear()
      state.vnodes.clear()
    },
    flush: () => new Promise<void>(resolve => queueMicrotask(() => resolve()))
  }
}

function handleInsert(vnode: VNode, state: RendererState): void {
  const el = createElement(vnode, state)
  state.elements.set(vnode.id, el)
  state.vnodes.set(vnode.id, vnode)
  attachToParent(el, vnode, state)

  // Call ref callback with element
  const ref = vnode.props.ref
  if (typeof ref === 'function') {
    try {
      ref(el)
    } catch (e) {
      console.error('Error in ref callback during insert:', e)
    }
  }
}

function handleRetract(vnode: VNode, state: RendererState): void {
  const el = state.elements.get(vnode.id)
  if (!el) return

  // Call ref callback with null
  const ref = vnode.props.ref
  if (typeof ref === 'function') {
    try {
      ref(null)
    } catch (e) {
      console.error('Error in ref callback during retract:', e)
    }
  }

  (el as ChildNode).remove()
  state.elements.delete(vnode.id)
  state.vnodes.delete(vnode.id)
}

function handleUpdate(oldVnode: VNode, newVnode: VNode, state: RendererState): void {
  const el = state.elements.get(oldVnode.id)
  if (!el) return

  // Update text node
  if (newVnode.tag === '#text') {
    el.textContent = newVnode.text ?? ''
    state.vnodes.set(newVnode.id, newVnode)
    return
  }

  // Update element attributes
  const htmlEl = el as HTMLElement
  const oldProps = oldVnode.props
  const newProps = newVnode.props

  // Remove old attributes/handlers not in new props
  for (const key of Object.keys(oldProps)) {
    if (key === 'key' || key === 'ref') continue
    if (!(key in newProps)) {
      if (key.startsWith('on')) {
        const event = key.slice(2).toLowerCase()
        htmlEl.removeEventListener(event, oldProps[key])
      } else {
        htmlEl.removeAttribute(key)
      }
    }
  }

  // Set new/updated attributes/handlers
  for (const [key, value] of Object.entries(newProps)) {
    if (key === 'key' || key === 'ref') continue
    if (key.startsWith('on')) {
      const event = key.slice(2).toLowerCase()
      // Remove old handler if exists
      if (key in oldProps) {
        htmlEl.removeEventListener(event, oldProps[key])
      }
      htmlEl.addEventListener(event, value)
    } else if (oldProps[key] !== value) {
      // Special handling for input value to preserve cursor position
      if (key === 'value' && htmlEl.tagName === 'INPUT') {
        const input = htmlEl as HTMLInputElement
        if (input.value !== String(value)) {
          input.value = String(value)
        }
      } else {
        htmlEl.setAttribute(key, String(value))
      }
    }
  }

  state.vnodes.set(newVnode.id, newVnode)
}

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

function attachToParent(el: Node, vnode: VNode, state: RendererState): void {
  const parent = vnode.parentId
    ? state.elements.get(vnode.parentId)
    : state.container

  if (parent) {
    parent.appendChild(el)
  }
}
