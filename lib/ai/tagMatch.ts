const isWordChar = (ch: string | undefined) => ch !== undefined && /[\p{L}\p{N}]/u.test(ch);

/**
 * Finds an existing tag in text without a model call. The longest name wins so
 * "k guard" beats "guard"; the scan avoids building RegExps from user strings.
 */
export function matchTag(
  text: string,
  tagNames: readonly string[],
  normalize?: (text: string) => string,
): string | null {
  const haystack = (normalize ? normalize(text) : text).toLowerCase();
  let best: { name: string; length: number; position: number } | null = null;
  for (const name of tagNames) {
    const needle = name.toLowerCase();
    if (!needle) continue;
    let from = 0;
    let position = -1;
    for (;;) {
      const at = haystack.indexOf(needle, from);
      if (at === -1) break;
      if (!isWordChar(haystack[at - 1]) && !isWordChar(haystack[at + needle.length])) {
        position = at;
        break;
      }
      from = at + 1;
    }
    if (position === -1) continue;
    if (
      !best ||
      needle.length > best.length ||
      (needle.length === best.length && position < best.position)
    ) {
      best = { name, length: needle.length, position };
    }
  }
  return best ? best.name : null;
}
