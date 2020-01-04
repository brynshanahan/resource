import Subject from '../subject';

class AsyncOverwriteMap<K, V> extends Subject<any> {
  data = new Map<K, V>();
  set(key: K, value: V) {
    this.data.set(key, value);
    if (value) {
      this.emit(key);
    }
  }
  async pop(key: K): Promise<V> {
    const item = this.data.get(key);
    if (item) {
      this.data.delete(key);
      return item;
    }
    await new Promise(resolve => {
      const off = this.on(key, () => {
        off();
        resolve();
      });
    });
    return this.pop(key);
  }
}

export default AsyncOverwriteMap;
