export enum Delta {
  Insert = 1,
  Retract = -1
}

export type Change<T> = [T, Delta]
