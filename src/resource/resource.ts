import firebase from 'firebase'
import Operations, {
  Operation,
  NoopOperation,
  SpecificOperation,
  PartialSpecificOperation,
  CustomOperation,
  RawOperation,
  RawCustomOperation,
} from './operations'
import Queue from './queue'
import Transforms from './transforms'
import AsyncOverwriteMap from './async-map'
import produce, { applyPatches } from 'immer'
import { PathString } from './paths'
import Value from './value'
import Subject from '../subject'
import uuid from 'uuid'

type FireRef = import('firebase').database.Reference
type DataSnapshot = import('firebase').database.DataSnapshot

export function msg(strings: any, ...values: any): string {
  // Interweave the strings with the
  // substitution vars first.
  let output = ''
  for (let i = 0; i < values.length; i++) {
    output += strings[i] + values[i]
  }
  output += strings[values.length]

  // Split on newlines.
  let lines = output.split(/(?:\r\n|\n|\r)/)

  // Rip out the leading whitespace.
  return lines
    .map(line => {
      return line.replace(/^\s+/gm, '')
    })
    .join(' ')
    .trim()
}

/* Client is the same across the whole computer */
const CLIENT: string =
  localStorage['resource__clientID'] ||
  (localStorage['resouce__clientID'] = uuid())

interface CustomerOperatorOpts<V> {
  path: PathString
  version: string

  /* 
  A function that describes state at the current snapshot, not required to be serializable
  */
  snapshot: () => {
    [key: string]: any
  }

  /* 
  A function that gets called when a new operation comes in
  */
  onOperation: <T>(operation: CustomOperation<T>) => any

  /* 
  A function that get's called when another client edits the same custom operator before the current operation getes sent
  */
  transformer: <T>(
    operation: CustomOperation<T>,
    beforeOperation: CustomOperation<any>
  ) => CustomOperation<any>

  /* Add a function for backwards and forwards compatability */
  mapVersion: (arg: { value: V; version: string }) => V
}

interface ProposeOperationOptions {
  apply?: boolean
  operations: PartialSpecificOperation[]
}

const ResourceCache = {
  get<T = any>(key: string): Resource<T> {
    return this[key]
  },
  set<T = any>(key: string, resource: Resource<T>) {
    this[key] = resource
  },
  delete(key: string) {
    delete this[key]
  },
  has(key: string) {
    return !!this.get(key)
  },
}

class Resource<T> extends Subject<'change_client' | 'change_server'> {
  client: string
  user: string
  identifier: string

  /* Only used in testing */
  latency: number

  disconnector?: () => any

  /* 
  Multiple users can listen to this object
  */
  key = 0
  getKey() {
    return `k${this.key++}`
  }
  connections: string[] = []

  events = new Subject<'op_added' | 'op_changed' | 'op_removed' | 'op_moved'>()

  refs: {
    root: FireRef
    current: FireRef
    operations: FireRef
  }

  value: {
    client: T
    source: T
  }

  operations: {
    /* recieved ops are operations that happened before the first pendingClient operation */
    pending: Queue<SpecificOperation>
    recieved: Queue<SpecificOperation>
    beforeNextOp: Queue<SpecificOperation>
    recievedChanges: AsyncOverwriteMap<string, SpecificOperation>
  } = {
    pending: new Queue(),
    recieved: new Queue(),
    beforeNextOp: new Queue(),
    recievedChanges: new AsyncOverwriteMap(),
  }

  operators: {
    [key: string]: CustomerOperatorOpts<any>
  }

  registerCustomOperator<Value, CustomOperationType>(
    customOperator: CustomerOperatorOpts<Value>
  ) {
    const path = customOperator.path
    if (this.operators[path] !== customOperator) {
      /* Consider yourself registered */
      this.operators[path] = customOperator
    }

    const api = {
      propose: (customOperation: CustomOperationType, state: any) => {
        const operation: RawCustomOperation<CustomOperationType> = {
          type: 'custom',
          operation: customOperation,
          path,
        }

        if (state) {
          /* Assuming the customOperations will result in the state sent */
          this.update(draft => {
            Value.set(draft, path, state)
          }, false)
        }

        /* Feels so sad wrapping in an array just to make the api happy */
        this.proposeOperations({ operations: [operation], apply: !state })
      },
    }

    return api
  }

  constructor(identifier: string, user: string, client: string = CLIENT) {
    super()
    if (ResourceCache.has(identifier)) {
      return ResourceCache.get(identifier)
    }
    // @ts-ignore
    this.refs = {}
    this.refs.root = firebase.database().ref(identifier)
    this.refs.current = this.refs.root.child('current')
    this.refs.operations = this.refs.root.child('operations')
    this.user = user
    this.identifier = identifier

    ResourceCache.set(identifier, this)
  }

  async connect() {
    const connectionID = this.getKey()

    if (!this.connections.length) {
      /* Set up the listener */
      const onOpAdded = this.events.on('op_added', op =>
        this.operations.recieved.push(op)
      )
      const onOpChanged = this.events.on('op_changed', op =>
        this.operations.recievedChanges.set(op.id, op)
      )

      this.refs.operations.on('child_added', (childSnapshot: DataSnapshot) => {
        const operation = childSnapshot.val() as SpecificOperation
        this.events.emit('op_added', operation)
      })

      this.refs.operations.on(
        'child_changed',
        (childSnapshot: DataSnapshot) => {
          const operation = childSnapshot.val() as SpecificOperation
          this.operations.recievedChanges.set(operation.id, operation)
        }
      )

      this.disconnector = () => {
        onOpAdded()
        onOpChanged()
      }
    }

    this.connections.push(connectionID)

    return () => this.disconnect(connectionID)
  }

  async markAsSettled(operation?: SpecificOperation) {
    if (operation) {
      return this.refs.operations
        .child(operation.id)
        .update({ ...operation, settled: true })
    }
  }

  createSourceValue() {
    this.value.source = this.value.client
    /* 
    Need to find a way to snapshot client state with this version of state 
    eg. Slate needs to save the selection that resulted in this state so we can return to this point
    */
  }

  async allSettled(operations: SpecificOperation[]) {
    const ops = []
    for (const key in operations) {
      const op = operations[key]
      let settledOp: false | SpecificOperation = false

      /* 
      This should only update once, but for forward compatability we will make it listen until settled
      Instead of just listening until first update
      */
      while (!Operations.isSettled(settledOp)) {
        settledOp = await this.operations.recievedChanges.pop(op.id)
      }
      ops.push(settledOp)
    }
    return ops
  }

  updateSettledSource(settledOperations: Operation[]) {}

  async runUpdates() {
    /* 
    operations.pending will always cause a matching operation to be added to this.operations.recieved
    so we wait for the remoteOp to match the next local op and then mark it as settled
    (this is relying on firebase to order operations as they come in)
    */
    for await (let remoteOp of this.operations.recieved) {
      if (!this.operations.pending.length) {
        const operations = await this.allSettled([remoteOp])
        this.applyOperations(this.value.source, ...operations)
        this.applyOperations(this.value.client, ...operations)
      } else {
        /* We've recieved the parked operation equal to the first pending item */
        if (Operations.areEqual(remoteOp, this.operations.pending.next())) {
          /* Remove the first item from the pending queue */
          const op = this.operations.pending.shift()
          /* Wait for all the remote operations to finish */
          const settledRemoteOps = await this.allSettled(
            this.operations.beforeNextOp.items
          )

          /* Transform each item in the local pending queue by the settled remote ops */
          this.operations.pending.map(op =>
            settledRemoteOps.reduce(
              (operation, remoteOperation) =>
                Transforms.transform(operation, remoteOperation),
              op
            )
          )

          /* Push the update to the server */
          const settledOp = await this.markAsSettled(op)

          this.updateSettledSource([...settledRemoteOps, settledOp])
        } else {
          /* Apply all the operations to the local operations */
          this.operations.beforeNextOp.push(
            this.operations.recieved.shift() as SpecificOperation
          )
        }
      }
    }
  }

  async disconnect(connectionID?: string, hideWarning: boolean = false) {
    if (!connectionID && this.connections.length > 1) {
      if (!hideWarning) {
        console.warn(msg`
          Warning: you are trying to disconnect from a resource while there are still others listening to it.
          If you meant to unsubscribe for a single component call the function returned from the "resouce.connect()" call.
          If you really meant to disconnect the resource call the resource disconnect method like so "resource.disconnect(undefined, true)"
        `)
      } else {
      }
    }
    if (connectionID) {
      const index = this.connections.indexOf(connectionID)
      if (index !== -1) {
        this.connections.splice(index)[0]
      }
    }

    if (!this.connections.length) {
      /* Disconnect all the listeners */
    }
  }

  /* Update state. This function will not trigger server updates */
  applyOperations(source: T, ...ops: SpecificOperation[]) {
    let value = source
    for (const operation of ops) {
      /* No operation operation 😎 */
      if (Operations.isNoopOperation(operation)) {
        continue
      }

      /* Adding replacing and removing is handled by immer */
      if (Operations.isImmerCompat(operation)) {
        const immerPatch = Operations.toImmerPatch(operation)
        if (!immerPatch) continue
        value = applyPatches(value, [immerPatch])
      }
      if (Operations.isCustomOperation(operation)) {
      }
    }
  }

  /* 
  There are two client facing ways to change the value of a resource.
    a) by using the update function and mutating the value in the callback (which will create operations and replace the value)
    b) by using the proposeOperation function
  */

  /* Client facing api to create a new value */
  update(updater: (value: T) => any, apply = true) {
    /* 
    Locally we update the value immediately, but we dont send the full value to the server. Just the patches
    */
    this.value.client = produce(this.value.client, updater, patches => {
      if (apply) {
        const operations = patches.map(Operations.fromImmerPatch)
        /* We don't want to reapply the operations to state because immer did it for us */
        this.proposeOperations({ operations, apply: false })
      }
    })

    this.emit('change_client', this.value.client)
  }

  /* This is the function you call from the client */
  async proposeOperations(opts: ProposeOperationOptions) {
    if (!this.value.source) {
      this.createSourceValue()
    }

    const { apply = true, operations } = opts

    /* Compress operations now */
    for (const op of operations) {
      /* The operation needs to get some ownership and metadata added to it */
      const ref = this.refs.operations.push()

      const operation: SpecificOperation = {
        ...op,
        client: this.client,
        user: this.user,
        uid: ref.key as string,
        /* Initially just the id is pushed to the server */
        settled: true,
      }

      /* We need to apply this operation to the local state before we park it */
      if (apply) {
        this.applyOperations(this.value.client, op)
        this.emit('change_client', this.value.client)
      }

      /* Add the operation to the local pending queue */
      this.operations.pending.push(operation)
      /* 
      Send the parking request to the server
      the full value will be added in the runUpdates function
      */
      const parkedPromise = ref.set({ id: operation.id })
    }
  }
}

export default Resource
