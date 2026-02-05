import { render } from 'dd-jsx'
import { createExcelApp } from './app'

const { App } = createExcelApp()
render(App(), document.getElementById('app')!)
