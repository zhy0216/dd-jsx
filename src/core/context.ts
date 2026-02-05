import { Collection } from './collection'
import { Input } from './input'
import { Delta } from './delta'
import { registerContext } from './context-registry'

/**
 * Create a reactive context from a set of inputs.
 *
 * The returned proxy can be used directly in collection operators
 * and will automatically be injected via withLatest.
 *
 * @example
 * ```ts
 * const user = new Input<User>()
 * const project = new Input<Project>()
 *
 * const ctx = Context({ user, project })
 *
 * // ctx.user and ctx.project are reactive - when they change,
 * // any collection operator using them will re-emit
 * todos.flatMap(todo => (
 *   <div className={ctx.user?.active ? "active" : ""}>
 *     {todo.text}
 *   </div>
 * ))
 * ```
 */
export function Context<T extends Record<string, Input<any>>>(
  inputs: T
): ContextProxy<T> & { dispose: () => void } {
  const context = new ContextCollection(inputs)
  const unregister = registerContext(context.combined)

  // Create proxy with dispose method stored in closure
  let disposed = false
  const dispose = () => {
    if (!disposed) {
      disposed = true
      unregister()
    }
  }

  const proxy = new Proxy({} as ContextProxy<T> & { dispose: () => void }, {
    get: (_, key: string) => {
      if (key === 'dispose') return dispose
      return context.current[key]
    }
  })

  return proxy
}

class ContextCollection<T extends Record<string, Input<any>>> {
  public combined: Collection<Record<string, any>>
  public current: Record<string, any> = {}

  constructor(private inputs: T) {
    const keys = Object.keys(inputs)

    if (keys.length === 0) {
      this.combined = Collection.from([{}])
    } else {
      // Start with first input mapped to object
      const firstKey = keys[0]
      let combined: Collection<Record<string, any>> = inputs[firstKey].map(
        val => ({ [firstKey]: val })
      )

      // Chain withLatest for remaining inputs, mapping tuple to merged object
      for (let i = 1; i < keys.length; i++) {
        const key = keys[i]
        combined = combined
          .withLatest(inputs[key])
          .map(([ctx, val]) => ({ ...ctx, [key]: val }))
      }

      this.combined = combined
    }

    // Track current values for synchronous access
    this.combined.subscribe((value, delta) => {
      if (delta === Delta.Insert) {
        this.current = value
      }
    })
  }
}

type ContextProxy<T extends Record<string, Input<any>>> = {
  [K in keyof T]: T[K] extends Input<infer U> ? U : never
}
