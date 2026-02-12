let fullText = '';

function normalizeText(input: string): string {
  // Trim and collapse whitespace so overlap detection is more reliable.
  return input.replace(/\s+/g, ' ').trim();
}

function ensureTrailingSpaceOrPunctuation(text: string): string {
  if (!text) return '';
  const last = text[text.length - 1];
  if (/[.!?]$/.test(last)) {
    return text + ' ';
  }
  if (last === ' ') return text;
  return text + ' ';
}

function findOverlapSuffixLength(
  existing: string,
  incoming: string,
  maxOverlap = 200,
  minOverlap = 10,
): number {
  const max = Math.min(maxOverlap, existing.length, incoming.length);
  for (let len = max; len >= minOverlap; len--) {
    const suffix = existing.slice(existing.length - len);
    const prefix = incoming.slice(0, len);
    if (suffix === prefix) {
      return len;
    }
  }
  return 0;
}

export function wrapTextToLines(
  text: string,
  minWidth = 70,
  maxWidth = 100,
  maxLines = 200,
): string[] {
  const clean = text.trim();
  if (!clean) return [];

  // Simple tokenization on whitespace; punctuation stays attached to words.
  const tokens = clean.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const token of tokens) {
    if (!token) continue;
    const candidate = current ? `${current} ${token}` : token;

    if (candidate.length <= maxWidth) {
      current = candidate;
    } else if (!current) {
      // Single token longer than maxWidth; force it into its own line.
      lines.push(token);
      current = '';
    } else {
      // Current line is as full as we want; move to next.
      lines.push(current);
      current = token;
    }
  }

  if (current) {
    lines.push(current);
  }

  // Keep only the most recent lines to avoid unbounded growth.
  if (lines.length > maxLines) {
    return lines.slice(-maxLines);
  }

  return lines;
}

export function resetCaptions() {
  fullText = '';
}

export function appendTranscriptionChunk(rawChunk: string): string[] {
  if (!rawChunk) {
    return wrapTextToLines(fullText);
  }

  let incoming = normalizeText(rawChunk);
  if (!incoming) {
    return wrapTextToLines(fullText);
  }

  // Normalize existing buffer once and reuse.
  if (fullText) {
    fullText = normalizeText(fullText);
  }

  // If incoming chunk is entirely contained at the end, ignore it.
  const overlapLen = fullText
    ? findOverlapSuffixLength(fullText, incoming)
    : 0;

  if (overlapLen > 0) {
    incoming = incoming.slice(overlapLen).trimStart();
  }

  // If nothing new remains or it is extremely short and already present, skip.
  if (!incoming || (incoming.length < 3 && fullText.endsWith(incoming))) {
    return wrapTextToLines(fullText);
  }

  // Append with reasonable spacing.
  if (!fullText) {
    fullText = incoming;
  } else {
    const existingPrepared = ensureTrailingSpaceOrPunctuation(fullText);
    fullText = existingPrepared + incoming;
  }

  return wrapTextToLines(fullText);
}

