/** The slice of Obsidian's `App` the vault graph tools read. `App` satisfies it structurally. */
export interface VaultGraphSource {
  readonly vault: {
    getAbstractFileByPath(path: string): { path: string } | null;
  };
  readonly metadataCache: {
    readonly resolvedLinks: Record<string, Record<string, number>>;
    getFirstLinkpathDest(linkpath: string, sourcePath: string): { path: string } | null;
  };
}

export interface BacklinkEntry {
  readonly path: string;
  /** How many links in the source note point at the target. */
  readonly count: number;
}

export interface BacklinksResult {
  readonly path: string;
  readonly backlinks: readonly BacklinkEntry[];
}

export class VaultNoteNotFoundError extends Error {
  constructor(note: string) {
    super(`No note or file found for "${note}". Pass a vault-relative path or a note name.`);
    this.name = 'VaultNoteNotFoundError';
  }
}

function isFile(entry: { path: string } | null): entry is { path: string } {
  return entry !== null && 'extension' in entry;
}

/** Resolves a vault-relative path (with or without `.md`) or a link-style note name to a file path. */
export function resolveVaultFilePath(source: VaultGraphSource, note: string): string {
  const requested = note.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (requested) {
    for (const candidate of [requested, `${requested}.md`]) {
      const file = source.vault.getAbstractFileByPath(candidate);
      if (isFile(file)) return file.path;
    }
    const linked = source.metadataCache.getFirstLinkpathDest(requested, '');
    if (isFile(linked)) return linked.path;
  }
  throw new VaultNoteNotFoundError(note);
}

/** Notes that link to `note`, from Obsidian's resolved-link index (the same data as the Backlinks pane). */
export function getBacklinks(source: VaultGraphSource, note: string): BacklinksResult {
  const path = resolveVaultFilePath(source, note);
  const backlinks: BacklinkEntry[] = [];
  for (const [sourcePath, targets] of Object.entries(source.metadataCache.resolvedLinks)) {
    const count = targets[path];
    if (count > 0) backlinks.push({ path: sourcePath, count });
  }
  backlinks.sort((a, b) => a.path.localeCompare(b.path));
  return { path, backlinks };
}
