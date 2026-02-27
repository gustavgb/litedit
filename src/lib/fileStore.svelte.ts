import { confirm, open, save } from "@tauri-apps/plugin-dialog";
import {
  readTextFile,
  writeTextFile,
  watch,
  type WatchEvent,
} from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";

// ─── Reactive state ────────────────────────────────────────────────────────

class FileStore {
  filePath = $state("");
  content = $state("");
  dirty = $state(false);
  saving = $state(false);
  error = $state("");
  reloading = $state(false);

  // Derived
  readonly displayPath = $derived(this.filePath || "Untitled");
  readonly displayName = $derived(
    this.filePath ? this.filePath.split("/").at(-1)! : "Untitled"
  );

  // Timestamp of the most recent write — used to suppress our own watch events
  private lastSaveAt = 0;

  // Cleanup function for the active file watcher (null when no file is open)
  private unwatchFn: (() => void) | null = null;

  // ─── Window title ──────────────────────────────────────────────────────────

  updateTitle() {
    const name = this.filePath ? this.filePath.split("/").at(-1)! : "Untitled";
    const title = this.dirty ? `\u2022 ${name} \u2014 Himark` : `${name} \u2014 Himark`;
    document.title = title; // X11 / fallback
    invoke("set_title", { title }); // Wayland: also patches the GTK HeaderBar
  }

  // ─── File persistence ───────────────────────────────────────────────────

  async persist(path: string, data: string) {
    if (!path || this.saving) return;
    try {
      this.saving = true;
      this.lastSaveAt = Date.now();
      await writeTextFile(path, data);
      this.dirty = false;
      this.error = "";
    } catch (e) {
      this.error = String(e);
    } finally {
      this.saving = false;
    }
    this.updateTitle();
  }

  async openPath(path: string) {
    this._stopWatcher();
    try {
      const text = await readTextFile(path);
      this.filePath = path;
      this.content = text;
      this.dirty = false;
      this.error = "";
    } catch (e) {
      this.error = String(e);
    }
    this.updateTitle();
    if (this.filePath) this._watchFile(this.filePath);
  }

  async open() {
    const selected = await open({
      multiple: false,
      filters: [
        { name: "Markdown", extensions: ["md", "markdown", "txt"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });
    if (!selected) return;
    const path = typeof selected === "string" ? selected : selected[0];
    await this.openPath(path);
  }

  async save() {
    if (!this.filePath) {
      await this.saveAs();
      return;
    }
    await this.persist(this.filePath, this.content);
  }

  close() {
    this._stopWatcher();
    this.filePath = "";
    this.content = "";
    this.dirty = false;
    this.error = "";
    this.updateTitle();
  }

  async saveAs() {
    const path = await save({
      filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
    });
    if (!path) return;
    await this.persist(path, this.content);
    if (!this.error) { this.filePath = path; this.updateTitle(); }
  }

  // ─── File watcher ───────────────────────────────────────────────────────

  private _stopWatcher() {
    this.unwatchFn?.();
    this.unwatchFn = null;
  }

  private _watchFile(path: string) {
    let cancelled = false;
    const self = this

    watch(
      path,
      async function (event: WatchEvent) {
        if (cancelled) return;
        if (Date.now() - self.lastSaveAt < 500) return;

        const kind = event.type as object;
        const isModify = "modify" in kind;
        const isRemove = "remove" in kind;
        if (!isModify && !isRemove) return;

        const reload = await confirm('The file was modified on disk. Do you want to reload it?', {
          title: "File changed on disk",
          kind: "warning",
        });

        if (reload && !cancelled) {
          await self.openPath(path);
        }
      },
      { delayMs: 200 },
    )
      .then((fn) => {
        if (cancelled) { fn(); return; }
        this.unwatchFn = () => {
          cancelled = true;
          fn();
        };
      })
      .catch((e) => {
        console.error("[watch] failed to start:", e);
      });
  }
}

export const fileStore = new FileStore();
