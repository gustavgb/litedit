import { open, save } from "@tauri-apps/plugin-dialog";
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
  //
  // Returns a cleanup function; call it when the component unmounts or when
  // filePath changes. Designed to be used inside a Svelte $effect.

  // Not used currently
  startWatcher() {
    if (!this.filePath) return;

    const path = this.filePath;
    let cancelled = false;
    let unwatch: (() => void) | null = null;

    watch(
      path,
      async (_event: WatchEvent) => {
        if (cancelled) return;
        console.log(_event)
        const kind = _event.type as object
        if ('access' in kind) return;
        if (Date.now() - this.lastSaveAt < 500) return;
        try {
          this.reloading = true;
          const text = await readTextFile(path);
          if (!cancelled && text !== this.content) {
            this.content = text;
            this.dirty = false;
            this.error = "";
            this.updateTitle();
          }
        } catch (e) {
          if (!cancelled) this.error = String(e);
        } finally {
          if (!cancelled) this.reloading = false;
        }
      },
      { delayMs: 200 },
    )
      .then((fn) => {
        if (cancelled) fn();
        else unwatch = fn;
      })
      .catch((e) => {
        console.error("[watch] failed to start:", e);
      });

    return () => {
      cancelled = true;
      unwatch?.();
    };
  }
}

export const fileStore = new FileStore();
