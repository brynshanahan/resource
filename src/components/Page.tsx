import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useState,
} from 'react'
import produce from 'immer'

const DEBUGGING = false

export const RootContentStore = createContext({})
export const ContentStore = createContext({})
export const ScopeStore = createContext('')
export const UpdaterStore = createContext(updater => {})

/*
Firebase doesn't support "." in path object keys so the separater used 
is configurable
*/
export const SepContext = createContext('.')
export const RootUpdaterStore = createContext(updater => {})

export function useSep() {
  return useContext(SepContext)
}

export function useSubscribeToPageStore(url: string) {
  const [page, setPage] = useState(pageCache.get(url))
  useEffect(() => pageCache.subscribe(url, setPage), [url])
  return page
}

export function useFieldName(innerField: string) {
  const sep = useSep()
  const parentFieldName = useParentScope()
  if (parentFieldName) {
    return parentFieldName + sep + innerField
  } else {
    return innerField
  }
}

export function useParentScope() {
  return useContext(ScopeStore)
}

export function usePageResource(url) {
  const [resource, setResource] = React.useState(pageCache.get(url))

  useEffect(() => {
    const tm = setTimeout(() => {
      pageCache.set(url, resource)
    }, 50)
    return () => clearTimeout(tm)
  }, [url, resource])

  const updatePage = useCallback(
    valueCreator => {
      setResource(previousState => {
        const newState = produce(
          previousState || {},
          draft => {
            valueCreator(draft)

            if (!DEBUGGING) {
              /* Create the meta value in case it doesnt exist */
              if (!draft.meta) {
                draft.meta = {}
              }
              /* Increment the edits property */
              draft.meta.edit = draft.meta.edit ? draft.meta.edit + 1 : 1
              /* Set the lastEdit date to now */
              draft.meta.lastEdit = Date.now()
              /* TODO: Change to use actual current user */
              draft.meta.lastEdittedBy = 'as12dk'
            }
          },
          DEBUGGING ? patches => console.log(...patches) : undefined
        )

        return newState
      })
    },
    [setResource]
  )

  return [resource, updatePage]
}

export function useUpdater() {
  return useContext(UpdaterStore)
}

export function useRootUpdater() {
  return useContext(RootUpdaterStore)
}

/* A function that returns the value and a setter. Similar api to useState */
export function useField(field, defaultValue?) {
  const value = useContentValue(field)
  const updater = useUpdater()
  const callback = useCallback(
    valueOrCreator => {
      updater(state => {
        if (typeof valueOrCreator === 'function') {
          /* Fields believe they have the defaultValue. So before we let them
          edit we have to make sure the defaultValue is in state*/
          if (!state[field]) {
            state[field] = defaultValue
          }

          /* If value returns it will replace the value. Otherwise we assume
          it has been mutated */
          const returnedValue = valueOrCreator(state[field])

          if (returnedValue !== undefined) {
            state[field] = returnedValue
          }
        } else {
          state[field] = valueOrCreator
        }
      })
    },
    [field, updater, defaultValue]
  )
  return [value === undefined ? defaultValue : value, callback]
}

/* Gets the value from the closest block */
export function useContentValue(scope: string) {
  const content = useContext(ContentStore)
  return content && content[scope]
}

export function useRootContentValue(scope: string) {
  const content = useContext(RootContentStore)
  return content && content[scope]
}

export function withRootContentValue(component) {
  const MemoizedComponent = React.memo(component)
  return function ContentValuePicker(props) {
    const innerScope = useFieldName(props.scope)
    const content = useRootContentValue(innerScope)
    return <MemoizedComponent {...props} value={content} />
  }
}

export function withContentValue(component) {
  const MemoizedComponent = React.memo(component)
  return function ContentValuePicker(props) {
    const content = useContentValue(props.scope)
    return <MemoizedComponent {...props} value={content} />
  }
}

export const Page = ({ children, path }) => {
  const [value, setValue] = usePageResource(path)
  return (
    <RootUpdaterStore.Provider value={setValue}>
      <UpdaterStore.Provider value={setValue}>
        <RootContentStore.Provider value={value}>
          <ContentStore.Provider value={value}>
            {children}
          </ContentStore.Provider>
        </RootContentStore.Provider>
      </UpdaterStore.Provider>
    </RootUpdaterStore.Provider>
  )
}
