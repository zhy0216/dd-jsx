import { describe, it, expect, beforeEach } from 'vitest'
import { jsx, Fragment } from './jsx-runtime'
import { Collection } from '../core/collection'
import { Delta } from '../core/delta'
import { resetAutoId } from '../vnode/types'

describe('jsx', () => {
  beforeEach(() => {
    resetAutoId()
  })

  it('creates collection from element', () => {
    const result = jsx('div', { class: 'foo' })

    expect(result).toBeInstanceOf(Collection)

    const vnodes: any[] = []
    result.subscribe((vnode, delta) => {
      if (delta === Delta.Insert) vnodes.push(vnode)
    })

    expect(vnodes.length).toBe(1)
    expect(vnodes[0].tag).toBe('div')
    expect(vnodes[0].props.class).toBe('foo')
  })

  it('handles text children', () => {
    const result = jsx('span', { children: 'Hello' })

    const vnodes: any[] = []
    result.subscribe((vnode, delta) => {
      if (delta === Delta.Insert) vnodes.push(vnode)
    })

    expect(vnodes.length).toBe(2)
    expect(vnodes[0].tag).toBe('span')
    expect(vnodes[1].tag).toBe('#text')
    expect(vnodes[1].text).toBe('Hello')
    expect(vnodes[1].parentId).toBe(vnodes[0].id)
  })

  it('handles component functions', () => {
    const MyComponent = (props: any) =>
      jsx('div', { children: props.name })

    const result = jsx(MyComponent, { name: 'Test' })

    const vnodes: any[] = []
    result.subscribe((vnode, delta) => {
      if (delta === Delta.Insert) vnodes.push(vnode)
    })

    expect(vnodes.length).toBe(2)
    expect(vnodes[0].tag).toBe('div')
  })
})

describe('Fragment', () => {
  beforeEach(() => {
    resetAutoId()
  })

  it('concatenates children', () => {
    const child1 = jsx('div', {})
    const child2 = jsx('span', {})
    const result = jsx(Fragment, { children: [child1, child2] })

    const vnodes: any[] = []
    result.subscribe((vnode, delta) => {
      if (delta === Delta.Insert) vnodes.push(vnode)
    })

    expect(vnodes.length).toBe(2)
    expect(vnodes[0].tag).toBe('div')
    expect(vnodes[1].tag).toBe('span')
  })
})
