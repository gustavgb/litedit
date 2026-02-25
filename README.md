# Text Editor

A minimalist markdown editor built with Tauri V2 + Svelte 5 + CodeMirror 6.

## Features

- Syntax highlighting for Markdown via CodeMirror 6 (Lezer parser)
- Syntax highlighting inside fenced code blocks (50+ languages, lazy-loaded)
- Auto-save with 1.5 s debounce
- File link autocomplete: type `[text](` to search for files relative to the open document
- Minimal chrome — just a path header and the editor
- Keyboard shortcuts:
  - `Ctrl+O` — Open file
  - `Ctrl+S` — Save
  - `Ctrl+Shift+S` — Save As

## Prerequisites

### Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
```

### System libraries (Linux)

```bash
# Ubuntu / Debian
sudo apt update && sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf \
  libssl-dev \
  build-essential \
  curl \
  wget \
  file \
  libgtk-3-dev
```

### Node.js ≥ 18

## Development

```bash
npm install
npm run tauri dev
```

## Production build

```bash
npm run tauri build
```

The packaged app will be in `src-tauri/target/release/bundle/`.

## Project structure

```
├── src/                  # Svelte 5 frontend
│   ├── main.ts           # Entry point
│   ├── app.css           # Global styles
│   ├── App.svelte        # Root component (file I/O, keyboard shortcuts)
│   └── lib/
│       └── Editor.svelte # CodeMirror 6 editor with link autocomplete
├── src-tauri/            # Rust / Tauri backend
│   ├── src/
│   │   ├── main.rs
│   │   └── lib.rs
│   ├── capabilities/
│   │   └── default.json  # FS & dialog permissions
│   └── tauri.conf.json
├── index.html
├── vite.config.ts
└── package.json
```
