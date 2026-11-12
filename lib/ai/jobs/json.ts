/**
 * Reads the first complete JSON object or array in a model reply, even with prose, a code fence or
 * extra brackets around it. Returns undefined when nothing parses, and for a cut-off reply.
 */
export function extractJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // fall through to the scan
  }
  for (let start = 0; start < text.length; start++) {
    const first = text[start];
    if (first !== "{" && first !== "[") continue;
    let depth = 0;
    let inString = false;
    let balanced = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (inString) {
        if (ch === "\\") i++;
        else if (ch === '"') inString = false;
      } else if (ch === '"') {
        inString = true;
      } else if (ch === "{" || ch === "[") {
        depth++;
      } else if (ch === "}" || ch === "]") {
        depth--;
        if (depth === 0) {
          balanced = true;
          try {
            return JSON.parse(text.slice(start, i + 1));
          } catch {
            // try the next start
          }
          break;
        }
      }
    }
    // The text ended before this start closed: a cut-off reply, so never return an inner fragment.
    if (!balanced) return undefined;
  }
  return undefined;
}

/** Keeps the first `max` words of plain text, or null when it is empty. */
export function limitWords(text: string, max: number): string | null {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  return words.slice(0, max).join(" ");
}
