<script lang="ts">
  import { fileStore } from "./lib/fileStore.svelte";
  import Editor from "./lib/Editor.svelte";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { invoke } from "@tauri-apps/api/core";
  import { listen } from "@tauri-apps/api/event";
  import { confirm } from "@tauri-apps/plugin-dialog";

  // ─── Menu actions from Rust ────────────────────────────────────────────────
  // The native menu is built in Rust so accelerators (including Ctrl+W / Ctrl+Q)
  // are registered synchronously with the GTK window — before WebKitGTK loads.
  // Quit is handled in Rust with app.exit(0); other actions arrive here as events.
  $effect(() => {
    const unlisten = listen<string>("menu-action", async ({ payload: id }) => {
      if (id === "open") fileStore.open();
      else if (id === "save") fileStore.save();
      else if (id === "save_as") fileStore.saveAs();
      else if (id === "close") {
        if (fileStore.filePath || fileStore.dirty) {
          if (fileStore.dirty) {
            const confirmation = await confirm("Discard unsaved changes?", {
              title: "Unsaved changes",
              kind: "warning",
            });

            if (confirmation) {
              fileStore.close();
            }
          } else {
            fileStore.close();
          }
        } else {
          invoke("close_app");
        }
      } else if (id === "quit")
        if (fileStore.filePath || fileStore.dirty) {
          if (fileStore.dirty) {
            const confirmation = await confirm("Discard unsaved changes?", {
              title: "Unsaved changes",
              kind: "warning",
            });

            if (confirmation) {
              invoke("close_app");
            }
          } else {
            invoke("close_app");
          }
        }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  });

  // ─── Open file from CLI argument or file-manager association ──────────────
  // Uses a Tauri command so the path is available synchronously in Rust state —
  // no timing race, unlike an event emitted after an arbitrary delay.
  $effect(() => {
    invoke<string | null>("get_initial_file").then((path) => {
      if (path) fileStore.openPath(path);
    });
  });

  // ─── Auto-save (debounced 1.5 s) ──────────────────────────────────────────
  $effect(() => {
    const c = fileStore.content;
    if (!fileStore.filePath || !fileStore.dirty) return;
    const timer = setTimeout(
      () => fileStore.persist(fileStore.filePath, c),
      1500,
    );
    return () => clearTimeout(timer);
  });
</script>

<div class="app">
  <Editor
    content={fileStore.content}
    filePath={fileStore.filePath}
    onchange={(v) => {
      fileStore.content = v;
      fileStore.dirty = true;
      fileStore.updateTitle();
    }}
  />
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg);
  }
</style>
