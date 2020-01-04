import { Operation } from './operations';
import Path, { PathString } from './paths';
import produce from 'immer';

type TransformHandler = (
  operation: Operation,
  serverOperations: Operation
) => Operation;

class Transforms {
  transforms: {
    [k: string]: TransformHandler;
  } = {};
  constructor() {
    this.defaultTransform = this.defaultTransform.bind(this);
  }
  setTransformHandler(path: PathString, handler: TransformHandler) {
    this.transforms[path] = handler;
  }
  removeTransformHandler(path: PathString) {
    delete this.transforms[path];
  }
  transformerForOperation(operation: Operation) {
    /* 
    Elements can register custom operation handlers
    */
    if (operation.type === 'custom') {
      return this.transforms[operation.path];
    }

    /* Otherwise it uses the default operation handler */
    return this.defaultTransform;
  }
  transform(operation: Operation, remoteOp: Operation) {
    const transformer = this.transformerForOperation(operation);
    return transformer(operation, remoteOp);
  }
  defaultTransform(operation: Operation, remoteOp: Operation): Operation {
    switch (remoteOp.type) {
      /* If there is an added array item shift the rest forward */
      case 'add':
        return produce(operation, draft => {
          draft.path = Path.transformPath(draft.path, remoteOp.path);
        });
      case 'remove': {
        if ()
      }
      default: {
        return operation;
      }
    }
  }
}

export default new Transforms();
