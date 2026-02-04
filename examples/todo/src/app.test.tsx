// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { render } from 'dd-jsx'
import { createTodoApp } from './app'

describe('Todo App Integration', () => {
  let container: HTMLElement
  let app: ReturnType<typeof createTodoApp>
  let flush: () => Promise<void>

  beforeEach(() => {
    document.body.innerHTML = ''
    container = document.createElement('div')
    document.body.appendChild(container)
    app = createTodoApp()
    const result = render(app.App(), container)
    flush = result.flush
  })

  it('renders initial empty state with header and no footer', () => {
    expect(container.querySelector('.todo-header')).not.toBeNull()
    expect(container.querySelector('h1')?.textContent).toBe('DD-JSX Todo')
    expect(container.querySelector('.todo-input')).not.toBeNull()
    expect(container.querySelector('.add-btn')).not.toBeNull()
    expect(container.querySelector('.todo-list')).not.toBeNull()
    expect(container.querySelector('.todo-footer')).toBeNull()
  })

  it('adds a todo and shows it in the list', () => {
    app.newTodoText.set('Buy milk')
    app.addTodo()

    const todoItem = container.querySelector('.todo-item')
    expect(todoItem).not.toBeNull()
    expect(todoItem?.querySelector('.todo-text')?.textContent).toBe('Buy milk')

    const footers = container.querySelectorAll('.todo-footer')
    expect(footers.length).toBe(1)
    expect(footers[0]?.textContent).toContain('1 item left')
  })

  it('adds multiple todos and shows correct count', async () => {
    app.newTodoText.set('Buy milk')
    app.addTodo()
    app.newTodoText.set('Walk dog')
    app.addTodo()
    app.newTodoText.set('Do laundry')
    app.addTodo()
    await flush()

    const todoItems = container.querySelectorAll('.todo-item')
    expect(todoItems.length).toBe(3)

    const footers = container.querySelectorAll('.todo-footer')
    expect(footers.length).toBe(1)
    expect(footers[0]?.textContent).toContain('3 items left')
  })

  it('toggles a todo and updates state', async () => {
    app.newTodoText.set('Buy milk')
    app.addTodo()
    app.newTodoText.set('Walk dog')
    app.addTodo()

    const allTodos = app.todos.getAll()
    const firstTodo = allTodos[0]
    app.toggleTodo(firstTodo)
    await flush()

    const completedItem = container.querySelector('.todo-item.completed')
    expect(completedItem).not.toBeNull()

    const footers = container.querySelectorAll('.todo-footer')
    expect(footers.length).toBe(1)
    expect(footers[0]?.textContent).toContain('1 item left')
    expect(container.querySelector('.clear-btn')).not.toBeNull()
  })

  it('deletes a todo and updates the list', async () => {
    app.newTodoText.set('Buy milk')
    app.addTodo()
    app.newTodoText.set('Walk dog')
    app.addTodo()

    expect(container.querySelectorAll('.todo-item').length).toBe(2)

    const allTodos = app.todos.getAll()
    app.deleteTodo(allTodos[0])
    await flush()

    expect(container.querySelectorAll('.todo-item').length).toBe(1)

    const footers = container.querySelectorAll('.todo-footer')
    expect(footers.length).toBe(1)
    expect(footers[0]?.textContent).toContain('1 item left')
  })

  it('clears completed todos', async () => {
    app.newTodoText.set('Buy milk')
    app.addTodo()
    app.newTodoText.set('Walk dog')
    app.addTodo()
    app.newTodoText.set('Do laundry')
    app.addTodo()

    const allTodos = app.todos.getAll()
    app.toggleTodo(allTodos[0])
    app.toggleTodo(allTodos[2])
    await flush()

    expect(container.querySelectorAll('.todo-item.completed').length).toBe(2)

    const footerBefore = container.querySelectorAll('.todo-footer')
    expect(footerBefore.length).toBe(1)
    expect(footerBefore[0]?.textContent).toContain('1 item left')

    app.clearCompleted()
    await flush()

    expect(container.querySelectorAll('.todo-item').length).toBe(1)
    expect(container.querySelectorAll('.todo-item.completed').length).toBe(0)

    const footerAfter = container.querySelectorAll('.todo-footer')
    expect(footerAfter.length).toBe(1)
    expect(footerAfter[0]?.textContent).toContain('1 item left')
    expect(container.querySelector('.clear-btn')).toBeNull()
  })

  it('does not add empty todos', () => {
    app.newTodoText.set('')
    app.addTodo()
    expect(container.querySelectorAll('.todo-item').length).toBe(0)

    app.newTodoText.set('   ')
    app.addTodo()
    expect(container.querySelectorAll('.todo-item').length).toBe(0)
  })

  it('clears input text after adding a todo', () => {
    app.newTodoText.set('Buy milk')
    app.addTodo()

    expect(app.newTodoText.get()).toBe('')
  })
})
