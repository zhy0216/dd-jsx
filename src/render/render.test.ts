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

  addEventListener(_event: string, _handler: any) {
    // Mock implementation
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
