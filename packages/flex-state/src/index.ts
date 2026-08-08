export type Subscriber<T> = (value: T) => void;
export type Unsubscribe = () => void;

export interface Store<T> {
  get(): T;
  set(value: T): void;
  update(fn: (value: T) => T): void;
  subscribe(run: Subscriber<T>): Unsubscribe;
}

export function createStore<T>(initial: T): Store<T> {
  let value = initial;
  const subscribers = new Set<Subscriber<T>>();

  const store: Store<T> = {
    get: () => value,
    set(next) {
      if (next === value) return;
      value = next;
      for (const run of subscribers) run(value);
    },
    update(fn) {
      store.set(fn(value));
    },
    subscribe(run) {
      subscribers.add(run);
      return () => {
        subscribers.delete(run);
      };
    },
  };

  return store;
}
