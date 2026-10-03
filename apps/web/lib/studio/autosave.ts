/** Serial draft persistence acknowledges exact snapshots, including edits made during a save. */
import type { Design } from '@showcrafter/fireworks';
import type { SaveResult } from './save';

const AUTOSAVE_DELAY_MS = 600; // UI tuning in milliseconds: coalesce typing without delaying feedback.
/** Visible persistence state; errors never claim a failed snapshot was saved. */
export interface SaveStatus {
  label: 'Saved' | 'Unsaved' | 'Saving...' | 'Save failed';
  message: string;
}
/** Owns one editor's debounce and serial writes; disposal cancels queued writes and stale UI callbacks. */
export class DraftAutosave {
  private desired: Design;
  private persisted: string;
  private versionId: string | null;
  private busy = false;
  private disposed = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(
    document: Design,
    versionId: string | null,
    private readonly save: (document: Design, versionId: string | null) => Promise<SaveResult>,
    private readonly notify: (status: SaveStatus) => void,
  ) {
    this.desired = document;
    this.persisted = JSON.stringify(document);
    this.versionId = versionId;
  }
  /** Queues a validated snapshot; document units remain unchanged and no writes overlap. */
  update(document: Design): void {
    this.desired = document;
    this.clearTimer();
    this.publishStatus();
    if (!this.busy && this.dirty())
      this.timer = setTimeout(() => {
        this.requestSave();
      }, AUTOSAVE_DELAY_MS);
  }
  /** Saves the latest snapshot now, retaining it after any refusal or unexpected failure. */
  async flush(): Promise<void> {
    this.clearTimer();
    if (this.disposed || this.busy || !this.dirty()) return;
    this.busy = true;
    const document = this.desired;
    this.publishStatus();
    let saved = false;
    try {
      const result = await this.save(document, this.versionId);
      if (result.kind === 'error') this.fail(result.message);
      else {
        this.versionId = result.versionId;
        this.persisted = JSON.stringify(document);
        saved = true;
      }
    } catch {
      this.fail('The draft could not be saved. Your edits are still here. Please retry.');
    } finally {
      this.busy = false;
      if (saved) this.publishStatus();
    }
    if (saved && !this.isDisposed() && this.dirty()) await this.flush();
  }
  /** Stops pending timers and UI notifications; an already submitted write may still complete. */
  dispose(): void {
    this.disposed = true;
    this.clearTimer();
  }
  /** Requests a save from a synchronous UI handler and reports unexpected coordination failures. */
  requestSave(): void {
    this.flush().catch(() => {
      this.fail('The draft could not be saved. Please retry.');
    });
  }
  private isDisposed(): boolean {
    return this.disposed;
  }
  private currentLabel(): SaveStatus['label'] {
    if (this.busy) return 'Saving...';
    return this.dirty() ? 'Unsaved' : 'Saved';
  }
  private dirty(): boolean {
    return JSON.stringify(this.desired) !== this.persisted;
  }
  private clearTimer(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
  }
  private publishStatus(): void {
    if (!this.disposed)
      this.notify({
        label: this.currentLabel(),
        message: '',
      });
  }
  private fail(message: string): void {
    if (!this.disposed) this.notify({ label: 'Save failed', message });
  }
}
