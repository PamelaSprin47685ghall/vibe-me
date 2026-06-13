type StateHolder<T> = {
  getState(): T;
  enqueue(update: (state: T) => T | Promise<T>): Promise<void>;
};

function createStateHolder<T>(initialState: T): StateHolder<T> {
  let state = initialState;
  let tail = Promise.resolve();

  return {
    getState: () => state,
    enqueue: (update) => {
      const task = tail
        .then(() => update(state))
        .then((next) => {
          state = next;
        });
      tail = task.catch(() => {});
      return task;
    },
  };
}

export { createStateHolder, type StateHolder };
