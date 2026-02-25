<script lang="ts">
  import { fileStore } from "./lib/fileStore.svelte";
  import Editor from "./lib/Editor.svelte";
  import ShortcutsOverlay from "./lib/ShortcutsOverlay.svelte";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { invoke } from "@tauri-apps/api/core";
  import { listen } from "@tauri-apps/api/event";

  let showShortcuts = $state(false);

  // ─── Menu actions from Rust ────────────────────────────────────────────────
  // The native menu is built in Rust so accelerators (including Ctrl+W / Ctrl+Q)
  // are registered synchronously with the GTK window — before WebKitGTK loads.
  // Quit is handled in Rust with app.exit(0); other actions arrive here as events.
  $effect(() => {
    const unlisten = listen<string>("menu-action", ({ payload: id }) => {
      if (id === "open")         fileStore.open();
      else if (id === "save")    fileStore.save();
      else if (id === "save_as") fileStore.saveAs();
      else if (id === "close")   fileStore.filePath ? fileStore.close() : getCurrentWindow().close();
      else if (id === "help")    showShortcuts = true;
    });
    return () => { unlisten.then((fn) => fn()); };
  });

  // ─── Open file from CLI argument or file-manager association ──────────────
  // Uses a Tauri command so the path is available synchronously in Rust state —
  // no timing race, unlike an event emitted after an arbitrary delay.
  $effect(() => {
    invoke<string | null>("get_initial_file").then((path) => {
      if (path) fileStore.openPath(path);
    });
  });

  // ─── File watcher ─────────────────────────────────────────────────────────
  $effect(() => {
    fileStore.filePath;
    return fileStore.startWatcher();
  });

  // ─── Auto-save (debounced 1.5 s) ──────────────────────────────────────────
  $effect(() => {
    const c = fileStore.content;
    if (!fileStore.filePath || !fileStore.dirty) return;
    const timer = setTimeout(() => fileStore.persist(fileStore.filePath, c), 1500);
    return () => clearTimeout(timer);
  });

  // ─── In-app shortcuts (capture phase — fires before CodeMirror) ───────────
  // Kept as a fallback for environments where the native menu isn't available.
  $effect(() => {
    function onKeydown(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === "o") { e.preventDefault(); fileStore.open(); }
      else if (e.key === "s" && e.shiftKey) { e.preventDefault(); fileStore.saveAs(); }
      else if (e.key === "s") { e.preventDefault(); fileStore.save(); }
      else if (e.key === "w") { e.preventDefault(); fileStore.filePath ? fileStore.close() : getCurrentWindow().close(); }
      else if (e.key === "q") { e.preventDefault(); getCurrentWindow().close(); }
    }
    window.addEventListener("keydown", onKeydown, true);
    return () => {
      window.removeEventListener("keydown", onKeydown, true);
    };
  });
</script>

<div class="app">
  {#if showShortcuts}
    <ShortcutsOverlay onclose={() => showShortcuts = false} />
  {/if}

  <Editor
    content={fileStore.content}
    filePath={fileStore.filePath}
    onchange={(v) => { fileStore.content = v; fileStore.dirty = true; fileStore.updateTitle(); }}
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
