import Paths, { PathString } from './paths'

const Value = {
  set<T, V>(source: T, path: PathString, value: V) {
    const parts = Paths.toParts(path)
    let target = source
    while (parts.length > 1) {
      target = target[parts.shift()]
    }
    target[parts[0]] = value
    return value
  },
  get<T, V>(source: T, path: PathString): V {
    const parts = Paths.toParts(path)
    let target = source
    while (parts.length > 1) {
      target = target[parts.shift()]
    }
    return target[parts[0]]
  },
}

export default Value
