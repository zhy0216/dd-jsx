import { describe, it, expect } from 'vitest'
import { Input } from './input'
import { Context } from './context'
import { Delta } from './delta'

describe('Context', () => {
  it('creates a context with synchronous access', () => {
    const user = new Input({ name: 'Alice', active: true })
    const ctx = Context({ user })

    expect(ctx.user).toEqual({ name: 'Alice', active: true })

    ctx.dispose()
  })

  it('updates synchronous access when input changes', () => {
    const user = new Input({ name: 'Alice' })
    const ctx = Context({ user })

    expect(ctx.user).toEqual({ name: 'Alice' })

    user.set({ name: 'Bob' })
    expect(ctx.user).toEqual({ name: 'Bob' })

    ctx.dispose()
  })

  it('combines multiple inputs', () => {
    const user = new Input({ name: 'Alice' })
    const project = new Input({ title: 'DD-JSX' })
    const ctx = Context({ user, project })

    expect(ctx.user).toEqual({ name: 'Alice' })
    expect(ctx.project).toEqual({ title: 'DD-JSX' })

    ctx.dispose()
  })

  it('auto-injects into flatMap and re-emits when context changes', () => {
    const user = new Input({ active: true })
    const todos = new Input<{ id: number; text: string }>()
    const ctx = Context({ user })

    const currentResults: Map<string, { text: string; active: boolean }> = new Map()

    // flatMap should auto-inject context
    const mapped = todos.flatMap(todo => {
      return new Input({ text: todo.text, active: ctx.user?.active ?? false })
    })

    mapped.subscribe((item, delta) => {
      const key = item.text
      if (delta === Delta.Insert) {
        currentResults.set(key, item)
      } else {
        currentResults.delete(key)
      }
    })

    // Add a todo
    todos.insert({ id: 1, text: 'Test' })
    expect(currentResults.get('Test')).toEqual({ text: 'Test', active: true })

    // Change user.active - should re-emit with new context
    user.set({ active: false })

    // Final state should reflect new context value
    expect(currentResults.get('Test')).toEqual({ text: 'Test', active: false })

    ctx.dispose()
  })

  it('dispose removes context from auto-injection', () => {
    const user = new Input({ name: 'Alice' })
    const ctx = Context({ user })

    ctx.dispose()

    // After dispose, new collections should not auto-inject this context
    const items = new Input<number>()
    const changes: number[] = []

    items.flatMap(n => new Input(n * 2)).subscribe((item, delta) => {
      if (delta === Delta.Insert) changes.push(item)
    })

    items.insert(5)
    expect(changes).toEqual([10])

    // Changing user should not affect the flatMap (context was disposed)
    changes.length = 0
    user.set({ name: 'Bob' })
    expect(changes).toEqual([]) // No re-emission
  })
})
