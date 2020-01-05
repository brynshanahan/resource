import Operations, {
  SpecificOperation,
  NoopOperation,
  ReplaceOperation,
} from './operations'
import Path, { PathString } from './paths'
import produce from 'immer'

type Transformer = (
  operation: SpecificOperation,
  serverOperations: SpecificOperation
) => SpecificOperation

class Transforms {
  /* 
  The path that comes with the CustomOperation still need to be transformed the same 
  way as all other operations, but after that custom operators can register custom transforms for their
  custom operations
  */
  private custom_transformers: {
    [pathString: string]: Transformer
  } = {}

  /* For all other operations */
  private transformers: {
    [k: string]: Transformer
  } = {}

  constructor() {
    this.defaultTransform = this.defaultTransform.bind(this)
  }
  /* Custom operators transforming */
  setCustomTransformer(path: PathString, handler: Transformer) {
    this.custom_transformers[path] = handler
  }
  removeCustomTransformer(path: PathString) {
    delete this.custom_transformers[path]
  }
  getCustomTransformer(path: PathString) {
    return this.custom_transformers[path]
  }

  /* Normy transform handlers */
  setTransformer(path: PathString, handler: Transformer) {
    this.transformers[path] = handler
  }
  removeTransformer(path: PathString) {
    delete this.transformers[path]
  }
  getTransformerForOperation(operation: SpecificOperation) {
    if (
      !Operations.isNoopOperation(operation) &&
      this.transformers[operation.path]
    ) {
      return this.transformers[operation.path]
    }

    /* Otherwise it uses the default operation handler */
    return this.defaultTransform
  }
  transform(operation: SpecificOperation, remoteOp: SpecificOperation) {
    const transformer = this.getTransformerForOperation(remoteOp)
    return transformer(operation, remoteOp)
  }
  defaultTransform(
    operation: SpecificOperation,
    remoteOp: SpecificOperation
  ): SpecificOperation {
    /* You can't re-enable a noop operation */
    if (Operations.isNoopOperation(operation)) return operation

    switch (remoteOp.type) {
      /* If there is an added array item shift the rest forward */
      case 'add':
        return produce(operation, draft => {
          draft.path = Path.transformPath(draft.path, remoteOp.path)
        })
      case 'remove': {
        if (
          Operations.isReplaceOperation(operation) ||
          Operations.isCustomOperation(operation)
        ) {
          return {
            ...operation,
            type: 'noop',
          }
        }
        return operation
      }
      case 'replace': {
        /* Case doesn't transform operations */
        return operation
      }
      default: {
        return operation
      }
    }
  }
}

export default new Transforms()
