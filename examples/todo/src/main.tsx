import { render, input, Input, Collection } from 'dd-jsx'

type Todo = {
  id: string
  text: string
  completed: boolean
}

// State
const todos = input<Todo[]>([])
const newTodoText = input('')

// Generate unique ID
let nextId = 1
function generateId(): string {
  return `todo-${nextId++}`
}

// Actions
function addTodo() {
  const currentTodos = getCurrentValue(todos)
  const text = getCurrentValue(newTodoText).trim()

  if (!text) return

  todos.set([
    ...currentTodos,
    { id: generateId(), text, completed: false }
  ])
  newTodoText.set('')

  // Clear the input element directly since we don't use controlled value binding
  const input = document.getElementById('todo-input') as HTMLInputElement
  if (input) input.value = ''
}

function toggleTodo(id: string) {
  const currentTodos = getCurrentValue(todos)
  todos.set(
    currentTodos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    )
  )
}

function deleteTodo(id: string) {
  const currentTodos = getCurrentValue(todos)
  todos.set(currentTodos.filter(todo => todo.id !== id))
}

function clearCompleted() {
  const currentTodos = getCurrentValue(todos)
  todos.set(currentTodos.filter(todo => !todo.completed))
}

// Helper to get current value from Input
function getCurrentValue<T>(inp: Input<T>): T {
  let value: T = undefined as T
  const unsub = inp.subscribe((item) => {
    value = item
  })
  unsub()
  return value
}

// Components
function TodoItem({ todo }: { todo: Todo }) {
  return (
    <div class={`todo-item ${todo.completed ? 'completed' : ''}`} key={todo.id}>
      <div
        class={`todo-checkbox ${todo.completed ? 'checked' : ''}`}
        onClick={() => toggleTodo(todo.id)}
      >
        {todo.completed ? '✓' : ''}
      </div>
      <span class="todo-text">{todo.text}</span>
      <button class="delete-btn" onClick={() => deleteTodo(todo.id)}>
        Delete
      </button>
    </div>
  )
}

function TodoList({ todos: todoList }: { todos: Todo[] }) {
  if (todoList.length === 0) {
    return (
      <div class="empty-state">
        No todos yet. Add one above!
      </div>
    )
  }

  return (
    <div class="todo-list">
      {todoList.map(todo => (
        <TodoItem todo={todo} key={todo.id} />
      ))}
    </div>
  )
}

function TodoFooter({ todos: todoList }: { todos: Todo[] }) {
  const remaining = todoList.filter(t => !t.completed).length
  const hasCompleted = todoList.some(t => t.completed)

  if (todoList.length === 0) {
    return <></>
  }

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
}

function App() {
  return todos.flatMap(todoList => (
    <div class="todo-container">
      <div class="todo-header">
        <h1>DD-JSX Todo</h1>
        <div class="todo-input-container">
          <input
            id="todo-input"
            class="todo-input"
            type="text"
            placeholder="What needs to be done?"
            onInput={(e: Event) => newTodoText.set((e.target as HTMLInputElement).value)}
            onKeydown={(e: KeyboardEvent) => {
              if (e.key === 'Enter') addTodo()
            }}
          />
          <button class="add-btn" onClick={addTodo}>
            Add
          </button>
        </div>
      </div>
      <TodoList todos={todoList} />
      <TodoFooter todos={todoList} />
    </div>
  ))
}

// Mount
const container = document.getElementById('app')!
render(App(), container)
