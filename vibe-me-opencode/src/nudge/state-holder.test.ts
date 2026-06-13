import { describe, expect, test } from 'vitest';
import { createStateHolder } from './state-holder';

type Counter = { value: number };

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('createStateHolder', () => {
  test('serializes async and sync updates', async () => {
    const holder = createStateHolder<Counter>({ value: 0 });

    const asyncUpdate = holder.enqueue(async (state) => {
      await delay(20);
      return { value: state.value + 10 };
    });

    const syncUpdate = holder.enqueue((state) => ({ value: state.value + 1 }));

    await Promise.all([asyncUpdate, syncUpdate]);
    expect(holder.getState().value).toBe(11);
  });

  test('accumulates state in enqueue order', async () => {
    const holder = createStateHolder<Counter>({ value: 1 });

    await Promise.all([
      holder.enqueue(async (state) => {
        await delay(20);
        return { value: state.value * 2 };
      }),
      holder.enqueue(async (state) => {
        await delay(10);
        return { value: state.value + 10 };
      }),
      holder.enqueue((state) => ({ value: state.value + 100 })),
    ]);

    expect(holder.getState().value).toBe(112);
  });

  test('recovers from a rejected update and continues the chain', async () => {
    const holder = createStateHolder<Counter>({ value: 0 });

    await holder
      .enqueue(() => Promise.reject(new Error('boom')))
      .catch(() => {});
    await holder.enqueue((state) => ({ value: state.value + 1 }));

    expect(holder.getState().value).toBe(1);
  });

  test('invokes a rejected update exactly once and still runs later updates', async () => {
    const holder = createStateHolder<Counter>({ value: 0 });
    let calls = 0;

    const failed = holder.enqueue(async (_state) => {
      calls += 1;
      await delay(10);
      throw new Error('boom');
    });

    const next = holder.enqueue((state) => ({ value: state.value + 1 }));

    await expect(failed).rejects.toThrow('boom');
    await next;

    expect(calls).toBe(1);
    expect(holder.getState().value).toBe(1);
  });
});
