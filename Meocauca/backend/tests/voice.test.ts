import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerMessage, SpeechDTO } from '@shared/types';
import { DEFAULT_CONFIG, cloneConfig } from '@shared/defaults';
import { Db } from '../src/database/db';
import { Repository } from '../src/database/repository';
import { ConfigStore } from '../src/services/ConfigStore';
import { Game } from '../src/services/Game';
import { ConnectorManager } from '../src/connectors/ConnectorManager';
import { MockConnector } from '../src/connectors/MockConnector';
import { Announcer, containsBanned, speakKg, speakableName } from '../src/services/Announcer';
import { escapeSsml } from '../src/tts/TtsService';
import { Logger } from '../src/services/Logger';

Logger.quiet = true;

describe('voice text helpers', () => {
  it('cleans names for speaking', () => {
    expect(speakableName('Hồng Nhung 🌸')).toBe('Hồng Nhung');
    expect(speakableName('ღ Anh Tuấn ღ')).toBe('Anh Tuấn');
    expect(speakableName('💫Quỳnh Như')).toBe('Quỳnh Như');
    expect(speakableName('user8273615497')).toBe('bạn mới');
    expect(speakableName('minh_thu.2k5')).toBe('minh thu 2k5');
    expect([...speakableName('A'.repeat(60))].length).toBeLessThanOrEqual(24);
    expect(speakableName('✨✨✨')).toBe('');
  });

  it('reads weights with a Vietnamese decimal comma', () => {
    expect(speakKg(8.68)).toBe('8,7');
    expect(speakKg(0.53)).toBe('0,53');
    expect(speakKg(120)).toBe('120');
  });

  it('detects banned words with or without diacritics', () => {
    expect(containsBanned('Shop Quảng Cáo 24h', ['quảng cáo'])).toBe(true);
    expect(containsBanned('shopquangcao', ['quảng cáo'])).toBe(true);
    expect(containsBanned('Ngọc Anh', ['quảng cáo'])).toBe(false);
    expect(containsBanned('Ngọc Anh', [])).toBe(false);
  });

  it('escapes SSML so names cannot inject voice markup', () => {
    expect(escapeSsml('<break time="5s"/> & "x"')).toBe('&lt;break time=&quot;5s&quot;/&gt; &amp; &quot;x&quot;');
  });
});

describe('Announcer', () => {
  const settings = cloneConfig(DEFAULT_CONFIG.ui.voice);
  let out: SpeechDTO[] = [];
  const a = new Announcer(() => settings, (s) => out.push(s));
  beforeEach(() => {
    out = [];
    Object.assign(settings, cloneConfig(DEFAULT_CONFIG.ui.voice));
  });

  it('builds sentences from templates', () => {
    a.handle({ id: 'n1', kind: 'legendary', title: '', message: '', createdAt: 0, speech: { name: 'Bảo Ngọc 🐰', fish: 'Rồng Vàng', kg: 152.34 } });
    expect(out[0]).toMatchObject({ kind: 'legendary', text: 'Ôi trời ơi! Bảo Ngọc vừa câu được cá huyền thoại Rồng Vàng, nặng 152,3 ký!' });
    expect(a.get(out[0].id)).toBe(out[0].text);
    a.handle({ id: 'n2', kind: 'gift', title: '', message: '', createdAt: 0, speech: { name: 'Kenny', gift: 'Rose', count: 3 } });
    expect(out[1].text).toBe('Cảm ơn Kenny đã tặng 3 Rose!');
    expect(out[0].priority).toBeGreaterThan(out[1].priority);
  });

  it('respects per-event switches, bots, banned words and the master switch', () => {
    a.handle({ id: 'c', kind: 'catch', title: '', message: '', createdAt: 0, speech: { name: 'A', fish: 'Cá', kg: 1 } });
    expect(out).toHaveLength(0); // common catches are off by default
    settings.skipBots = true;
    a.handle({ id: 'b', kind: 'join', title: '', message: '', createdAt: 0, speech: { name: 'Bot', bot: true } });
    expect(out).toHaveLength(0);
    settings.bannedWords = ['quảng cáo'];
    a.handle({ id: 'x', kind: 'join', title: '', message: '', createdAt: 0, speech: { name: 'Quảng Cáo Shop' } });
    expect(out).toHaveLength(0);
    a.handle({ id: 'e', kind: 'join', title: '', message: '', createdAt: 0, speech: { name: '🌸🌸' } });
    expect(out).toHaveLength(0); // nothing readable left in the name
    a.handle({ id: 'i', kind: 'info', title: '', message: '', createdAt: 0 });
    expect(out).toHaveLength(0);
    settings.enabled = false;
    a.handle({ id: 'j', kind: 'join', title: '', message: '', createdAt: 0, speech: { name: 'Ngọc Anh' } });
    expect(out).toHaveLength(0);
  });
});

describe('voice announcements in the game', () => {
  let game: Game;
  let store: ConfigStore;
  let messages: ServerMessage[];
  let send: (input: Parameters<typeof MockConnector.build>[0]) => void;
  beforeEach(async () => {
    vi.useFakeTimers();
    const db = await Db.open(null);
    store = new ConfigStore(new Repository(db));
    game = new Game(store, new Repository(db));
    messages = [];
    game.setBroadcaster((m) => messages.push(m));
    const c = new ConnectorManager(game.bus, () => {});
    send = (input) => c.injectMock(MockConnector.build(input));
  });
  afterEach(() => {
    game.shutdown();
    vi.useRealTimers();
  });
  const spoken = () => messages.filter((m): m is Extract<ServerMessage, { type: 'speak' }> => m.type === 'speak').map((m) => m.speech);

  it('joins, gifts, follows, shares and catches are announced', () => {
    store.updateSection('game', { escapeChance: 0 });
    store.updateSection('ui', { voice: { events: { catch: { enabled: true } } } });
    send({ type: 'COMMENT', comment: 'câu', user: { userId: 'u1', uniqueId: 'ngocanh', nickname: 'Ngọc Anh 🌸' } });
    send({ type: 'GIFT', giftName: 'Rose', diamonds: 1, user: { userId: 'u1', uniqueId: 'ngocanh', nickname: 'Ngọc Anh 🌸' } });
    send({ type: 'FOLLOW', user: { userId: 'u2', uniqueId: 'kenny', nickname: 'Kenny' } });
    send({ type: 'SHARE', user: { userId: 'u2', uniqueId: 'kenny', nickname: 'Kenny' } });
    vi.advanceTimersByTime(30_000);
    const kinds = spoken().map((s) => s.kind);
    expect(kinds).toEqual(expect.arrayContaining(['join', 'gift', 'follow', 'share']));
    expect(kinds.some((k) => ['catch', 'rare', 'epic', 'legendary'].includes(k))).toBe(true);
    expect(spoken().find((s) => s.kind === 'join')!.text).toBe('Chào mừng Ngọc Anh đã vào hồ câu!');
  });

  it('turning the voice off stops announcements', () => {
    store.updateSection('ui', { voice: { enabled: false } });
    send({ type: 'COMMENT', comment: 'join', user: { userId: 'u1', uniqueId: 'a', nickname: 'Ngọc Anh' } });
    expect(spoken()).toHaveLength(0);
  });

  it('voice settings are sanitized', () => {
    store.updateSection('ui', { voice: { rate: 999, volume: -3, engine: 'hack', edgeVoice: '"><script>', maxQueue: 0, bannedWords: ['  ', 'abc'] } });
    const v = store.get().ui.voice;
    expect(v).toMatchObject({ rate: 50, volume: 0, engine: 'auto', edgeVoice: 'vi-VN-HoaiMyNeural', maxQueue: 1, bannedWords: ['abc'] });
    expect(v.events.join.template).toBe('Chào mừng {name} đã vào hồ câu!');
  });
});
