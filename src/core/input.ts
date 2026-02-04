import { Collection } from './collection'
import { Delta } from './delta'
import { scheduleEmit } from './tx'

export class Input<T> extends Collection<T> {
  private values: Set<T> = new Set()

  constructor(initial?: T) {
    super(initial !== undefined ? [initial] : [])
    if (initial !== undefined) {
      this.values.add(initial)
    }
  }

  insert(value: T): void {
    this.values.add(value)
    this.data = [...this.values]
    this.emit(value, Delta.Insert)
  }

  retract(value: T): void {
    this.values.delete(value)
    this.data = [...this.values]
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

  /** Get current value (first item in collection) */
  get(): T | undefined {
    return [...this.values][0]
  }

  /** Get all current values */
  getAll(): T[] {
    return [...this.values]
  }

  /** Find an item matching a predicate */
  find(predicate: (item: T) => boolean): T | undefined {
    for (const v of this.values) {
      if (predicate(v)) return v
    }
    return undefined
  }

  /** Replace an item (retract old, insert new) */
  replace(oldValue: T, newValue: T): void {
    this.retract(oldValue)
    this.insert(newValue)
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
