import { Collection } from '../core/collection'
import { VNode } from '../vnode/types'

// Ref callback type
export type RefCallback<T extends Element> = (element: T | null) => void

// Base attributes shared by all HTML elements
export interface BaseHTMLAttributes<T extends Element> {
  ref?: RefCallback<T>
  key?: string
  class?: string
  id?: string
  style?: string
  title?: string
  tabIndex?: number
  hidden?: boolean
  // Event handlers
  onClick?: (e: MouseEvent) => void
  onDblClick?: (e: MouseEvent) => void
  onMouseDown?: (e: MouseEvent) => void
  onMouseUp?: (e: MouseEvent) => void
  onMouseEnter?: (e: MouseEvent) => void
  onMouseLeave?: (e: MouseEvent) => void
  onMouseMove?: (e: MouseEvent) => void
  onInput?: (e: Event) => void
  onKeydown?: (e: KeyboardEvent) => void
  onKeyup?: (e: KeyboardEvent) => void
  onKeypress?: (e: KeyboardEvent) => void
  onFocus?: (e: FocusEvent) => void
  onBlur?: (e: FocusEvent) => void
  onChange?: (e: Event) => void
  onSubmit?: (e: Event) => void
  onScroll?: (e: Event) => void
  // Data and ARIA attributes
  [key: `data-${string}`]: string | undefined
  [key: `aria-${string}`]: string | undefined
}

// Form element attributes
export interface InputHTMLAttributes extends BaseHTMLAttributes<HTMLInputElement> {
  type?: string
  value?: string
  placeholder?: string
  disabled?: boolean
  checked?: boolean
  name?: string
  readonly?: boolean
  required?: boolean
  maxLength?: number
  minLength?: number
  min?: string | number
  max?: string | number
  step?: string | number
  pattern?: string
  autoComplete?: string
  autoFocus?: boolean
}

export interface ButtonHTMLAttributes extends BaseHTMLAttributes<HTMLButtonElement> {
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  name?: string
  value?: string
}

export interface TextareaHTMLAttributes extends BaseHTMLAttributes<HTMLTextAreaElement> {
  value?: string
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  rows?: number
  cols?: number
  maxLength?: number
  minLength?: number
  name?: string
}

export interface SelectHTMLAttributes extends BaseHTMLAttributes<HTMLSelectElement> {
  value?: string
  disabled?: boolean
  multiple?: boolean
  required?: boolean
  name?: string
}

export interface OptionHTMLAttributes extends BaseHTMLAttributes<HTMLOptionElement> {
  value?: string
  disabled?: boolean
  selected?: boolean
}

export interface AnchorHTMLAttributes extends BaseHTMLAttributes<HTMLAnchorElement> {
  href?: string
  target?: '_blank' | '_self' | '_parent' | '_top'
  rel?: string
  download?: string | boolean
}

export interface ImageHTMLAttributes extends BaseHTMLAttributes<HTMLImageElement> {
  src?: string
  alt?: string
  width?: number | string
  height?: number | string
  loading?: 'eager' | 'lazy'
}

export interface FormHTMLAttributes extends BaseHTMLAttributes<HTMLFormElement> {
  action?: string
  method?: 'get' | 'post'
  encType?: string
  target?: string
  noValidate?: boolean
}

export interface LabelHTMLAttributes extends BaseHTMLAttributes<HTMLLabelElement> {
  htmlFor?: string
}

// JSX namespace declaration
declare global {
  namespace JSX {
    type Element = Collection<VNode>

    interface ElementChildrenAttribute {
      children: {}
    }

    interface IntrinsicElements {
      // Container elements
      div: BaseHTMLAttributes<HTMLDivElement>
      span: BaseHTMLAttributes<HTMLSpanElement>
      p: BaseHTMLAttributes<HTMLParagraphElement>
      pre: BaseHTMLAttributes<HTMLPreElement>
      code: BaseHTMLAttributes<HTMLElement>

      // Form elements
      input: InputHTMLAttributes
      button: ButtonHTMLAttributes
      form: FormHTMLAttributes
      label: LabelHTMLAttributes
      textarea: TextareaHTMLAttributes
      select: SelectHTMLAttributes
      option: OptionHTMLAttributes

      // Links and media
      a: AnchorHTMLAttributes
      img: ImageHTMLAttributes

      // Structure
      header: BaseHTMLAttributes<HTMLElement>
      footer: BaseHTMLAttributes<HTMLElement>
      main: BaseHTMLAttributes<HTMLElement>
      section: BaseHTMLAttributes<HTMLElement>
      article: BaseHTMLAttributes<HTMLElement>
      nav: BaseHTMLAttributes<HTMLElement>
      aside: BaseHTMLAttributes<HTMLElement>

      // Headings
      h1: BaseHTMLAttributes<HTMLHeadingElement>
      h2: BaseHTMLAttributes<HTMLHeadingElement>
      h3: BaseHTMLAttributes<HTMLHeadingElement>
      h4: BaseHTMLAttributes<HTMLHeadingElement>
      h5: BaseHTMLAttributes<HTMLHeadingElement>
      h6: BaseHTMLAttributes<HTMLHeadingElement>

      // Lists
      ul: BaseHTMLAttributes<HTMLUListElement>
      ol: BaseHTMLAttributes<HTMLOListElement>
      li: BaseHTMLAttributes<HTMLLIElement>

      // Table
      table: BaseHTMLAttributes<HTMLTableElement>
      thead: BaseHTMLAttributes<HTMLTableSectionElement>
      tbody: BaseHTMLAttributes<HTMLTableSectionElement>
      tfoot: BaseHTMLAttributes<HTMLTableSectionElement>
      tr: BaseHTMLAttributes<HTMLTableRowElement>
      th: BaseHTMLAttributes<HTMLTableCellElement>
      td: BaseHTMLAttributes<HTMLTableCellElement>

      // Other
      br: BaseHTMLAttributes<HTMLBRElement>
      hr: BaseHTMLAttributes<HTMLHRElement>
      strong: BaseHTMLAttributes<HTMLElement>
      em: BaseHTMLAttributes<HTMLElement>
      small: BaseHTMLAttributes<HTMLElement>

      // SVG (basic support)
      svg: BaseHTMLAttributes<SVGSVGElement> & { viewBox?: string; xmlns?: string }
      path: BaseHTMLAttributes<SVGPathElement> & { d?: string; fill?: string; stroke?: string }
    }
  }
}

// Helper function to create ref objects
export function createRef<T extends Element>(): { current: T | null } {
  return { current: null }
}
