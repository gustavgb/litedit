import { EditorView } from "@codemirror/view";
import { type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { readDir } from "@tauri-apps/plugin-fs";

/**
 * Creates a CodeMirror completion source that looks for files relative to the
 * currently open file when the cursor is inside a Markdown link target `](...`.
 *
 * @param getFilePath - reactive getter for the current file path
 */
export function createLinkCompletion(getFilePath: () => string) {
  return async function fileLinkCompletion(
    context: CompletionContext
  ): Promise<CompletionResult | null> {
    const match = context.matchBefore(/\]\([^)\n]*/);
    if (!match) return null;
    if (match.text.length === 2 && !context.explicit) return null;

    const partial = match.text.slice(2);
    const filePath = getFilePath();
    const baseDir = filePath
      ? filePath.substring(0, filePath.lastIndexOf("/"))
      : null;
    if (!baseDir) return null;

    const lastSlash = partial.lastIndexOf("/");
    const dirSuffix = lastSlash >= 0 ? partial.slice(0, lastSlash) : "";
    const filePrefix = lastSlash >= 0 ? partial.slice(lastSlash + 1) : partial;
    const searchDir = dirSuffix ? `${baseDir}/${dirSuffix}` : baseDir;

    try {
      const entries = await readDir(searchDir);
      const options = entries
        .filter(
          (e) =>
            e.name &&
            !e.name.startsWith(".") &&
            e.name.toLowerCase().startsWith(filePrefix.toLowerCase())
        )
        .map((e) => {
          const suffix = e.isDirectory ? "/" : "";
          const label = dirSuffix
            ? `${dirSuffix}/${e.name}${suffix}`
            : `${e.name}${suffix}`;
          return {
            label,
            type: e.isDirectory ? "namespace" : "text",
            apply: e.isDirectory
              ? (view: EditorView, _: unknown, from: number, to: number) => {
                view.dispatch({
                  changes: { from, to, insert: label },
                  selection: { anchor: from + label.length },
                });
                setTimeout(
                  () =>
                    view.dispatch({
                      effects: EditorView.scrollIntoView(
                        view.state.selection.main.head
                      ),
                    }),
                  0
                );
              }
              : undefined,
          };
        });

      if (options.length === 0) return null;
      return { from: match.from + 2, options, filter: false };
    } catch {
      return null;
    }
  };
}
