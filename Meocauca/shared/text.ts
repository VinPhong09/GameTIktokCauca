/** Lower-case, strip Vietnamese diacritics and punctuation so "Câu Cá!!" → "cau ca". */
export function normalizeText(input: string): string {
  return (input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Returns true if the comment equals a command or starts with it as a whole word. */
export function matchesCommand(comment: string, commands: string[]): boolean {
  const text = normalizeText(comment);
  if (!text) return false;
  return commands.some((c) => {
    const cmd = normalizeText(c);
    return !!cmd && (text === cmd || text.startsWith(cmd + ' '));
  });
}

export function formatKg(kg: number): string {
  if (kg >= 1000) return (kg / 1000).toFixed(2) + ' tấn';
  return (kg >= 100 ? kg.toFixed(0) : kg.toFixed(kg >= 10 ? 1 : 2)) + ' kg';
}

export function shortName(name: string, max = 14): string {
  const n = (name || '').trim();
  return n.length > max ? n.slice(0, max - 1) + '…' : n;
}
