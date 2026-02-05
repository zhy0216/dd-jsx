import { input, Delta, Collection, VNode } from 'dd-jsx'
import { indexToColumnLetter, formatCellAddress, cellKey } from './utils'
import { isFormula, evaluateFormula } from './formula'

export type Cell = {
  col: number
  row: number
  rawValue: string
  computedValue: string
  isFormula: boolean
  error?: string
}

export type Selection = { col: number; row: number } | null

const NUM_COLS = 10
const NUM_ROWS = 15

export function createExcelApp() {
  // State
  const cells = input<Cell>()
  const selection = input<Selection>(null)
  const editValue = input('')
  const isEditing = input(false)

  // Performance metrics: track render counts per cell
  const renderCounts = new Map<string, number>()

  // Build a map for quick cell lookups - used for formula evaluation
  const cellMap = new Map<string, Cell>()

  // Subscribe to cell changes to maintain the map
  cells.subscribe((cell, delta) => {
    const key = cellKey(cell.col, cell.row)
    if (delta === Delta.Insert) {
      cellMap.set(key, cell)
    } else {
      cellMap.delete(key)
    }
  })

  // Helper to get cell value
  function getCellValue(col: number, row: number): string {
    const key = cellKey(col, row)
    const cell = cellMap.get(key)
    return cell?.computedValue ?? ''
  }

  // Compute cell with formula evaluation
  function computeCell(col: number, row: number, rawValue: string): Cell {
    const formula = isFormula(rawValue)
    let computedValue = rawValue
    let error: string | undefined

    if (formula) {
      computedValue = evaluateFormula(rawValue, getCellValue)
      if (computedValue.startsWith('#')) {
        error = computedValue
      }
    }

    return { col, row, rawValue, computedValue, isFormula: formula, error }
  }

  // Recompute all cells (for formula dependencies)
  function recomputeAll() {
    const allCells = cells.getAll()
    for (const cell of allCells) {
      if (cell.isFormula) {
        const newCell = computeCell(cell.col, cell.row, cell.rawValue)
        if (newCell.computedValue !== cell.computedValue) {
          cells.replace(cell, newCell)
        }
      }
    }
  }

  // Column sums via reduce
  const columnSums = cells.reduce(
    {} as Record<number, number>,
    (sums, cell, delta) => {
      const mult = delta === Delta.Insert ? 1 : -1
      const num = parseFloat(cell.computedValue)
      if (!isNaN(num)) {
        const newSums = { ...sums }
        newSums[cell.col] = (newSums[cell.col] ?? 0) + num * mult
        return newSums
      }
      return sums
    }
  )

  // Actions
  function selectCell(col: number, row: number) {
    if (isEditing.get()) {
      commitEdit()
    }
    selection.set({ col, row })
    const key = cellKey(col, row)
    const cell = cellMap.get(key)
    editValue.set(cell?.rawValue ?? '')
  }

  function startEditing(initialValue?: string) {
    const sel = selection.get()
    if (!sel) return
    isEditing.set(true)
    if (initialValue !== undefined) {
      editValue.set(initialValue)
    }
  }

  function updateEditValue(value: string) {
    editValue.set(value)
  }

  function commitEdit() {
    const sel = selection.get()
    if (!sel) return

    const value = editValue.get() ?? ''
    const key = cellKey(sel.col, sel.row)
    const existingCell = cellMap.get(key)

    if (value.trim() === '') {
      // Remove cell if empty
      if (existingCell) {
        cells.retract(existingCell)
      }
    } else {
      const newCell = computeCell(sel.col, sel.row, value)
      if (existingCell) {
        cells.replace(existingCell, newCell)
      } else {
        cells.insert(newCell)
      }
    }

    isEditing.set(false)
    // Recompute formulas that might depend on this cell
    recomputeAll()
  }

  function cancelEdit() {
    const sel = selection.get()
    if (!sel) return
    const key = cellKey(sel.col, sel.row)
    const cell = cellMap.get(key)
    editValue.set(cell?.rawValue ?? '')
    isEditing.set(false)
  }

  function moveSelection(dCol: number, dRow: number) {
    const sel = selection.get()
    if (!sel) {
      selection.set({ col: 0, row: 0 })
      return
    }
    const newCol = Math.max(0, Math.min(NUM_COLS - 1, sel.col + dCol))
    const newRow = Math.max(0, Math.min(NUM_ROWS - 1, sel.row + dRow))
    selectCell(newCol, newRow)
  }

  // Components
  function FormulaBar() {
    const bar = selection.flatMap(sel => {
      const address = sel ? formatCellAddress(sel.col, sel.row) : ''
      return (
        <div class="formula-bar" key="formula-bar">
          <span class="cell-address">{address || '-'}</span>
          {editValue.flatMap(val => (
            <input
              key="formula-input"
              class="formula-input"
              type="text"
              value={val}
              onInput={(e: Event) => updateEditValue((e.target as HTMLInputElement).value)}
              onFocus={() => {
                if (sel) startEditing()
              }}
              onKeydown={(e: KeyboardEvent) => {
                if (e.key === 'Enter') {
                  commitEdit()
                  ;(e.target as HTMLInputElement).blur()
                } else if (e.key === 'Escape') {
                  cancelEdit()
                  ;(e.target as HTMLInputElement).blur()
                }
              }}
            />
          ))}
        </div>
      )
    })
    return bar
  }

  function GridCell(col: number, row: number) {
    const key = cellKey(col, row)

    // Derive this cell's specific selection and editing state
    // Use distinct() so we only re-render when THIS cell's state changes
    const cellState = selection.withLatest(isEditing)
      .map(([sel, editing]) => ({
        isSelected: sel?.col === col && sel?.row === row,
        isEditing: sel?.col === col && sel?.row === row && editing
      }))
      .distinct()

    // Cell data changes trigger re-render via cellData filter
    const cellData = cells.filter(c => c.col === col && c.row === row)

    // Re-render when either selection state changes OR cell data changes
    // Use withLatest to combine cellState with a data version counter
    // The counter increments on any cell data change, causing re-render
    const cellDataVersion = input(0)
    cellData.subscribe((_, delta) => {
      if (delta === Delta.Insert) {
        cellDataVersion.set(cellDataVersion.get()! + 1)
      }
    })
    const trigger = cellState.withLatest(cellDataVersion)

    return trigger.flatMap(() => {
      // Read current state imperatively
      const sel = selection.get()
      const editing = isEditing.get()
      const state = {
        isSelected: sel?.col === col && sel?.row === row,
        isEditing: sel?.col === col && sel?.row === row && editing
      }
      const cell = cellMap.get(key)

      // Track render count for this cell
      const count = (renderCounts.get(key) ?? 0) + 1
      renderCounts.set(key, count)

      if (state.isEditing) {
        return editValue.flatMap(val => (
          <div
            class="grid-cell data-cell selected editing"
            key={`cell-${col}-${row}`}
            data-render-count={count}
          >
            {count > 1 && <span class={`render-badge ${count > 5 ? 'high' : ''}`} key={`badge-${col}-${row}`}>{count}</span>}
            <input
              key={`input-${col}-${row}`}
              class="cell-input"
              type="text"
              value={val}
              autoFocus
              onInput={(e: Event) => updateEditValue((e.target as HTMLInputElement).value)}
              onBlur={() => commitEdit()}
              onKeydown={(e: KeyboardEvent) => {
                if (e.key === 'Enter') {
                  commitEdit()
                  moveSelection(0, 1)
                } else if (e.key === 'Tab') {
                  e.preventDefault()
                  commitEdit()
                  moveSelection(e.shiftKey ? -1 : 1, 0)
                } else if (e.key === 'Escape') {
                  cancelEdit()
                }
              }}
            />
          </div>
        ))
      }

      const displayValue = cell?.computedValue ?? ''
      const isNumber = !isNaN(parseFloat(displayValue)) && displayValue !== ''
      const isError = cell?.error !== undefined

      return (
        <div
          class={`grid-cell data-cell ${state.isSelected ? 'selected' : ''}`}
          key={`cell-${col}-${row}`}
          data-render-count={count}
          onClick={() => selectCell(col, row)}
          onDblClick={() => startEditing()}
          onKeydown={(e: KeyboardEvent) => {
            if (state.isSelected && !state.isEditing) {
              if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
                startEditing(e.key)
              } else if (e.key === 'Enter') {
                startEditing()
              } else if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault()
                editValue.set('')
                commitEdit()
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                moveSelection(0, -1)
              } else if (e.key === 'ArrowDown') {
                e.preventDefault()
                moveSelection(0, 1)
              } else if (e.key === 'ArrowLeft') {
                e.preventDefault()
                moveSelection(-1, 0)
              } else if (e.key === 'ArrowRight') {
                e.preventDefault()
                moveSelection(1, 0)
              } else if (e.key === 'Tab') {
                e.preventDefault()
                moveSelection(e.shiftKey ? -1 : 1, 0)
              }
            }
          }}
          tabIndex={state.isSelected ? 0 : -1}
        >
          {count > 1 && <span class={`render-badge ${count > 5 ? 'high' : ''}`} key={`badge-${col}-${row}`}>{count}</span>}
          <div class={`cell-content ${isNumber ? 'number' : ''} ${isError ? 'error' : ''}`}>
            {displayValue}
          </div>
        </div>
      )
    })
  }

  function HeaderRow() {
    const headers = []
    for (let col = 0; col < NUM_COLS; col++) {
      headers.push(
        <div class="grid-cell header-cell" key={`header-${col}`}>
          {indexToColumnLetter(col)}
        </div>
      )
    }
    return (
      <div class="grid-row" key="header-row">
        <div class="grid-cell header-cell corner-cell" key="corner"></div>
        {headers}
      </div>
    )
  }

  function DataRow(row: number): Collection<VNode> {
    const cellElements: Collection<VNode>[] = []
    for (let col = 0; col < NUM_COLS; col++) {
      cellElements.push(GridCell(col, row))
    }
    return (
      <div class="grid-row" key={`row-${row}`}>
        <div class="grid-cell row-header" key={`row-header-${row}`}>
          {row + 1}
        </div>
        {Collection.concat(...cellElements)}
      </div>
    )
  }

  function SummaryRow() {
    return columnSums.flatMap(sums => {
      const sumCells = []
      for (let col = 0; col < NUM_COLS; col++) {
        const sum = sums[col]
        const display = sum !== undefined && sum !== 0 ? String(Math.round(sum * 100) / 100) : ''
        sumCells.push(
          <div class="grid-cell" key={`sum-${col}`}>
            <div class="cell-content number">{display}</div>
          </div>
        )
      }
      return (
        <div class="grid-row summary-row" key="summary-row">
          <div class="grid-cell row-header" key="sum-header">SUM</div>
          {sumCells}
        </div>
      )
    })
  }

  function Grid() {
    const rows: Collection<VNode>[] = []
    for (let row = 0; row < NUM_ROWS; row++) {
      rows.push(DataRow(row))
    }
    return (
      <div class="grid-wrapper" key="grid-wrapper">
        <div
          class="grid"
          key="grid"
          style={`grid-template-columns: 40px repeat(${NUM_COLS}, 80px)`}
        >
          <HeaderRow />
          {Collection.concat(...rows)}
          <SummaryRow />
        </div>
      </div>
    )
  }

  function App() {
    return (
      <div class="excel-container" key="excel-container">
        <div class="excel-header" key="excel-header">
          <h1>DD-JSX Excel</h1>
        </div>
        <FormulaBar />
        <Grid />
      </div>
    )
  }

  return {
    cells,
    selection,
    editValue,
    isEditing,
    selectCell,
    startEditing,
    updateEditValue,
    commitEdit,
    cancelEdit,
    moveSelection,
    getCellValue,
    renderCounts,
    resetRenderCounts: () => renderCounts.clear(),
    App
  }
}
