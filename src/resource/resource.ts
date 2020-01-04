import firebase from 'firebase';
import Operations, {
  Operation,
  NoopOperation,
  SpecificOperation,
  PartialSpecificOperation,
} from './operations';
import Queue from './queue';
import Transforms from './transforms';
import AsyncOverwriteMap from './async-map';
import produce from 'immer';

type FireRef = import('firebase').database.Reference;

interface ProposeOperationOptions {
  apply?: boolean
  operations: PartialSpecificOperation[]
}



class Resource<T> {
  client: string;
  disconnector: () => any = () => {};

  refs: {
    root: FireRef;
    current: FireRef;
    operations: FireRef;
  };

  value: {
    client: T;
    source: T;
  };

  operations: {
    distinct: {};
    /* recieved ops are operations that happened before the first pendingClient operation */
    pending: Queue<SpecificOperation>;
    recieved: Queue<SpecificOperation>;
    beforeNextOp: Queue<SpecificOperation>;
    recievedChanges: AsyncOverwriteMap<string, SpecificOperation>;
  };

  constructor(identifier: string, client: string) {
    // @ts-ignore
    this.refs = {};
    this.refs.root = firebase.database().ref(identifier);
    this.refs.current = this.refs.root.child('current');
    this.refs.operations = this.refs.root.child('operations');
    this.client = client;
  }

  async connect() {
    this.refs.operations.on('child_added', childSnapshot => {
      const operation = childSnapshot.val() as SpecificOperation;
      this.operations.recieved.push(operation);
    });
    this.refs.operations.on('child_changed', childSnapshot => {
      const operation = childSnapshot.val() as SpecificOperation;
      this.operations.recievedChanges.set(operation.id, operation);
    });
  }

  async markAsSettled(operation?: SpecificOperation) {
    if (operation) {
      return this.refs.operations
        .child(operation.id)
        .update({ ...operation, settled: true });
    }
  }

  createSourceValue () {
    this.value.source = this.value.client
    /* 
    Need to find a way to snapshot client state with this version of state 
    eg. Slate needs to save the selection that resulted in this state so we can return to this point
    */
  }

  async allSettled(operations: SpecificOperation[]) {
    const ops = [];
    for (const key in operations) {
      const op = operations[key];
      let settledOp: false | SpecificOperation = false;

      /* 
      This should only update once, but for forward compatability we will make it listen until settled
      Instead of just listening until first update
      */
      while (!Operations.isSettled(settledOp)) {
        settledOp = await this.operations.recievedChanges.pop(op.id);
      }
      ops.push(settledOp);
    }
    return ops;
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
        this.applyOperations({ operations: [remoteOp] });
      } else {
        /* We've recieved the parked operation equal to the first pending item */
        if (Operations.areEqual(remoteOp, this.operations.pending.next())) {
          /* Remove the first item from the pending queue */
          const op = this.operations.pending.shift();
          /* Wait for all the remote operations to finish */
          const settledRemoteOps = await this.allSettled(
            this.operations.beforeNextOp.items
          );

          /* Transform each item in the local pending queue by the settled remote ops */
          this.operations.pending.map(op =>
            settledRemoteOps.reduce(
              (operation, remoteOperation) =>
                Transforms.transform(operation, remoteOperation),
              op
            )
          );

          /* Push the update to the server */
          const settledOp = await this.markAsSettled(op);

          this.updateSettledSource([...settledRemoteOps, settledOp]);
        } else {
          /* Apply all the operations to the local operations */
          this.operations.beforeNextOp.push(
            this.operations.recieved.shift() as SpecificOperation
          );
        }
      }
    }
  }

  async disconnect() {}

  /* Update state. This function will not trigger server updates */
  applyOperations(source = this.value.client, ...ops: SpecificOperation[]) {
    for (const operation of ops) {
      /* No operation operation 😎 */
      if (Operations.isNoopOperation(operation)) {
        continue;
      }
      if (Operations.isReplaceOperation(operation)) {
      }
      if (Operations.isAddOperation(operation)) {
      }
      if (Operations.isRemoveOperation(operation)) {
      }
      if (Operations.isCustomOperation(operation)) {
      }
    }
  }

  /* 
  There are two client facing ways to change the value of a resource.
    a) by using the update function and mutating the value in the callback (which will send operatoins)
    b) by using the proposeOperation function 
  */

  /* Client facing api to create a new value */
  update(updater: (value: T) => any) {
    /* 
    Locally we update the value immediately, but we dont send the full value to the server. Just the patches
    */
    this.value.client = produce(this.value.client, updater, patches => {
      const operations = patches.map(Operations.fromImmerPatch);
      /* We don't want to reapply the operations to state because immer did it for us */
      this.proposeOperations({ operations, apply: false });
    });
  }

  /* This is the function you call from the client */
  async proposeOperations(opts:ProposeOperationOptions) {
    if (!this.value.source) {
      this.createSourceValue()
    }

    const { apply, operations } = opts

    
    /* Compress operations now */
    for (const op of operations) {
      /* The operation needs to get some ownership and metadata added to it */
      const ref = this.refs.operations.push()
      
      const operation:SpecificOperation = {
        ...op,
        client: 'test_client',
        id: ref.key as string,
        /* Initially just the id is pushed to the server */
        settled: true
      }

      /* We need to apply this operation to the local state before we park it */
      if (apply) {
        this.applyOperations(this.value.client, op)
      }

      /* Add the operation to the local pending queue */
      this.operations.pending.push(operation)
      /* 
      Send the request to the server
      the full value will be added in the runUpdates function
      */
      const parkedPromise = ref.set({ id: operation.id })
    }
  }
}

export default Resource;
