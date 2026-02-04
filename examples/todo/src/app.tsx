import { input, Delta } from 'dd-jsx'

export type Todo = {
  id: string
  text: string
  completed: boolean
}

export function createTodoApp() {
  // State - collection of individual todos (not an array)
  const todos = input<Todo>()
  const newTodoText = input('')

  // Derived state via reduce (incremental delta-based aggregation)
  const footerState = todos.reduce(
    { total: 0, completedCount: 0 },
    (state, todo, delta) => {
      const mult = delta === Delta.Insert ? 1 : -1
      return {
        total: state.total + mult,
        completedCount: state.completedCount + (todo.completed ? mult : 0)
      }
    }
  )

  // Generate unique ID
  let nextId = 1
  function generateId(): string {
    return `todo-${nextId++}`
  }

  // Actions - delta-native operations
  function addTodo() {
    const text = newTodoText.get()?.trim()
    if (!text) return

    todos.insert({ id: generateId(), text, completed: false })
    newTodoText.set('')
  }

  function toggleTodo(todo: Todo) {
    todos.replace(todo, { ...todo, completed: !todo.completed })
  }

  function deleteTodo(todo: Todo) {
    todos.retract(todo)
  }

  function clearCompleted() {
    for (const todo of todos.getAll()) {
      if (todo.completed) {
        todos.retract(todo)
      }
    }
  }

  // Input form with reactive text binding
  function TodoInput() {
    return newTodoText.flatMap(text => (
      <div class="todo-input-container">
        <input
          class="todo-input"
          type="text"
          placeholder="What needs to be done?"
          value={text}
          onInput={(e: Event) => newTodoText.set((e.target as HTMLInputElement).value)}
          onKeydown={(e: KeyboardEvent) => {
            if (e.key === 'Enter') addTodo()
          }}
        />
        <button class="add-btn" onClick={addTodo}>
          Add
        </button>
      </div>
    ))
  }

  function App() {
    // FlatMap each todo to TodoItem VNodes
    const todoItems = todos.flatMap(todo => (
      <div class={`todo-item ${todo.completed ? 'completed' : ''}`} key={todo.id}>
        <div
          class={`todo-checkbox ${todo.completed ? 'checked' : ''}`}
          onClick={() => toggleTodo(todo)}
        >
          {todo.completed ? '✓' : ''}
        </div>
        <span class="todo-text">{todo.text}</span>
        <button class="delete-btn" onClick={() => deleteTodo(todo)}>
          Delete
        </button>
      </div>
    ))

    // Derive footer from reduced state
    const footer = footerState.flatMap(({ total, completedCount }) => {
      if (total === 0) return <></>
      const remaining = total - completedCount
      const hasCompleted = completedCount > 0

      return (
        <div class="todo-footer">
          <span>{remaining} item{remaining !== 1 ? 's' : ''} left</span>
          {hasCompleted ? (
            <button class="clear-btn" onClick={clearCompleted}>
              Clear completed
            </button>
          ) : (
            <span></span>
          )}
        </div>
      )
    })

    return (
      <div class="todo-container">
        <div class="todo-header">
          <h1>DD-JSX Todo</h1>
          <TodoInput />
        </div>
        <div class="todo-list">
          {todoItems}
        </div>
        {footer}
      </div>
    )
  }

  return { todos, newTodoText, addTodo, toggleTodo, deleteTodo, clearCompleted, App }
}
