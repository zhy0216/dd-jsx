import { Collection } from '../core/collection'
import { VNode, Props, createVNode } from '../vnode/types'
import './types'
export { createRef } from './types'
export type { RefCallback, BaseHTMLAttributes, InputHTMLAttributes } from './types'

export const Fragment = Symbol('Fragment')

type JSXChild = string | number | Collection<VNode> | JSXChild[]

export function jsx(
  tag: string | typeof Fragment | ((props: Props) => Collection<VNode>),
  props: Props & { children?: JSXChild },
  key?: string
): Collection<VNode> {
  const { children, ...restProps } = props

  // Add key to props if provided as third argument
  if (key !== undefined) {
    restProps.key = key
  }

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
