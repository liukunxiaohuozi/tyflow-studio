import { TaskQueue } from "../src/main/task-queue";

function pending() {
  let finish!: () => void;
  const promise = new Promise<void>((resolve) => {
    finish = resolve;
  });
  return { promise, finish };
}
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

test("two isolated tasks run concurrently and a third waits for a slot", async () => {
  const queue = new TaskQueue(() => 2);
  const started: string[] = [];
  const first = pending(),
    second = pending(),
    third = pending();
  queue.enqueue("a", "isolated-a", async () => {
    started.push("a");
    await first.promise;
  });
  queue.enqueue("b", "isolated-b", async () => {
    started.push("b");
    await second.promise;
  });
  queue.enqueue("c", "isolated-c", async () => {
    started.push("c");
    await third.promise;
  });
  expect(started).toEqual(["a", "b"]);
  first.finish();
  await flush();
  expect(started).toEqual(["a", "b", "c"]);
  second.finish();
  third.finish();
  await flush();
  expect(queue.busy).toBe(false);
});

test("a shared checkout is serialized while an unrelated task can proceed", async () => {
  const queue = new TaskQueue(() => 2),
    held = pending();
  const started: string[] = [];
  queue.enqueue("a", "same-directory", async () => {
    started.push("a");
    await held.promise;
  });
  queue.enqueue("b", "same-directory", async () => {
    started.push("b");
  });
  queue.enqueue("c", "another-directory", async () => {
    started.push("c");
  });
  expect(started).toEqual(["a", "c"]);
  held.finish();
  await flush();
  expect(started).toEqual(["a", "c", "b"]);
});

test("cancelling a queued task never executes it or interrupts the active task", async () => {
  const queue = new TaskQueue(() => 1),
    held = pending(),
    unwanted = jest.fn();
  queue.enqueue("a", "a", () => held.promise);
  queue.enqueue("b", "b", unwanted);
  queue.cancelWaiting("b");
  held.finish();
  await flush();
  expect(unwanted).not.toHaveBeenCalled();
  expect(queue.busy).toBe(false);
});

test("failed work frees a slot and shutdown does not start queued work", async () => {
  const queue = new TaskQueue(() => 1),
    held = pending(),
    next = jest.fn();
  queue.enqueue("a", "a", async () => {
    await held.promise;
    throw new Error("fixture failure");
  });
  queue.enqueue("b", "b", next);
  queue.close();
  held.finish();
  await flush();
  expect(next).not.toHaveBeenCalled();
  expect(() => queue.enqueue("c", "c", next)).toThrow();
});
