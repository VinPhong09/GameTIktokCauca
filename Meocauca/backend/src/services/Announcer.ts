import type { NotificationDTO, NotificationKind, SpeechDTO, VoiceEventKind, VoiceSettings } from '@shared/types';
import { normalizeText } from '@shared/text';
import { uid } from '../settings';

const KIND_MAP: Partial<Record<NotificationKind, VoiceEventKind>> = {
  join: 'join', follow: 'follow', gift: 'gift', share: 'share', catch: 'catch', rare: 'rare',
  epic: 'epic', legendary: 'legendary', fail: 'fail', leave: 'leave', event: 'event',
};

/** Higher = kept first when the client's queue is full. */
export const VOICE_PRIORITY: Record<VoiceEventKind, number> = {
  legendary: 6, epic: 5, event: 4, gift: 4, rare: 3, follow: 2, share: 2, join: 1, catch: 0, fail: 0, leave: 0,
};

/**
 * Turns a viewer nickname into something safe and natural to read aloud:
 * emoji / decorations removed, "user123…" → "bạn mới", separators → spaces, max 24 characters.
 */
export function speakableName(raw: string | undefined): string {
  let n = (raw ?? '').normalize('NFC');
  if (/^\s*user\d{5,}\s*$/i.test(n)) return 'bạn mới';
  n = n
    .replace(/[._]+/g, ' ')
    // Keep Latin letters (incl. Vietnamese), digits and marks: drops emoji, symbols and decorative
    // letters from other scripts (ღ, ꧁ …) that a Vietnamese voice can't read anyway.
    .replace(/[^\p{Script=Latin}\p{M}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const chars = [...n];
  if (chars.length > 24) n = chars.slice(0, 24).join('').trim();
  return n;
}

/** 8.68 → "8,7" · 0.53 → "0,53" (Vietnamese decimal comma, short). */
export function speakKg(kg: number | undefined): string {
  if (kg === undefined || !Number.isFinite(kg)) return '';
  const v = kg >= 1 ? Math.round(kg * 10) / 10 : Math.round(kg * 100) / 100;
  return String(v).replace('.', ',');
}

export function containsBanned(text: string, banned: string[]): boolean {
  const t = ` ${normalizeText(text)} `;
  const flat = t.replace(/\s/g, '');
  return banned.some((w) => {
    const b = normalizeText(w);
    return !!b && (t.includes(` ${b} `) || (b.length >= 4 && flat.includes(b.replace(/\s/g, ''))));
  });
}

export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '').replace(/\s+/g, ' ').trim();
}

/** Builds spoken sentences from game notifications and remembers them for the TTS endpoint. */
export class Announcer {
  private texts = new Map<string, string>();

  constructor(private settings: () => VoiceSettings, private broadcast: (s: SpeechDTO) => void) {}

  /** Text for a speech id (null when unknown / expired). */
  get(id: string): string | null {
    return this.texts.get(id) ?? null;
  }

  /** Returns the sentence that would be spoken for a notification (null = nothing to read). */
  compose(n: Pick<NotificationDTO, 'kind' | 'speech'>): { kind: VoiceEventKind; text: string } | null {
    const v = this.settings();
    if (!v.enabled) return null;
    const kind = KIND_MAP[n.kind];
    if (!kind) return null;
    const ev = v.events[kind];
    if (!ev?.enabled || !ev.template.trim()) return null;
    const sp = n.speech ?? {};
    if (sp.bot && v.skipBots) return null;
    const name = speakableName(sp.name);
    if (ev.template.includes('{name}') && !name) return null;
    if (sp.name && containsBanned(sp.name, v.bannedWords)) return null;
    const gift = sp.gift ? ((sp.count ?? 1) > 1 ? `${sp.count} ${sp.gift}` : sp.gift) : '';
    const text = fillTemplate(ev.template, { name, fish: sp.fish ?? '', kg: speakKg(sp.kg), gift, event: sp.event ?? '' });
    return text ? { kind, text: text.slice(0, 220) } : null;
  }

  handle(n: NotificationDTO) {
    const c = this.compose(n);
    if (!c) return;
    const speech: SpeechDTO = { id: uid('v'), text: c.text, kind: c.kind, priority: VOICE_PRIORITY[c.kind], createdAt: Date.now() };
    this.texts.set(speech.id, speech.text);
    if (this.texts.size > 300) this.texts.delete(this.texts.keys().next().value as string);
    this.broadcast(speech);
  }
}
