import { describe, it, expect } from 'vitest'
import { VNode, Props, createVNode } from './types'

describe('VNode', () => {
  it('creates a vnode with required fields', () => {
    const vnode = createVNode({
      tag: 'div',
      props: { class: 'foo' }
    })

    expect(vnode.id).toBeDefined()
    expect(vnode.parentId).toBeNull()
    expect(vnode.index).toBe(0)
    expect(vnode.tag).toBe('div')
    expect(vnode.props).toEqual({ class: 'foo' })
  })

  it('uses provided key as id', () => {
    const vnode = createVNode({
      tag: 'div',
      props: { key: 'my-key' }
    })

    expect(vnode.id).toBe('my-key')
  })

  it('creates text node', () => {
    const vnode = createVNode({
      tag: '#text',
      props: {},
      text: 'Hello'
    })

    expect(vnode.tag).toBe('#text')
    expect(vnode.text).toBe('Hello')
  })
})
