type Entry<T> = { value: T; signature: string; label: string };

/** One history entry per intent, even when a drag produces hundreds of updates. */
export class DraftHistory<T> {
  private past: Entry<T>[] = [];
  private future: Entry<T>[] = [];
  private current: Entry<T>;
  private transaction: Entry<T> | null = null;
  private transactionFuture: Entry<T>[] = [];
  private transactionLabel = 'Change settings';

  constructor(
    value: T,
    signature: string,
    private readonly limit = 100,
  ) {
    this.current = { value: structuredClone(value), signature, label: 'Opened record' };
  }

  get canUndo() {
    return (
      this.past.length > 0 ||
      Boolean(this.transaction && this.transaction.signature !== this.current.signature)
    );
  }
  get canRedo() {
    return this.future.length > 0;
  }
  get undoLabel() {
    return this.current.label;
  }
  get inTransaction() {
    return this.transaction !== null;
  }

  begin(label = 'Change settings') {
    if (this.transaction) return;
    this.transaction = this.current;
    this.transactionFuture = this.future;
    this.transactionLabel = label;
  }

  observe(value: T, signature: string, label = 'Change settings') {
    if (signature === this.current.signature) return false;
    if (!this.transaction) this.pushPast(this.current);
    this.current = {
      value: structuredClone(value),
      signature,
      label: this.transaction ? this.transactionLabel : label,
    };
    this.future = [];
    return true;
  }

  commit() {
    if (this.transaction && this.transaction.signature !== this.current.signature)
      this.pushPast(this.transaction);
    if (this.transaction?.signature === this.current.signature)
      this.future = this.transactionFuture;
    this.transaction = null;
    this.transactionFuture = [];
  }

  cancel(): T | null {
    if (!this.transaction) return null;
    this.current = this.transaction;
    this.future = this.transactionFuture;
    this.transactionFuture = [];
    this.transaction = null;
    return structuredClone(this.current.value);
  }

  undo(): T | null {
    this.commit();
    const previous = this.past.pop();
    if (!previous) return null;
    this.future.push(this.current);
    this.current = previous;
    return structuredClone(previous.value);
  }

  redo(): T | null {
    this.commit();
    const next = this.future.pop();
    if (!next) return null;
    this.pushPast(this.current);
    this.current = next;
    return structuredClone(next.value);
  }

  private pushPast(entry: Entry<T>) {
    this.past.push(entry);
    if (this.past.length > this.limit) this.past.shift();
  }
}
