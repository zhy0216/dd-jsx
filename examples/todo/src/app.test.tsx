// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { render } from 'dd-jsx'
import { createTodoApp } from './app'

/** Helper: the footer uses todos.flatMap which creates one footer per todo.
 *  The most recently emitted footer (last in DOM) has the up-to-date count. */
function lastFooter(container: HTMLElement): Element | null {
  const footers = container.querySelectorAll('.todo-footer')
  return footers.length > 0 ? footers[footers.length - 1] : null
}

/** Helper: get the last clear-completed button (same reason as lastFooter). */
function lastClearBtn(container: HTMLElement): Element | null {
  const btns = container.querySelectorAll('.clear-btn')
  return btns.length > 0 ? btns[btns.length - 1] : null
}

describe('Todo App Integration', () => {
  let container: HTMLElement
  let app: ReturnType<typeof createTodoApp>

  beforeEach(() => {
    document.body.innerHTML = ''
    container = document.createElement('div')
    document.body.appendChild(container)
    app = createTodoApp()
    render(app.App(), container)
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

    const footer = lastFooter(container)
    expect(footer).not.toBeNull()
    expect(footer?.textContent).toContain('1 item left')
  })

  it('adds multiple todos and shows correct count', () => {
    app.newTodoText.set('Buy milk')
    app.addTodo()
    app.newTodoText.set('Walk dog')
    app.addTodo()
    app.newTodoText.set('Do laundry')
    app.addTodo()

    const todoItems = container.querySelectorAll('.todo-item')
    expect(todoItems.length).toBe(3)

    const footer = lastFooter(container)
    expect(footer?.textContent).toContain('3 items left')
  })

  it('toggles a todo and updates state', () => {
    app.newTodoText.set('Buy milk')
    app.addTodo()
    app.newTodoText.set('Walk dog')
    app.addTodo()

    const allTodos = app.todos.getAll()
    const firstTodo = allTodos[0]
    app.toggleTodo(firstTodo)

    // The toggled todo gets retracted and re-inserted with completed=true
    const completedItem = container.querySelector('.todo-item.completed')
    expect(completedItem).not.toBeNull()

    const footer = lastFooter(container)
    expect(footer?.textContent).toContain('1 item left')
    expect(lastClearBtn(container)).not.toBeNull()
  })

  it('deletes a todo and removes it from the list', () => {
    app.newTodoText.set('Buy milk')
    app.addTodo()
    app.newTodoText.set('Walk dog')
    app.addTodo()

    expect(container.querySelectorAll('.todo-item').length).toBe(2)

    const allTodos = app.todos.getAll()
    app.deleteTodo(allTodos[0])

    expect(container.querySelectorAll('.todo-item').length).toBe(1)
    // Verify the remaining todo is correct
    expect(app.todos.getAll().length).toBe(1)
    expect(app.todos.getAll()[0].text).toBe('Walk dog')
  })

  it('clears completed todos', () => {
    app.newTodoText.set('Buy milk')
    app.addTodo()
    app.newTodoText.set('Walk dog')
    app.addTodo()
    app.newTodoText.set('Do laundry')
    app.addTodo()

    const allTodos = app.todos.getAll()
    app.toggleTodo(allTodos[0])
    app.toggleTodo(allTodos[2])

    expect(container.querySelectorAll('.todo-item.completed').length).toBe(2)
    expect(lastFooter(container)?.textContent).toContain('1 item left')

    app.clearCompleted()

    // Completed todos removed from DOM and state
    expect(container.querySelectorAll('.todo-item.completed').length).toBe(0)
    expect(app.todos.getAll().length).toBe(1)
    expect(app.todos.getAll()[0].text).toBe('Walk dog')
    expect(app.todos.getAll()[0].completed).toBe(false)
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
