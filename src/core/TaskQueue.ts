import { Task } from './Task';

export class TaskQueue {
  private tasks: Task[] = [];

  add(task: Task): void {
    this.tasks.push(task);
    this.tasks.sort((a, b) => b.priority - a.priority);
  }

  peek(): Task | null {
    return this.tasks.length > 0 ? this.tasks[0] : null;
  }

  pop(): Task | null {
    return this.tasks.shift() ?? null;
  }

  remove(taskId: string): void {
    this.tasks = this.tasks.filter(t => t.id !== taskId);
  }

  get length(): number {
    return this.tasks.length;
  }

  getAll(): Task[] {
    return [...this.tasks];
  }

  serialize(): object[] {
    return this.tasks.map(t => t.serialize());
  }

  static deserialize(data: any[]): TaskQueue {
    const queue = new TaskQueue();
    queue.tasks = data.map(d => Task.deserialize(d));
    queue.tasks.sort((a, b) => b.priority - a.priority);
    return queue;
  }
}
