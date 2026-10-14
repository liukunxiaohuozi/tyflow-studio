/** Slots cover a whole execution chain; cancellation belongs to one task only. */
export class TaskQueue {
  private waiting: {
    id: string;
    resource: string;
    run: () => Promise<void>;
  }[] = [];
  private running = new Map<string, string>();
  private closed = false;
  constructor(private capacity: () => number) {}
  get busy() {
    return this.waiting.length > 0 || this.running.size > 0;
  }
  has(id: string) {
    return this.running.has(id) || this.waiting.some((job) => job.id === id);
  }
  enqueue(id: string, resource: string, run: () => Promise<void>) {
    if (this.closed) throw new Error("客户端正在关闭");
    if (this.has(id)) throw new Error("该任务已在执行或排队");
    this.waiting.push({ id, resource, run });
    this.drain();
  }
  cancelWaiting(id: string) {
    this.waiting = this.waiting.filter((job) => job.id !== id);
    this.drain();
  }
  close() {
    this.closed = true;
    this.waiting = [];
  }
  private drain() {
    if (this.closed) return;
    const capacity = Math.max(1, Math.min(4, this.capacity()));
    while (this.running.size < capacity) {
      const index = this.waiting.findIndex(
        (job) => ![...this.running.values()].includes(job.resource),
      );
      if (index < 0) return;
      const [job] = this.waiting.splice(index, 1);
      this.running.set(job.id, job.resource);
      void job
        .run()
        .finally(() => {
          this.running.delete(job.id);
          this.drain();
        })
        .catch(() => {});
    }
  }
}
