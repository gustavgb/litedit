<script lang="ts">
  import { getVersion } from "@tauri-apps/api/app";

  interface Props { onclose: () => void; }
  let { onclose }: Props = $props();

  let version = $state("");
  getVersion().then((v) => (version = v));

  function onkeydown(e: KeyboardEvent) {
    if (e.key === "Escape") onclose();
  }
</script>

<svelte:window {onkeydown} />

<div
  class="backdrop"
  role="button"
  tabindex="0"
  aria-label="Close keyboard shortcuts"
  onclick={onclose}
  onkeydown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onclose();
    }
  }}
>
  <div
    class="panel"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
    role="dialog"
    aria-modal="true"
    aria-label="Keyboard shortcuts"
    tabindex="-1"
  >
    <div class="panel-header">
      <span>Keyboard shortcuts</span>
      <span class="version">{version ? `Litedit v${version}` : ""}</span>
      <button class="close" onclick={onclose} aria-label="Close">✕</button>
    </div>

    <div class="groups">
      <section>
        <h3>File</h3>
        <dl>
          <dt><kbd>Ctrl</kbd><kbd>O</kbd></dt><dd>Open file</dd>
          <dt><kbd>Ctrl</kbd><kbd>W</kbd></dt><dd>Close file</dd>
          <dt><kbd>Ctrl</kbd><kbd>Q</kbd></dt><dd>Quit</dd>
          <dt><kbd>Ctrl</kbd><kbd>S</kbd></dt><dd>Save</dd>
          <dt><kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>S</kbd></dt><dd>Save as…</dd>
        </dl>
      </section>

      <section>
        <h3>Edit</h3>
        <dl>
          <dt><kbd>Ctrl</kbd><kbd>Z</kbd></dt><dd>Undo</dd>
          <dt><kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>Z</kbd></dt><dd>Redo</dd>
          <dt><kbd>Tab</kbd></dt><dd>Indent</dd>
          <dt><kbd>Shift</kbd><kbd>Tab</kbd></dt><dd>Outdent</dd>
        </dl>
      </section>

      <section>
        <h3>Other</h3>
        <dl>
          <dt><kbd>Esc</kbd></dt><dd>Close overlay</dd>
        </dl>
      </section>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(2px);
  }

  .panel {
    background: var(--bg-header);
    border: 1px solid var(--border);
    border-radius: 8px;
    width: 380px;
    max-width: 90vw;
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
  }

  .version {
    margin-left: auto;
    font-size: 11px;
    font-weight: 400;
    color: var(--text-dim);
    margin-right: 8px;
  }

  .close {
    background: none;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    font-size: 13px;
    padding: 2px 4px;
    line-height: 1;
    border-radius: 4px;
    transition: color 0.1s;
  }

  .close:hover {
    color: var(--text);
  }

  .groups {
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  section h3 {
    margin: 0 0 6px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-dim);
  }

  dl {
    margin: 0;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 12px;
    align-items: center;
  }

  dt {
    display: flex;
    gap: 3px;
    justify-content: flex-start;
  }

  dd {
    margin: 0;
    font-size: 12px;
    color: var(--text);
  }

  kbd {
    display: inline-block;
    padding: 1px 5px;
    font-size: 10px;
    font-family: var(--font-mono);
    color: var(--text);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 4px;
    line-height: 1.6;
  }
</style>
