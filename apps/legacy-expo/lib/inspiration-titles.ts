const DESCRIPTION_SEPARATORS = [" — ", " – ", " - "] as const;

/**
 * Keeps only the title/name from inspiration list entries that include
 * a trailing description after an em/en dash (e.g. films, books).
 */
export function stripInspirationDescription(entry: string): string {
  const trimmed = entry.trim();
  if (!trimmed) return trimmed;

  let lastIndex = -1;
  let lastLength = 0;

  for (const separator of DESCRIPTION_SEPARATORS) {
    const index = trimmed.lastIndexOf(separator);
    if (index > lastIndex) {
      lastIndex = index;
      lastLength = separator.length;
    }
  }

  if (lastIndex <= 0) return trimmed;

  const title = trimmed.slice(0, lastIndex).trim();
  return title || trimmed;
}

export function formatInspirationList(items: string[]): string {
  return items.map(stripInspirationDescription).join(", ");
}
