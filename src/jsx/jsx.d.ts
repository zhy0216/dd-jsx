import { Collection } from '../core/collection'
import { VNode } from '../vnode/types'

type EventHandler<E = Event> = (event: E) => void

interface HTMLAttributes {
  // Standard HTML attributes
  class?: string
  id?: string
  style?: string
  title?: string
  tabindex?: number
  hidden?: boolean
  
  // Form attributes
  type?: string
  value?: string
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  checked?: boolean
  name?: string
  
  // Link attributes
  href?: string
  target?: string
  rel?: string
  
  // Image attributes
  src?: string
  alt?: string
  width?: number | string
  height?: number | string
  
  // Data attributes
  [key: `data-${string}`]: string | undefined
  
  // Event handlers
  onClick?: EventHandler<MouseEvent>
  onInput?: EventHandler<Event>
  onChange?: EventHandler<Event>
  onSubmit?: EventHandler<Event>
  onKeydown?: EventHandler<KeyboardEvent>
  onKeyup?: EventHandler<KeyboardEvent>
  onKeypress?: EventHandler<KeyboardEvent>
  onFocus?: EventHandler<FocusEvent>
  onBlur?: EventHandler<FocusEvent>
  onMouseenter?: EventHandler<MouseEvent>
  onMouseleave?: EventHandler<MouseEvent>
  
  // Key for list rendering
  key?: string
  
  // Allow any other attribute
  [key: string]: unknown
}

declare global {
  namespace JSX {
    type Element = Collection<VNode>
    
    interface IntrinsicElements {
      // Block elements
      div: HTMLAttributes
      p: HTMLAttributes
      span: HTMLAttributes
      h1: HTMLAttributes
      h2: HTMLAttributes
      h3: HTMLAttributes
      h4: HTMLAttributes
      h5: HTMLAttributes
      h6: HTMLAttributes
      header: HTMLAttributes
      footer: HTMLAttributes
      main: HTMLAttributes
      section: HTMLAttributes
      article: HTMLAttributes
      aside: HTMLAttributes
      nav: HTMLAttributes
      
      // List elements
      ul: HTMLAttributes
      ol: HTMLAttributes
      li: HTMLAttributes
      
      // Form elements
      form: HTMLAttributes
      input: HTMLAttributes
      button: HTMLAttributes
      textarea: HTMLAttributes
      select: HTMLAttributes
      option: HTMLAttributes
      label: HTMLAttributes
      
      // Table elements
      table: HTMLAttributes
      thead: HTMLAttributes
      tbody: HTMLAttributes
      tfoot: HTMLAttributes
      tr: HTMLAttributes
      th: HTMLAttributes
      td: HTMLAttributes
      
      // Media elements
      img: HTMLAttributes
      video: HTMLAttributes
      audio: HTMLAttributes
      
      // Link elements
      a: HTMLAttributes
      
      // Other elements
      br: HTMLAttributes
      hr: HTMLAttributes
      pre: HTMLAttributes
      code: HTMLAttributes
      strong: HTMLAttributes
      em: HTMLAttributes
      small: HTMLAttributes
      
      // Allow any element
      [elemName: string]: HTMLAttributes
    }
    
    interface ElementChildrenAttribute {
      children: {}
    }
  }
}

export {}
