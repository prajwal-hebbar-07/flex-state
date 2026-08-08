import { describe, expect, it } from "vitest";
import { createStore } from "./index.js";

describe("createStore", () => {
  it("notifies on change and stops after unsubscribe", () => {
    const store = createStore(0);
    const seen: number[] = [];
    const stop = store.subscribe((v) => seen.push(v));

    store.set(1);
    store.update((v) => v + 1);
    stop();
    store.set(99);

    expect(seen).toEqual([1, 2]);
    expect(store.get()).toBe(99);
  });

  it("skips notification when the value is unchanged", () => {
    const store = createStore("a");
    let calls = 0;
    store.subscribe(() => calls++);
    store.set("a");
    expect(calls).toBe(0);
  });

  it("keeps methods usable when detached from the object", () => {
    const store = createStore(5);
    const { get, subscribe } = store;
    const stop = subscribe(() => {});
    store.set(6);
    expect(get()).toBe(6);
    stop();
  });
});
