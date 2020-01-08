import Stateful from "../helpers/stateful";

function on(element, event, callback) {
  element.addEventListener(event, callback);
  return () => element.removeEventListener(event, callback);
}

export class PageCache {
  storage: Storage;
  memCache = new Stateful({});
  queue = {};
  saving = false;
  constructor(storage: Storage) {
    this.storage = storage;
  }

  key(url) {
    return `resource__${url}`;
  }

  set(url, value) {
    const key = this.key(url);
    this.memCache.setState({ [key]: { ...value } });
    this.addToSaveQueue(key);
  }

  addToSaveQueue(key) {
    this.queue[key] = () =>
      localStorage.setItem(key, JSON.stringify(this.memCache.state[key]));

    if (!this.saving) {
      this.saving = true;
      setTimeout(() => {
        this.saving = false;
        Object.keys(this.queue).forEach(key => {
          this.queue[key]();
          delete this.queue[key];
        });
      }, 600);
    }
  }

  get(url, opts?) {
    const key = this.key(url);
    if (this.memCache.state[key] && !(opts && opts.store)) {
      return this.memCache.state[key];
    }

    try {
      const item = this.storage.getItem(this.key(url));
      if (item) {
        return JSON.parse(item);
      }
    } catch (e) {}
  }

  subscribe(url, callback) {
    const key = this.key(url);

    const offStorage = on(window, "storage", e => {
      if (e.key === key) {
        this.memCache.setState({ [key]: this.get(url, { store: true }) });
      }
    });

    const onChange = this.memCache.changed(key, () =>
      callback(this.memCache.state[key])
    );

    return () => {
      onChange();
      offStorage();
    };
  }
}

export const pageCache = new PageCache(localStorage);
