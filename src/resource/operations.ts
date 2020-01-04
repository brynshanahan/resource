import Paths, { PathString } from './paths';
import { Patch } from 'immer';
/* 
Operations extend Immer's operations
*/

export interface RawOperation {
  type: 'replace' | 'add' | 'remove' | 'custom' | 'noop';
}

export interface Operation extends RawOperation {
  id: string;
  client: string;
  settled: boolean;
}

export interface WithPath {
  path: PathString;
}

export interface WithValue<V = any> {
  value: V;
}

export interface SettledOperation extends Operation {
  settled: true;
}

/* The "Immer" operations */
export interface ReplaceOperation<V = any> extends Operation {
  type: 'replace';
  path: PathString;
  value: V;
}
export interface AddOperation<V = any> extends Operation {
  type: 'add';
  path: PathString;
  value: V;
}
export interface RemoveOperation extends Operation {
  type: 'remove';
  path: PathString;
}

/* Operations can be turned to Noop operations if a remote deletes a parent before the client operation settles */
export interface NoopOperation extends Operation {
  type: 'noop';
}

/* The custom operations that can be piped into elements that accept them */
export interface CustomOperation<T> extends Operation {
  type: 'custom';
  operation: T;
}

export type SpecificOperation =
  | AddOperation
  | ReplaceOperation
  | RemoveOperation
  | NoopOperation;
export type PartialSpecificOperation = SpecificOperation & {
  id?: string;
  client?: string;
};

const Operations = {
  isCustomOperation<T>(operation: Operation): operation is CustomOperation<T> {
    return operation.type === 'custom';
  },
  isAddOperation(operation: Operation): operation is AddOperation {
    return operation.type === 'add';
  },
  isReplaceOperation(operation: Operation): operation is ReplaceOperation {
    return operation.type === 'replace';
  },
  isRemoveOperation(operation: Operation): operation is RemoveOperation {
    return operation.type === 'remove';
  },
  isNoopOperation(operation: Operation): operation is NoopOperation {
    return operation.type === 'noop';
  },
  areEqual(opA: Operation, opB: Operation) {
    return opA.id === opB.id;
  },
  isSettled(op: Operation | false): op is SettledOperation & SpecificOperation {
    if (!op) return false;
    return op.settled;
  },
  fromImmerPatch(patch: Patch): PartialSpecificOperation {
    switch (patch.op) {
      case 'add': {
        return {
          type: 'add',
          path: Paths.fromParts(patch.path),
          value: patch.value,
        } as Partial<AddOperation>;
      }
      case 'replace': {
        return {
          type: 'replace',
          path: Paths.fromParts(patch.path),
          value: patch.value,
        } as Partial<ReplaceOperation>;
      }
      case 'remove': {
        return {
          type: 'remove',
          path: Paths.fromParts(patch.path),
        } as Partial<RemoveOperation>;
      }
      default: {
        return {
          type: 'noop',
        } as Partial<NoopOperation>;
      }
    }
  },
  toImmerPatch(operation: Operation & WithValue): Patch | null {
    if (Operations.isReplaceOperation(operation)) {
      return {
        op: 'replace',
        path: Paths.toParts(operation.path),
        value: operation.value,
      };
    }
    if (Operations.isAddOperation(operation)) {
      return {
        op: 'add',
        value: operation.value,
        path: Paths.toParts(operation.path),
      };
    }
    if (Operations.isRemoveOperation(operation)) {
      return {
        op: 'remove',
        path: Paths.toParts(operation.path),
      };
    }

    /* Can't transform it to an immer patch */
    return null;
  },
};

export default Operations;