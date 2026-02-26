# Himark — Copilot Instructions

A minimalist text/markdown editor built with Tauri V2 + Svelte 5 + CodeMirror 6.

---

## Technologies

| Layer              | Choice                                            |
| ------------------ | ------------------------------------------------- |
| Desktop runtime    | Tauri V2                                          |
| Frontend framework | Svelte 5 (runes: `$state`, `$derived`, `$effect`) |
| Editor             | CodeMirror 6 (Lezer parser)                       |
| Build tool         | Vite 6                                            |
| Language           | TypeScript 5                                      |
| Markdown preview   | `marked`                                          |
| OS shortcuts       | `tauri-plugin-global-shortcut`                    |

---

## Project Structure

```
src/
├── main.ts                    # Svelte mount + import app.css
├── app.css                    # CSS variables, resets, global styles
├── App.svelte                 # Root shell — wires store, keyboard shortcuts, layout
└── lib/
    ├── fileStore.svelte.ts    # All file I/O and watcher state (class + singleton)
    ├── themes.ts              # CodeMirror dark + light theme definitions
    ├── linkCompletion.ts      # File-link autocomplete source for CodeMirror
    ├── Editor.svelte          # CodeMirror wrapper
    ├── Header.svelte          # Header bar (file path, status, shortcuts button)
    ├── ShortcutsOverlay.svelte# Keyboard shortcuts help modal
    └── Preview.svelte         # Markdown HTML preview (marked)

src-tauri/
├── Cargo.toml
├── tauri.conf.json
├── capabilities/default.json  # All Tauri capability permissions
└── src/
    └── lib.rs                 # Tauri builder with all plugins registered
```

---

## Design Principles

- **Minimalist**: no sidebar, no file explorer, no tabs, no toolbar. Just the editor.
- Header shows filename only; hovering reveals full path (CSS crossfade).
- Light/dark theme follows OS preference via `prefers-color-scheme`.
- CSS variables: `--bg`, `--bg-header`, `--text`, `--text-dim`, `--text-dim-hover`, `--accent`, `--border`, `--font-mono`.
- The app name is **Himark**.

---

## File Store (`fileStore.svelte.ts`)

Singleton class exported as `export const fileStore = new FileStore()`.

**Reactive state** (`$state`): `filePath`, `content`, `dirty`, `saving`, `error`, `reloading`.  
**Derived** (`$derived`): `displayPath` (full path or "Untitled"), `displayName` (filename only or "Untitled").

**Key methods:**

- `persist(path, data)` — writes file, sets `lastSaveAt` timestamp to suppress watcher echo.
- `open()` — dialog filter lists ~40 common text/code extensions + "All Files".
- `save()` — saves to current path, or falls through to `saveAs()` if no path.
- `saveAs()` — dialog with "All Files" filter so any extension is allowed.
- `close()` — resets `filePath`, `content`, `dirty`, `error` to empty/false.
- `startWatcher()` — returns a cleanup fn; suppresses events within 500 ms of own writes.

**Auto-save** is wired in `App.svelte`: debounced 1500 ms after `dirty` becomes true. Only fires when `filePath` is set and `dirty` is true.

---

## Editor (`Editor.svelte`)

- Uses two `Compartment`s: `themeCompartment` (defined in `themes.ts`) and `langCompartment` (local).
- **Language detection**: `LanguageDescription.matchFilename(languages, path)` from `@codemirror/language-data`. Markdown (`.md`, `.markdown`) and unsaved files get the full markdown extension with embedded code block highlighting.
- **Content sync**: uses a `lastExternalContent` sentinel + `suppressChange` flag to distinguish user keystrokes from programmatic content loads, preventing cursor jumps and spurious autosaves.
  - `suppressChange = true` wraps external `view.dispatch()` calls so `updateListener` won't call `onchange`.
  - `lastExternalContent` is updated both when external content is pushed in and when the user types, so the `$effect` only re-dispatches on genuine external changes (file open, watcher reload).

---

## Keyboard Shortcuts

### Native menu accelerators (Rust — `tauri::menu`)

`Ctrl+W` and `Ctrl+Q` are intercepted by WebKitGTK on Linux before JS sees them. The native GTK menu registers accelerators at the GTK layer, which handles them before WebKitGTK. The menu is built **in Rust** (inside the `.setup()` hook) so the GTK accel groups are registered synchronously before the window shows — building it from JS (`@tauri-apps/api/menu`) was unreliable. A `File` submenu is set via `app.set_menu(menu)` with:

- `Ctrl+O` — open file.
- `Ctrl+S` — save.
- `Ctrl+Shift+S` — save as.
- `Ctrl+W` — closes current file if one is open; quits if no file is open.
- `Ctrl+Q` — always quits. Handled in Rust with `app.exit(0)` — no IPC round-trip.

Menu events for open/save/save_as/close are forwarded to the frontend via `app.emit("menu-action", id)`. The frontend listens with `listen("menu-action", ...)` from `@tauri-apps/api/event`.

### JS capture-phase (`window.addEventListener('keydown', handler, true)`) — fallback

All other shortcuts use a capture-phase listener so they fire before CodeMirror's internal handlers (which call `stopPropagation`). **Never use `svelte:window onkeydown` for shortcuts** — CodeMirror blocks bubbling.

- `Ctrl+O` — open file (also covered by native menu).
- `Ctrl+S` — save (also covered by native menu).
- `Ctrl+Shift+S` — save as (also covered by native menu).
- `Ctrl+W` — close/quit (also covered by native menu).
- `Ctrl+Q` — quit (also covered by native menu).

### Inside the ShortcutsOverlay

- `Escape` — close overlay.

---

## Tauri Capabilities (`capabilities/default.json`)

Required permissions:

```
core:default
dialog:allow-open
dialog:allow-save
fs:allow-read-text-file   (path: $HOME/**, /**)
fs:allow-write-text-file  (path: $HOME/**, /**)
fs:allow-read-dir         (path: $HOME/**, /**)
fs:allow-exists           (path: $HOME/**, /**)
fs:allow-watch            (path: $HOME/**, /**)
fs:allow-unwatch
```

`tauri-plugin-fs` must include `features = ["watch"]` in `Cargo.toml` or the file watcher silently fails.

The native menu API (`@tauri-apps/api/menu`) is part of `core:default` — no extra permission needed.

---

## Rust Plugins (`src-tauri/src/lib.rs`)

```rust
use tauri::Emitter;

tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .setup(|app| {
        // Open a file passed as CLI arg, e.g. `himark README.md`
        if let Some(path) = std::env::args().skip(1).find(|a| !a.starts_with('-')) {
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(300));
                handle.emit("open-file", path).ok();
            });
        }
        Ok(())
    })
    .run(tauri::generate_context!())
```

The 300 ms delay gives the WebView time to initialize before the event fires.

## File Association & CLI

- `tauri.conf.json` `bundle.fileAssociations` registers `text/markdown` for `.md`/`.markdown` extensions. When a `.deb`/AppImage is installed, Ubuntu knows Himark can open markdown files (shows in "Open With" and as default option).
- The installed binary (`/usr/bin/himark` after `.deb` install) accepts a file path as its first positional argument: `himark README.md`. The Rust `setup` hook reads it via `std::env::args()` and emits an `open-file` event.
- The frontend (`App.svelte`) listens for `"open-file"` via `listen()` from `@tauri-apps/api/event` and calls `fileStore.openPath(path)`.
- `fileStore.openPath(path)` — reads and opens a file at a given absolute path without showing a dialog. `fileStore.open()` now delegates to it after resolving the dialog.

---

## Known Gotchas

- **`svelte:window onkeydown` doesn't work** when CodeMirror has focus — it calls `stopPropagation`. Always use `window.addEventListener(..., true)` (capture phase) for app shortcuts.
- **`Ctrl+W` / `Ctrl+Q` on Linux/WebKitGTK** are intercepted at the GTK layer before JavaScript. Fix: build the menu in Rust (`tauri::menu`) inside the `.setup()` hook and call `app.set_menu(menu)`. This registers GTK accel groups synchronously before the window shows. Building from JS (`@tauri-apps/api/menu` / `setAsAppMenu()`) was tried and found unreliable on Linux.
- **Semantic HTML elements** (e.g. `<header>`) can receive conflicting UA styles from WebKitGTK. Use `<div class="header">` with explicit `flex-direction: row` instead.
- **`tauri-plugin-fs` watch** requires `features = ["watch"]` in `Cargo.toml` — without it, `watch()` calls silently fail with a "command not found" error swallowed by `.catch(() => {})`.
- **Auto-save triggering on file open**: the CodeMirror `updateListener` fires `docChanged` even for programmatic dispatches. Use `suppressChange = true` around external `view.dispatch()` calls.
- **Cursor jumping to position 0 on every keystroke**: comparing `content` prop against `view.state.doc.toString()` in a `$effect` is unreliable because Svelte may schedule the effect before CodeMirror settles. Use `lastExternalContent` as the comparison target instead.
- **`ShortcutsOverlay` backdrop**: the overlay must be rendered as a sibling in `App.svelte` (not inside `Editor.svelte`) so `position: fixed` covers the full viewport correctly.

---

## System Dependencies (Ubuntu/Debian)

```bash
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev libssl-dev libsoup-3.0-dev
```
