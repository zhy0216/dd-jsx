import { render } from 'dd-jsx'
import { createTodoApp } from './app'

const { App } = createTodoApp()
render(App(), document.getElementById('app')!)
