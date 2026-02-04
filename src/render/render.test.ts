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
  eventListeners: Map<string, Function[]> = new Map()
  value: string = ''  // For input elements

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
    // For input elements, setting value attribute also sets value property initially
    if (key === 'value' && this.tagName === 'INPUT') {
      this.value = value
    }
  }

  removeAttribute(key: string) {
    this.attributes.delete(key)
  }

  addEventListener(event: string, handler: Function) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)!.push(handler)
  }

  removeEventListener(event: string, handler: Function) {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      const idx = listeners.indexOf(handler)
      if (idx >= 0) listeners.splice(idx, 1)
    }
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

  it('removes elements on retract', async () => {
    const container = new MockElement('div')
    const doc = createMockDocument()

    const vnode = createVNode({ tag: 'div', props: {} })
    const vnodes = Collection.from<VNode>([])

    const { flush } = render(vnodes, container as any, doc as any)

    // Manually emit insert then retract
    ;(vnodes as any).emit(vnode, Delta.Insert)
    expect(container.children.length).toBe(1)

    ;(vnodes as any).emit(vnode, Delta.Retract)
    // Retract is deferred to allow for update detection
    await flush()
    expect(container.children.length).toBe(0)
  })

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

  it('calls ref callback with null on retract', async () => {
    const container = new MockElement('div')
    const doc = createMockDocument()

    let refElement: any = 'not-called'
    const vnode = createVNode({
      tag: 'div',
      props: { ref: (el: any) => { refElement = el } }
    })

    const vnodes = Collection.from<VNode>([])
    const { flush } = render(vnodes, container as any, doc as any)

    // Insert
    ;(vnodes as any).emit(vnode, Delta.Insert)
    expect(refElement).not.toBeNull()
    expect(refElement.tagName).toBe('DIV')

    // Retract
    ;(vnodes as any).emit(vnode, Delta.Retract)
    // Retract is deferred to allow for update detection
    await flush()
    expect(refElement).toBeNull()
  })

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

  it('updates element instead of recreating when same id is retracted then inserted', () => {
    const container = new MockElement('div')
    const doc = createMockDocument()

    // Use key prop for stable id
    const vnode1 = createVNode({ tag: 'input', props: { key: 'my-input', value: 'hello' } })
    const vnodes = Collection.from<VNode>([])

    render(vnodes, container as any, doc as any)

    // Insert first vnode
    ;(vnodes as any).emit(vnode1, Delta.Insert)
    expect(container.children.length).toBe(1)
    const originalElement = container.children[0]
    expect(originalElement.value).toBe('hello')

    // Retract then insert with same id but different value
    const vnode2 = createVNode({ tag: 'input', props: { key: 'my-input', value: 'world' } })
    ;(vnodes as any).emit(vnode1, Delta.Retract)
    ;(vnodes as any).emit(vnode2, Delta.Insert)

    // Should be same element instance (not recreated)
    expect(container.children.length).toBe(1)
    expect(container.children[0]).toBe(originalElement)
    // With updated value property (for inputs, value is set via property not attribute)
    expect(originalElement.value).toBe('world')
  })

  it('recreates element when different ids are retracted then inserted', async () => {
    const container = new MockElement('div')
    const doc = createMockDocument()

    const vnode1 = createVNode({ tag: 'div', props: { class: 'first' } })
    const vnodes = Collection.from<VNode>([])

    const { flush } = render(vnodes, container as any, doc as any)

    // Insert first vnode
    ;(vnodes as any).emit(vnode1, Delta.Insert)
    expect(container.children.length).toBe(1)
    const originalElement = container.children[0]
    expect(originalElement.attributes.get('class')).toBe('first')

    // Retract then insert with different id
    const vnode2 = createVNode({ tag: 'div', props: { class: 'second' } })
    ;(vnodes as any).emit(vnode1, Delta.Retract)
    ;(vnodes as any).emit(vnode2, Delta.Insert)

    // Should have two elements briefly (old pending removal)
    expect(container.children.length).toBe(2)

    // After flush, old element is removed
    await flush()
    expect(container.children.length).toBe(1)
    expect(container.children[0]).not.toBe(originalElement)
    expect(container.children[0].attributes.get('class')).toBe('second')
  })
})
