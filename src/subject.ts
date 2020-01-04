const SUBJECT = Symbol("subject");

type Callback = (...args: any[]) => any;

class Subject<EventTypes> {
  [SUBJECT]: {
    iter: number;
    events: {
      [K in EventTypes]: {
        [t: string]: Callback;
      }
    };
  } = {
    iter: 0,
    events: {}
  };

  on(event: EventTypes, callback: Callback) {
    const key = `_${this[SUBJECT].iter++}`;
    if (!this[SUBJECT].events[event]) {
      this[SUBJECT].events[event] = {};
    }
    this[SUBJECT].events[event][key] = callback;
    return () => {
      delete this[SUBJECT].events[event][key];
      if (!Object.values(this[SUBJECT].events[event]).length) {
        delete this[SUBJECT].events[event];
      }
    };
  }

  emit(event: EventTypes, ...data: any[]) {
    if (!this[SUBJECT].events[event]) return;
    Object.values(this[SUBJECT].events[event]).forEach(callback => {
      callback(...data);
    });
  }
}

export default Subject;
