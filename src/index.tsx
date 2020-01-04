import React, { useMemo, useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { Slate, Editable, withReact } from "slate-react";
import { createEditor, Editor, Operation } from "slate";

import firebase from "./fire";
import uuid from "uuid/v4";
import "./styles.scss";
import transform from "./transforms";

const initialValue = [
  { type: "paragraph", children: [{ text: "Nice paragraph you got there" }] }
];

function isEmpty(obj: {}) {
  return !Object.keys(obj).length;
}

function waitFor(time: number) {
  return new Promise(resolve => setTimeout(resolve, time));
}

interface Operations {
  pending: {
    local: Operation[];
    server: Operation[];
  };
  flushed: Operation[];
  dirty: boolean | number;
}

let iter = 1;
const OP_MAP = {
  get(key) {
    if (!this[key]) {
      this[key] = iter++;
    }
    return this[key];
  }
};

function applyOperationsToEditor(editor: Editor, ...operations: Operation[][]) {
  Editor.withoutNormalizing(editor, () => {
    operations.forEach(opList => {
      opList.forEach(op => editor.apply(op));
    });
  });
}

class Room {
  room: string;
  client: string;

  currentValue: Editor;
  value: Editor;

  ref: import("firebase").database.Reference;
  updatesRef: import("firebase").database.Reference;
  currentRef: import("firebase").database.Reference;

  onChange: (arg: Editor["children"]) => any;
  updatePromise = Promise.resolve();

  operations: Operations = {
    pending: {
      local: [],
      server: []
    },
    flushed: [],
    dirty: false
  };

  handlerIndex = 0;
  handlers = {};

  applyingUpdates = false;

  constructor(roomName, changeHandler) {
    this.room = roomName;
    this.ref = firebase.database().ref(roomName);
    this.updatesRef = this.ref.child("operations");
    this.currentRef = this.ref.child("current");
    this.onChange = changeHandler;
    this.client = uuid();

    this.apply = this.apply.bind(this);
  }

  on(event, handler) {
    const key = `k${this.handlerIndex++}`;
    if (!this.handlers[event]) {
      this.handlers[event] = {};
    }
    this.handlers[event][key] = handler;
    return {
      off: () => {
        delete this.handlers[event][key];
        if (isEmpty(this.handlers[event])) {
          delete this.handlers[event];
        }
      }
    };
  }

  once(event, handler) {
    if (!handler) {
      let off;
      // @ts-ignore
      const prom: Promise<any> & { off(): any } = new Promise(resolve => {
        const { off: dispose } = this.once(event, resolve);
        off = dispose;
      });
      prom.off = off;
      return off;
    }
    const { off } = this.on(event, (...args) => {
      handler(...args);
      off();
    });
    return { off };
  }

  emit(event, ...args) {
    this.handlers[event] &&
      // @ts-ignore
      Object.values(this.handlers[event]).forEach(handler => handler(...args));
  }

  isDirty() {
    return typeof this.operations.dirty === "number" && this.operations.dirty;
  }

  start() {
    /* Get the initial value */
    let finished = false;

    const operationAdded = snapshot => {
      const op = snapshot.val();
      this.operations.pending.server.push(op);
      this.applyUntilComplete();
      this.emit("serverOperation", op);
    };

    const operationChanged = snapshot => {
      const op = snapshot.val();
      this.operations.flushed.forEach((flushedOperation, index) => {
        if (flushedOperation.id === op.id) {
          /* Move */
          if (this.isDirty() && this.isDirty() > index) {
            this.operations.dirty = index;
          }

          console.log("Operation changed", op);
        }
      });
    };

    const start = async response => {
      if (finished) return;

      let document = response.val();

      if (!document) {
        await this.currentRef.set(initialValue);
        const response = await this.currentRef.once("value");
        document = response.val();
      }

      /* 
      Create two documents.
      currentValue is for the true value (including server updates)
      value is optimistic local values
      */
      this.currentValue = createEditor();
      this.currentValue.children = document;
      this.value = createEditor();
      this.value.children = document;

      /* When we get new operations we want to pipe them through the value */
      this.updatesRef.on("child_added", operationAdded);

      this.updatesRef.on("child_changed", operationChanged);

      this.emit("ready");
      this.flush();
    };

    this.currentRef.once("value", start);

    return () => {
      finished = true;
      this.ref.off();
      this.updatesRef.off("child_added", operationAdded);
    };
  }

  nextServerOperation() {
    return new Promise<Operation>(resolve =>
      this.once("serverOperation", resolve)
    );
  }

  isEqualOperation(operationA, operationB) {
    return operationA.id === operationB.id;
  }

  flush() {
    this.onChange(this.value.children);
  }

  cleanUntil(arr, pred) {
    const newArr = [];
    let clean = true;
    arr.forEach((item, ...args) => {
      if (clean && pred(item, ...args)) {
        clean = false;
      }
      if (clean) return;
      newArr.push(item);
    });
    return newArr;
  }

  async applyUntilComplete() {
    if (this.applyingUpdates) return;
    this.applyingUpdates = true;

    if (
      this.operations.pending.server.length &&
      !this.operations.pending.local.length
    ) {
      console.log("Flushing from server", this.operations.pending.server);

      applyOperationsToEditor(
        this.currentValue,
        this.operations.pending.server
      );

      /* Mark the operations as flushed */
      this.operations.flushed.push(...this.operations.pending.server);
      this.operations.pending.server = [];

      this.value.children = this.currentValue.children;
      this.flush();
      this.applyingUpdates = false;
      return;
    }

    while (this.operations.pending.local.length) {
      const pendingOp = this.operations.pending.local[0];

      let incomingOperation: Operation = await this.nextServerOperation();

      while (!this.isEqualOperation(incomingOperation, pendingOp)) {
        console.log("Catching up from server");

        /* eslint-disable */
        this.operations.pending.local.forEach((operation, index) => {
          const newOp = transform(operation, incomingOperation);
          if (newOp !== operation) {
            console.log(
              `operation ${OP_MAP.get(operation.id)}:${
                operation.type
              } has been transformed`,
              {
                index,
                before: JSON.stringify(operation, null, 2),
                after: JSON.stringify(newOp, null, 2)
              }
            );
            this.operations.pending.local[index] = newOp;
          }
        });
        /* eslint-enable */

        /* Recreate the document with all the operations */
        this.value.children = this.currentValue.children;
        applyOperationsToEditor(
          this.value,
          this.operations.pending.server,
          this.operations.pending.local
        );
        this.flush();
        incomingOperation = await this.nextServerOperation();
      }

      console.log("Caught up to first pending local op");
      /* 
      The latest server update was our pending op. 
      Remove the pending op and apply all server ops
      */
      this.operations.pending.local.shift();
      this.operations.pending.server.pop();

      /* The last thing added to this.operations.pending.server was the current operation */
      applyOperationsToEditor(
        this.currentValue,
        this.operations.pending.server,
        [pendingOp]
      );

      this.operations.flushed.push(...this.operations.pending.server);

      this.operations.pending.server = this.cleanUntil(
        this.operations.pending.server,
        op => op.id === pendingOp.id
      );
      /* Update the visible value */
      this.value.children = this.currentValue.children;
      applyOperationsToEditor(
        this.value,
        this.operations.pending.server,
        this.operations.pending.local
      );
      this.flush();
    }

    /* We have flushed the last pending change */
    this.applyingUpdates = false;
    console.log("Finished local updates");
  }

  apply(operation, delay) {
    /* Dont send selection operations over the wire */
    if (Operation.isSelectionOperation(operation)) return;

    const serverRef = this.updatesRef.push();

    /* Add id's to the updates */
    operation.client = this.client;
    operation.id = serverRef.key;

    this.operations.pending.local.push(operation);
    this.value.apply(operation);
    this.flush();

    /* Send to server in a single chain */
    const updatePromise = this.updatePromise
      .then(() => waitFor(delay))
      .then(() => serverRef.set(operation));
    this.updatePromise = updatePromise;
    this.applyUntilComplete();
    return updatePromise;
  }
}

function useRoom(roomName: string) {
  const [value, setValue] = useState([]);
  const [loading, setLoading] = useState(true);

  const room = useMemo(() => {
    const room = new Room(roomName, setValue);
    return room;
  }, [roomName, setValue]);

  useEffect(() => room.start(), [room]);
  useEffect(() => {
    setLoading(true);
    return room.on("ready", setLoading).off;
  }, [room]);

  return [value, room.apply, loading];
}

function App() {
  const [inputVal, setInput] = useState("Default Room");
  const [delay, setDelay] = useState(0);
  const [roomName, setRoomName] = useState(inputVal);

  const [value, applyOperation, loading] = useRoom(roomName);
  const editor = useMemo(() => withReact(createEditor()), []);

  const onSubmit = (e: Event) => {
    e.preventDefault();
    setRoomName(inputVal);
  };

  return (
    <div className="App">
      <header>
        <h2>Room: {roomName}</h2>
        <form className="Form" onSubmit={onSubmit}>
          <label>
            <p>Choose your room</p>
            <input onChange={e => setInput(e.target.value)} value={inputVal} />
          </label>
          <label>
            <p>Delay</p>
            <input
              type="number"
              onChange={e => setDelay(Number(e.target.value))}
              value={isNaN(Number(delay)) ? 0 : delay}
            />
          </label>
          <input type="submit" value="submit" />
        </form>
        <p
          style={{
            display: inputVal.length < 3 ? "block" : "none",
            color: "red"
          }}
        >
          Room name must be at least 3 characters long
        </p>
      </header>
      <main>
        {loading && <p>loading...</p>}
        {!loading && (
          <Slate
            editor={editor}
            value={value}
            onChange={val => {
              console.log(
                `operations ${editor.operations
                  .map(op => `OP<${op.type}>`)
                  .join(", ")}`
              );

              editor.operations.forEach(operation => {
                applyOperation(operation, delay);
              });
            }}
          >
            <Editable />
          </Slate>
        )}
      </main>
    </div>
  );
}

const rootElement = document.getElementById("root");
ReactDOM.render(<App />, rootElement);
