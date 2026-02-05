// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { render } from 'dd-jsx'
import { createExcelApp } from './app'
import { indexToColumnLetter, columnLetterToIndex, formatCellAddress, parseCellAddress } from './utils'
import { isFormula, evaluateFormula, parseFormulaDependencies } from './formula'

describe('Utils', () => {
  it('converts column index to letter', () => {
    expect(indexToColumnLetter(0)).toBe('A')
    expect(indexToColumnLetter(1)).toBe('B')
    expect(indexToColumnLetter(25)).toBe('Z')
    expect(indexToColumnLetter(26)).toBe('AA')
    expect(indexToColumnLetter(27)).toBe('AB')
  })

  it('converts column letter to index', () => {
    expect(columnLetterToIndex('A')).toBe(0)
    expect(columnLetterToIndex('B')).toBe(1)
    expect(columnLetterToIndex('Z')).toBe(25)
    expect(columnLetterToIndex('AA')).toBe(26)
    expect(columnLetterToIndex('AB')).toBe(27)
  })

  it('formats cell address', () => {
    expect(formatCellAddress(0, 0)).toBe('A1')
    expect(formatCellAddress(1, 0)).toBe('B1')
    expect(formatCellAddress(0, 9)).toBe('A10')
    expect(formatCellAddress(25, 0)).toBe('Z1')
  })

  it('parses cell address', () => {
    expect(parseCellAddress('A1')).toEqual({ col: 0, row: 0 })
    expect(parseCellAddress('B1')).toEqual({ col: 1, row: 0 })
    expect(parseCellAddress('A10')).toEqual({ col: 0, row: 9 })
    expect(parseCellAddress('Z1')).toEqual({ col: 25, row: 0 })
    expect(parseCellAddress('invalid')).toBeNull()
  })
})

describe('Formula', () => {
  it('detects formulas', () => {
    expect(isFormula('=A1')).toBe(true)
    expect(isFormula('= A1')).toBe(true)
    expect(isFormula('A1')).toBe(false)
    expect(isFormula('100')).toBe(false)
  })

  it('parses formula dependencies', () => {
    expect(parseFormulaDependencies('=A1')).toContain('0:0')
    expect(parseFormulaDependencies('=A1+B2')).toContain('0:0')
    expect(parseFormulaDependencies('=A1+B2')).toContain('1:1')
  })

  it('evaluates simple cell reference', () => {
    const getCellValue = (col: number, row: number) => {
      if (col === 0 && row === 0) return '10'
      return ''
    }
    expect(evaluateFormula('=A1', getCellValue)).toBe('10')
  })

  it('evaluates arithmetic expressions', () => {
    const getCellValue = (col: number, row: number) => {
      if (col === 0 && row === 0) return '10'
      if (col === 1 && row === 0) return '5'
      return ''
    }
    expect(evaluateFormula('=A1+B1', getCellValue)).toBe('15')
    expect(evaluateFormula('=A1-B1', getCellValue)).toBe('5')
    expect(evaluateFormula('=A1*B1', getCellValue)).toBe('50')
    expect(evaluateFormula('=A1/B1', getCellValue)).toBe('2')
  })

  it('evaluates SUM function', () => {
    const getCellValue = (col: number, row: number) => {
      if (col === 0 && row <= 2) return String((row + 1) * 10) // 10, 20, 30
      return ''
    }
    expect(evaluateFormula('=SUM(A1:A3)', getCellValue)).toBe('60')
  })

  it('handles division by zero', () => {
    const getCellValue = () => '0'
    expect(evaluateFormula('=A1/B1', getCellValue)).toBe('#DIV/0!')
  })

  it('handles invalid formulas', () => {
    const getCellValue = () => ''
    expect(evaluateFormula('=INVALID()', getCellValue)).toBe('#ERROR')
  })
})

describe('Excel App Integration', () => {
  let container: HTMLElement
  let app: ReturnType<typeof createExcelApp>
  let flush: () => Promise<void>

  beforeEach(() => {
    document.body.innerHTML = ''
    container = document.createElement('div')
    document.body.appendChild(container)
    app = createExcelApp()
    const result = render(app.App(), container)
    flush = result.flush
  })

  it('renders initial grid with headers', () => {
    expect(container.querySelector('.excel-header')).not.toBeNull()
    expect(container.querySelector('h1')?.textContent).toBe('DD-JSX Excel')
    expect(container.querySelector('.formula-bar')).not.toBeNull()
    expect(container.querySelector('.grid')).not.toBeNull()
    expect(container.querySelectorAll('.header-cell').length).toBeGreaterThan(0)
  })

  it('selects a cell and shows address in formula bar', async () => {
    app.selectCell(0, 0)
    await flush()

    const selected = container.querySelector('.data-cell.selected')
    expect(selected).not.toBeNull()

    const address = container.querySelector('.cell-address')
    expect(address?.textContent).toBe('A1')
  })

  it('enters and commits a value', async () => {
    app.selectCell(0, 0)
    app.startEditing()
    app.updateEditValue('100')
    app.commitEdit()
    await flush()

    expect(app.getCellValue(0, 0)).toBe('100')
  })

  it('evaluates a formula', async () => {
    // Set up cells
    app.selectCell(0, 0)
    app.startEditing()
    app.updateEditValue('10')
    app.commitEdit()

    app.selectCell(1, 0)
    app.startEditing()
    app.updateEditValue('20')
    app.commitEdit()

    // Enter formula
    app.selectCell(2, 0)
    app.startEditing()
    app.updateEditValue('=A1+B1')
    app.commitEdit()
    await flush()

    expect(app.getCellValue(2, 0)).toBe('30')
  })

  it('evaluates SUM formula', async () => {
    // Set up column
    for (let row = 0; row < 3; row++) {
      app.selectCell(0, row)
      app.startEditing()
      app.updateEditValue(String((row + 1) * 10))
      app.commitEdit()
    }

    // Enter SUM formula
    app.selectCell(1, 0)
    app.startEditing()
    app.updateEditValue('=SUM(A1:A3)')
    app.commitEdit()
    await flush()

    expect(app.getCellValue(1, 0)).toBe('60')
  })

  it('cancels edit and reverts value', async () => {
    app.selectCell(0, 0)
    app.startEditing()
    app.updateEditValue('100')
    app.commitEdit()
    await flush()

    app.startEditing()
    app.updateEditValue('200')
    app.cancelEdit()
    await flush()

    expect(app.getCellValue(0, 0)).toBe('100')
  })

  it('moves selection with keyboard', async () => {
    app.selectCell(1, 1)
    await flush()

    app.moveSelection(1, 0) // right
    expect(app.selection.get()).toEqual({ col: 2, row: 1 })

    app.moveSelection(0, 1) // down
    expect(app.selection.get()).toEqual({ col: 2, row: 2 })

    app.moveSelection(-1, 0) // left
    expect(app.selection.get()).toEqual({ col: 1, row: 2 })

    app.moveSelection(0, -1) // up
    expect(app.selection.get()).toEqual({ col: 1, row: 1 })
  })

  it('respects grid boundaries when moving', async () => {
    app.selectCell(0, 0)
    app.moveSelection(-1, 0) // try to go left at boundary
    expect(app.selection.get()).toEqual({ col: 0, row: 0 })

    app.moveSelection(0, -1) // try to go up at boundary
    expect(app.selection.get()).toEqual({ col: 0, row: 0 })
  })

  it('clears cell when entering empty value', async () => {
    app.selectCell(0, 0)
    app.startEditing()
    app.updateEditValue('100')
    app.commitEdit()
    await flush()

    expect(app.getCellValue(0, 0)).toBe('100')

    app.startEditing()
    app.updateEditValue('')
    app.commitEdit()
    await flush()

    expect(app.getCellValue(0, 0)).toBe('')
  })

  it('renders correct HTML structure when cell is selected', async () => {
    app.selectCell(0, 0)
    await flush()

    // Check formula bar structure
    const formulaBar = container.querySelector('.formula-bar')
    expect(formulaBar).not.toBeNull()
    expect(formulaBar?.querySelector('.cell-address')?.textContent).toBe('A1')
    expect(formulaBar?.querySelector('.formula-input')).not.toBeNull()

    // Check that exactly one cell is selected
    const selectedCells = container.querySelectorAll('.data-cell.selected')
    expect(selectedCells.length).toBe(1)

    // Check selected cell structure
    const selectedCell = selectedCells[0]
    expect(selectedCell.classList.contains('grid-cell')).toBe(true)
    expect(selectedCell.classList.contains('data-cell')).toBe(true)
    expect(selectedCell.classList.contains('selected')).toBe(true)
    expect(selectedCell.querySelector('.cell-content')).not.toBeNull()
  })

  it('renders correct HTML structure for cell with value', async () => {
    // Enter a value
    app.selectCell(0, 0)
    app.startEditing()
    app.updateEditValue('42')
    app.commitEdit()
    await flush()

    // Verify data is stored correctly
    expect(app.getCellValue(0, 0)).toBe('42')

    // Select the cell (not editing)
    app.selectCell(0, 0)
    await flush()

    // There should be exactly 1 selected cell
    const allSelectedCells = container.querySelectorAll('.data-cell.selected')
    expect(allSelectedCells.length).toBe(1)

    // Verify the selected cell has the correct content
    const selectedCell = allSelectedCells[0]
    const cellContent = selectedCell?.querySelector('.cell-content')
    expect(cellContent?.textContent).toBe('42')
    expect(cellContent?.classList.contains('number')).toBe(true)

    // Verify total cell count is correct (no accumulation)
    const totalDataCells = container.querySelectorAll('.data-cell').length
    expect(totalDataCells).toBe(150) // 10 cols x 15 rows
  })

  it('renders correct HTML structure when editing', async () => {
    app.selectCell(0, 0)
    app.startEditing()
    app.updateEditValue('test')
    await flush()

    const editingCell = container.querySelector('.data-cell.selected.editing')
    expect(editingCell).not.toBeNull()

    const input = editingCell?.querySelector('.cell-input')
    expect(input).not.toBeNull()
    expect((input as HTMLInputElement)?.value).toBe('test')
  })

  it('renders correct grid structure with rows and columns', async () => {
    await flush()

    // Check grid wrapper
    const gridWrapper = container.querySelector('.grid-wrapper')
    expect(gridWrapper).not.toBeNull()

    // Check grid
    const grid = container.querySelector('.grid')
    expect(grid).not.toBeNull()

    // Check header row (corner + 10 columns)
    const headerCells = container.querySelectorAll('.header-cell')
    expect(headerCells.length).toBe(11)

    // Check column headers (A-J)
    const columnHeaders = Array.from(headerCells).slice(1) // skip corner
    expect(columnHeaders[0].textContent).toBe('A')
    expect(columnHeaders[9].textContent).toBe('J')

    // Check row headers (15 data rows)
    const rowHeaders = container.querySelectorAll('.row-header')
    expect(rowHeaders.length).toBe(15)

    // Check data cells exist
    const dataCells = container.querySelectorAll('.data-cell')
    expect(dataCells.length).toBe(150) // 10 cols x 15 rows
  })

  it('renders summary row with column sums', async () => {
    // Add some values
    app.selectCell(0, 0)
    app.startEditing()
    app.updateEditValue('10')
    app.commitEdit()

    app.selectCell(0, 1)
    app.startEditing()
    app.updateEditValue('20')
    app.commitEdit()
    await flush()

    // Check summary row
    const summaryRow = container.querySelector('.summary-row')
    expect(summaryRow).not.toBeNull()

    const sumHeader = summaryRow?.querySelector('.row-header')
    expect(sumHeader?.textContent).toBe('SUM')

    // Check first column sum (10 + 20 = 30)
    const sumCells = summaryRow?.querySelectorAll('.cell-content')
    expect(sumCells?.[0]?.textContent).toBe('30')
  })
})
