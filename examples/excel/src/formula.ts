import { parseCellAddress, cellKey } from './utils'

/**
 * Check if a value is a formula (starts with =)
 */
export function isFormula(value: string): boolean {
  return value.trim().startsWith('=')
}

/**
 * Parse a range like "A1:B5" into an array of cell addresses
 */
function parseRange(range: string): string[] {
  const parts = range.split(':')
  if (parts.length !== 2) return []

  const start = parseCellAddress(parts[0])
  const end = parseCellAddress(parts[1])
  if (!start || !end) return []

  const addresses: string[] = []
  for (let col = start.col; col <= end.col; col++) {
    for (let row = start.row; row <= end.row; row++) {
      addresses.push(cellKey(col, row))
    }
  }
  return addresses
}

/**
 * Extract all cell dependencies from a formula
 */
export function parseFormulaDependencies(formula: string): string[] {
  if (!isFormula(formula)) return []

  const expr = formula.slice(1).toUpperCase()
  const deps: string[] = []

  // Match ranges like A1:B5
  const rangeMatches = expr.matchAll(/([A-Z]+\d+):([A-Z]+\d+)/g)
  for (const match of rangeMatches) {
    deps.push(...parseRange(match[0]))
  }

  // Match single cell references like A1 (not already in ranges)
  const singleMatches = expr.matchAll(/(?<!:)([A-Z]+)(\d+)(?!:)/g)
  for (const match of singleMatches) {
    const addr = parseCellAddress(match[0])
    if (addr) {
      const key = cellKey(addr.col, addr.row)
      if (!deps.includes(key)) {
        deps.push(key)
      }
    }
  }

  return deps
}

/**
 * Evaluate a formula and return the computed value
 */
export function evaluateFormula(
  formula: string,
  getCellValue: (col: number, row: number) => string
): string {
  if (!isFormula(formula)) return formula

  let expr = formula.slice(1).toUpperCase().trim()

  // Handle SUM function
  const sumMatch = expr.match(/^SUM\(([A-Z]+\d+):([A-Z]+\d+)\)$/i)
  if (sumMatch) {
    const range = parseRange(`${sumMatch[1]}:${sumMatch[2]}`)
    let sum = 0
    for (const key of range) {
      const [col, row] = key.split(':').map(Number)
      const val = getCellValue(col, row)
      const num = parseFloat(val)
      if (!isNaN(num)) {
        sum += num
      }
    }
    return String(sum)
  }

  // Handle AVERAGE function
  const avgMatch = expr.match(/^AVERAGE\(([A-Z]+\d+):([A-Z]+\d+)\)$/i)
  if (avgMatch) {
    const range = parseRange(`${avgMatch[1]}:${avgMatch[2]}`)
    let sum = 0
    let count = 0
    for (const key of range) {
      const [col, row] = key.split(':').map(Number)
      const val = getCellValue(col, row)
      const num = parseFloat(val)
      if (!isNaN(num)) {
        sum += num
        count++
      }
    }
    return count > 0 ? String(sum / count) : '#DIV/0!'
  }

  // Replace cell references with their values for simple expressions
  expr = expr.replace(/([A-Z]+)(\d+)/g, (_, colLetter, rowNum) => {
    const addr = parseCellAddress(`${colLetter}${rowNum}`)
    if (!addr) return '0'
    const val = getCellValue(addr.col, addr.row)
    const num = parseFloat(val)
    return isNaN(num) ? '0' : String(num)
  })

  // Evaluate the expression safely
  try {
    // Only allow numbers, operators, and parentheses
    if (!/^[\d\s+\-*/().]+$/.test(expr)) {
      return '#ERROR'
    }
    // eslint-disable-next-line no-new-func
    const result = new Function(`return ${expr}`)()
    if (typeof result === 'number') {
      if (!isFinite(result)) return '#DIV/0!'
      // Round to avoid floating point issues
      return String(Math.round(result * 1000000) / 1000000)
    }
    return String(result)
  } catch {
    return '#ERROR'
  }
}
