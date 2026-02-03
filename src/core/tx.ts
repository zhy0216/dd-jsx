let batching = false
const pendingEmits: Array<() => void> = []

export function isBatching(): boolean {
  return batching
}

export function tx(fn: () => void): void {
  batching = true
  try {
    fn()
  } finally {
    batching = false
    // Flush pending emits
    const toFlush = [...pendingEmits]
    pendingEmits.length = 0
    for (const emit of toFlush) {
      emit()
    }
  }
}

export function scheduleEmit(emit: () => void): void {
  if (batching) {
    pendingEmits.push(emit)
  } else {
    emit()
  }
}
