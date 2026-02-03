import { Collection } from '../core/collection'
import { VNode, Props, createVNode } from '../vnode/types'

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
  if (children === undefined || children === null) {
    return Collection.from<VNode>([])
  }

  if (typeof children === 'string' || typeof children === 'number') {
    const textNode = createVNode({
      tag: '#text',
      props: {},
      text: String(children),
      parentId,
      index: 0
    })
    return Collection.from([textNode])
  }

  if (children instanceof Collection) {
    // Reparent collection items
    return children.map(vnode => ({
      ...vnode,
      parentId
    }))
  }

  if (Array.isArray(children)) {
    const collections = children.map((child, index) => {
      const col = processChild(child, parentId, index)
      return col
    })
    return Collection.concat(...collections)
  }

  return Collection.from<VNode>([])
}

function processChild(child: JSXChild, parentId: string | null, index: number): Collection<VNode> {
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
      parentId,
      index
    }))
  }

  if (Array.isArray(child)) {
    return processChildren(child, parentId)
  }

  return Collection.from<VNode>([])
}

// For JSX automatic runtime
export { jsx as jsxs, jsx as jsxDEV }
