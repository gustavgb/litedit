<script lang="ts">
  interface Props {
    displayName: string;
    displayPath: string;
    saving: boolean;
    reloading: boolean;
    dirty: boolean;
    error: string;
    onopen: () => void;
    onshowshortcuts: () => void;
  }

  let { displayName, displayPath, saving, reloading, dirty, error, onopen, onshowshortcuts }: Props = $props();
</script>

<div class="header">
  <button
    class="file-path"
    onclick={onopen}
    title={displayPath}
    aria-label="Current file — click to open another"
  >
    <span class="file-path-short">{displayName}</span>
    <span class="file-path-full">{displayPath}</span>
  </button>

  <div class="status">
    {#if error}
      <span class="error" title={error}>⚠</span>
    {:else if reloading}
      <span class="dim">reloading…</span>
    {:else if saving}
      <span class="dim">saving…</span>
    {:else if dirty}
      <span class="dot" title="Unsaved changes">●</span>
    {/if}
  </div>

  <button class="shortcuts-btn" onclick={onshowshortcuts} title="Keyboard shortcuts" aria-label="Show keyboard shortcuts">?</button>
</div>

<style>
  .header {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    padding: 0 20px;
    height: 38px;
    flex-shrink: 0;
    background: var(--bg-header);
    border-bottom: 1px solid var(--border);
    user-select: none;
  }

  .file-path {
    position: relative;
    background: none;
    border: none;
    color: var(--text-dim);
    font-family: inherit;
    font-size: 12px;
    cursor: pointer;
    padding: 0;
    white-space: nowrap;
    overflow: visible;
    transition: color 0.15s;
  }

  .file-path:hover {
    color: var(--text-dim-hover);
  }

  .file-path-short {
    display: inline-block;
    transition: opacity 0.15s;
  }

  .file-path-full {
    position: absolute;
    left: 0;
    top: 0;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s;
  }

  .file-path:hover .file-path-short {
    opacity: 0;
  }

  .file-path:hover .file-path-full {
    opacity: 1;
    pointer-events: auto;
  }

  .status {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
    font-size: 11px;
  }

  .dot {
    color: var(--accent);
    font-size: 10px;
  }

  .dim {
    color: var(--text-dim);
  }

  .error {
    color: #e85f5f;
    cursor: help;
    font-size: 13px;
  }

  .shortcuts-btn {
    background: none;
    border: none;
    color: var(--text-dim);
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    line-height: 1;
    margin-left: 6px;
    transition: color 0.15s;
  }

  .shortcuts-btn:hover {
    color: var(--text);
  }
</style>
