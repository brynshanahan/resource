type Callback<T, R> = (item: T, i: number, obj: T[]) => R;

function anyPromise(promises: Promise<any>[]): Promise<any[]> {
  return new Promise(resolve => {
    // @ts-ignore
    const result: any[] = [].fill(undefined, 0, promises.length - 1);
    promises.forEach((prom, i) => {
      prom.then(val => {
        result[val] = val;
        resolve(result);
      });
    });
  });
}

class Queue<T> {
  items: T[] = [];

  listener: false | (() => any) = false;
  disposers: (() => void)[] = [];

  push(...items: T[]) {
    items.forEach(item => {
      this.items.push(item);
      if (this.listener) this.listener();
    });
  }

  shift() {
    return this.items.shift();
  }

  next() {
    return this.items[0];
  }

  clear() {
    this.disposers.forEach(fn => fn());
    this.disposers = [];
    this.items = [];
  }

  reset() {
    this.items = [];
  }

  get length() {
    return this.items.length;
  }

  forEach(fn: Callback<T, any>) {
    for (let index in this.items) {
      fn(this.items[index], Number(index), this.items);
    }
  }

  map(fn: Callback<T, T>) {
    this.items = this.items.map(fn);
  }

  /* Loop over existing items */
  *[Symbol.iterator]() {
    for (let key in this.items) {
      yield this.items[key];
    }
  }

  /* Loop over current and future items */
  async *[Symbol.asyncIterator]() {
    let done = false;
    const disposers = () => {
      done = true;
    };
    this.disposers.push(disposers);
    try {
      let index = 0;
      let updatePromise;
      while (true) {
        /* This was cancelled */
        if (done) return;

        /* If the item doesn't exist wait for the next one */
        if (!this.items[index]) {
          if (!updatePromise) {
            updatePromise = new Promise(resolve => {
              this.listener = () => resolve(true);
            });
          }

          const result = await anyPromise([
            updatePromise,
            /* Check every 300 seconds if this has been torn down */
            new Promise(resolve => setTimeout(() => resolve(false), 300)),
          ]);

          if (result[0]) {
            this.listener = false;
          }
        }

        /* Return the next item */
        yield this.items[index++];
      }
    } finally {
      this.listener = false;
      this.disposers.splice(this.disposers.indexOf(disposers));
    }
  }
}

export default Queue;
