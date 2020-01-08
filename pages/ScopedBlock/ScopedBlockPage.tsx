import React from 'react'
import { Print } from '../../src/components/Print'
import {
  Page,
  useField,
  useSubscribeToPageStore,
} from '../../src/components/Page'
import { ScopedInput } from '../../src/components/ScopedInput'
import { defineBlock } from '../../src/components/define-block'
import Canvas from '../../src/components/Canvas'

const NumberField = () => {
  const [number, setNumber] = useField('number', 0)
  return (
    <div>
      <span>{number}</span>
      <button onClick={() => setNumber(number + 1)}>+</button>
    </div>
  )
}

const PageContent = defineBlock({ name: 'document', scope: 'self' })(
  ({ children }) => {
    return <>{children}</>
  }
)

const DebugPage = ({ path }) => {
  const value = useSubscribeToPageStore(path)
  return <Print value={value} />
}

export const ScopedBlockPage = () => {
  return (
    <Page path={window.location.href}>
      <PageContent field="root">
        <div>
          Scoped block don't bubble up changes. Each block will save it's value
          to the root
        </div>
        <DebugPage path={window.location.href} />
        <div>
          <NumberField />
          <Canvas field="drawing" />
          <ScopedInput field="title" />
        </div>
      </PageContent>
    </Page>
  )
}
