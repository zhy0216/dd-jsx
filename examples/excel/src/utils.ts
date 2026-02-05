/**
 * Convert a 0-based column index to a letter (0 -> A, 25 -> Z, 26 -> AA)
 */
export function indexToColumnLetter(index: number): string {
  let result = ''
  let n = index
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result
    n = Math.floor(n / 26) - 1
  }
  return result
}

/**
 * Convert a column letter to a 0-based index (A -> 0, Z -> 25, AA -> 26)
 */
export function columnLetterToIndex(letter: string): number {
  let result = 0
  for (let i = 0; i < letter.length; i++) {
    result = result * 26 + (letter.charCodeAt(i) - 64)
  }
  return result - 1
}

/**
 * Format a cell address from column and row (0-based)
 */
export function formatCellAddress(col: number, row: number): string {
  return `${indexToColumnLetter(col)}${row + 1}`
}

/**
 * Parse a cell address into column and row (0-based)
 */
export function parseCellAddress(address: string): { col: number; row: number } | null {
  const match = address.match(/^([A-Z]+)(\d+)$/i)
  if (!match) return null
  return {
    col: columnLetterToIndex(match[1].toUpperCase()),
    row: parseInt(match[2], 10) - 1
  }
}

/**
 * Create a unique cell key from column and row
 */
export function cellKey(col: number, row: number): string {
  return `${col}:${row}`
}

/**
 * Parse a cell key back to column and row
 */
export function parseKey(key: string): { col: number; row: number } {
  const [col, row] = key.split(':').map(Number)
  return { col, row }
}
