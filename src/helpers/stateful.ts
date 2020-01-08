import Subject from './subject'

export const allChanges = 'all_changes' + Math.random().toFixed(4)

interface Dict {
  [k: string]: any
}

type Key = string

export default class Stateful<S extends {} = Dict> extends Subject {
  state: S
  initialState: S
  isFirstChange: boolean
  hasChanged: Key[]

  constructor(initialState: S = {} as S) {
    super()

    this.state = clone(initialState || ({} as S))
    this.initialState = initialState
    this.isFirstChange = true
    this.hasChanged = []

    this.setState = this.setState.bind(this)
    this.changed = this.changed.bind(this)
    this.listen = this.listen.bind(this)
  }

  setState(stateOrFn) {
    // You can pass a function that returns state or a plain object
    const prevState = clone(this.state)
    const recievedState = typeof stateOrFn === 'function' ? stateOrFn(this.state) : stateOrFn

    // Only get keys which have changed
    const changedKeys = Object.keys(recievedState).filter(key => recievedState[key] !== prevState[key])

    if (!changedKeys.length) return

    // Merge this.state with the recievedState
    const currentState = clone(this.state, recievedState)
    this.state = currentState

    const update = {
      prevState,
      currentState,
      recievedState,
      state: currentState,
      self: this,
      currentChanges: changedKeys,
      changed: changedKeys,
      isFirstChange: this.isFirstChange
    }

    // This emits changes for listeners that are listening without a key
    // eg this.changed(() => { ...something changed }) || this.changed('myKey', () => { ...mykey changed })
    this.emit(allChanges, update)

    // Emit events for all the keys in changedKeys
    for (const key of changedKeys) {
      const changeForKey = clone(update, { isFirstChange: !this.hasChanged.includes(key) })
      this.emit(key, changeForKey)
    }

    // No longer the first change
    if (changedKeys.length && this.isFirstChange) {
      this.isFirstChange = false
    }

    // Add changed keys to hasChanged
    this.hasChanged = [...this.hasChanged, ...changedKeys.filter(x => !this.hasChanged.includes(x))]
  }

  changed(...args) {
    // On is inherited from Subject
    if (args.length === 2) {
      return this.on(args[0], args[1])
    } else {
      return this.on(allChanges, args[0])
    }
  }

  // Alias for this.changed(() => {})
  listen(fn) {
    return this.on(allChanges, fn)
  }
}

function clone<T>(objs: T, ...rest: T[]) {
  return Object.assign({}, objs, ...rest) as T
}
