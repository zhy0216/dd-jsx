import { Collection } from './collection'
import { Delta } from './delta'
import { scheduleEmit } from './tx'

type Subscriber<T> = (item: T, delta: Delta) => void

export class Input<T> extends Collection<T> {
  private values: Set<T> = new Set()

  constructor(initial?: T) {
    super()
    if (initial !== undefined) {
      this.values.add(initial)
      ;(this as any).data = [initial]
    }
  }

  insert(value: T): void {
    this.values.add(value)
    this.emit(value, Delta.Insert)
  }

  retract(value: T): void {
    this.values.delete(value)
    this.emit(value, Delta.Retract)
  }

  set(value: T): void {
    // Retract all current values
    for (const v of this.values) {
      this.retract(v)
    }
    // Insert new value
    this.insert(value)
  }

  update(fn: (current: T) => T): void {
    const current = [...this.values][0]
    if (current !== undefined) {
      const newValue = fn(current)
      this.retract(current)
      this.insert(newValue)
    }
  }

  protected emit(item: T, delta: Delta): void {
    scheduleEmit(() => {
      for (const fn of this.subscribers) {
        fn(item, delta)
      }
    })
  }
}

export function input<T>(initial?: T): Input<T> {
  return new Input(initial)
}
