/** Models sometimes wrap JSON in a code fence or a sentence, so fall back to the outer brackets. */
export function extractJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // fall through to the substring attempt
  }
  const starts = [text.indexOf("{"), text.indexOf("[")].filter((i) => i >= 0);
  if (!starts.length) return undefined;
  const start = Math.min(...starts);
  const end = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  if (end <= start) return undefined;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

/** Keeps the first `max` words of plain text, or null when it is empty. */
export function limitWords(text: string, max: number): string | null {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  return words.slice(0, max).join(" ");
}
