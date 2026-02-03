export type Props = Record<string, any> & {
  key?: string
}

export type ComponentFn = (props: Props) => any  // Will be Collection<VNode>

export type VNode = {
  id: string
  parentId: string | null
  index: number
  tag: string | ComponentFn
  props: Props
  text?: string
}

let autoId = 0

export function createVNode(options: {
  tag: string | ComponentFn
  props: Props
  text?: string
  parentId?: string | null
  index?: number
}): VNode {
  const id = options.props.key ?? `__auto_${++autoId}`

  return {
    id,
    parentId: options.parentId ?? null,
    index: options.index ?? 0,
    tag: options.tag,
    props: options.props,
    text: options.text
  }
}

export function resetAutoId(): void {
  autoId = 0
}
