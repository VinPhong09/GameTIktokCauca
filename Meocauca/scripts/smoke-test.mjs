// End-to-end smoke test: boots the real server (port 3999, in-memory DB), drives it through
// the mock provider (same pipeline as TikTok), and checks WebSocket + REST results.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'backend', 'package.json'));
const WebSocket = require('ws');
const PORT = 3999;
const BASE = `http://127.0.0.1:${PORT}`;

const server = spawn(process.execPath, [path.join(root, 'backend/node_modules/tsx/dist/cli.mjs'), path.join(root, 'backend/src/index.ts')], {
  cwd: path.join(root, 'backend'),
  env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DB_FILE: ':memory:' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = async (method, url, body) => {
  const res = await fetch(BASE + '/api' + url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  return res.json();
};
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

async function main() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE + '/api/health');
      if (r.ok) break;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  check('server boots', (await api('GET', '/health')).ok === true);

  const page = await fetch(BASE + '/game').then((r) => r.text()).catch(() => '');
  check('/game serves the app', page.includes('<div id="root">'), page ? '' : 'frontend/dist missing?');
  const admin = await fetch(BASE + '/admin').then((r) => r.status);
  const overlay = await fetch(BASE + '/overlay').then((r) => r.status);
  check('/admin and /overlay routes', admin === 200 && overlay === 200);

  const msgs = [];
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?role=admin`);
  ws.on('message', (d) => msgs.push(JSON.parse(String(d))));
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  await sleep(300);
  check('websocket snapshot', msgs.some((m) => m.type === 'snapshot'));

  await api('PATCH', '/config/game', { escapeChance: 0, waitMinSec: 0.5, waitMaxSec: 0.5, commandCooldownSec: 0 });
  const alice = { userId: 'u_alice', uniqueId: 'alice', nickname: 'Alice' };
  await api('POST', '/mock/event', { type: 'COMMENT', comment: 'câu cá', user: alice });
  await sleep(300);
  const cycle = msgs.find((m) => m.type === 'fishing_cycle' && m.cycle.playerId === 'u_alice');
  check('comment "câu" → cat joins + casts', !!cycle, cycle ? `rolled ${cycle.cycle.catch?.rarity} ${cycle.cycle.catch?.fishId}` : '');
  for (let i = 0; i < 40 && !msgs.some((m) => m.type === 'catch_result' && m.result.playerId === 'u_alice'); i++) await sleep(250);
  const caught = msgs.find((m) => m.type === 'catch_result' && m.result.playerId === 'u_alice');
  check('catch committed at reveal', !!caught && caught.result.fishId === cycle?.cycle.catch?.fishId, caught ? `${caught.result.weight} kg` : 'timeout');

  await api('POST', '/mock/event', { type: 'GIFT', giftName: 'Doughnut', diamonds: 30, user: alice });
  await sleep(200);
  const players = await api('GET', '/players');
  const a = players.active.find((p) => p.id === 'u_alice');
  check('gift Doughnut → luck x2 × personal luck', a && Math.abs(a.luck - 2 * a.personalLuck) < 0.011, a ? `luck=${a.luck} personal=x${a.personalLuck} attempts=${a.boostAttempts}` : '');

  await api('POST', '/players/u_alice/luck', { luck: 1.5, persist: true });
  await sleep(150);
  const a2 = (await api('GET', '/players')).active.find((p) => p.id === 'u_alice');
  check('admin sets a cat luck', a2 && a2.personalLuck === 1.5 && a2.personalLuckSource === 'fixed' && Math.abs(a2.luck - 3) < 0.011, a2 ? `luck=${a2.luck} (${a2.personalLuckSource})` : '');
  await api('POST', '/players/u_alice/luck', { luck: null });

  await api('POST', '/mock/event', { type: 'FOLLOW', user: { userId: 'u_dup', uniqueId: 'dup', nickname: 'Dup' }, id: 'same-id' });
  await api('POST', '/mock/event', { type: 'FOLLOW', user: { userId: 'u_dup', uniqueId: 'dup', nickname: 'Dup' }, id: 'same-id' });
  const stats = await api('GET', '/stats');
  check('duplicate events dropped', stats.duplicatesDropped >= 1);

  await api('POST', '/mock/event', { type: 'LIKE', likeCount: 1200, user: alice });
  await sleep(200);
  const ev = await api('GET', '/events');
  check('likes → community challenge event', ev.active.some((e) => e.eventId === 'community-challenge'));

  await api('POST', '/mock/event', { type: 'SHARE', user: alice });
  await sleep(400);
  const comm = msgs.filter((m) => m.type === 'community').pop();
  check('share → community luck bonus', comm && comm.community.shareBonus > 0);

  const lb = await api('GET', '/leaderboard');
  check('leaderboard updated', lb.weight[0]?.playerId === 'u_alice');

  await api('PATCH', '/config/game', { maxPlayers: 10 });
  await api('POST', '/mock/spawn', { count: 15, fish: false });
  await sleep(400);
  const after = await api('GET', '/players');
  check('pond full → waiting queue', after.queue.length > 0, `seated=${after.active.filter((p) => p.seat !== null).length} queue=${after.queue.length}`);

  await api('POST', '/game/pause');
  const before = msgs.filter((m) => m.type === 'fishing_cycle').length;
  await api('POST', '/mock/event', { type: 'COMMENT', comment: 'câu', user: { userId: 'u_p', uniqueId: 'p', nickname: 'P' } });
  await sleep(300);
  check('paused game ignores casts', msgs.filter((m) => m.type === 'fishing_cycle').length === before);
  await api('POST', '/game/resume');

  const prob = await api('GET', '/probability?luck=3');
  const sum = Object.values(prob.distribution).reduce((s, v) => s + v, 0);
  check('probability API sums to 100%', Math.abs(sum - 1) < 1e-9);

  ws.close();
}

main()
  .catch((e) => {
    console.error(e);
    results.push({ name: 'exception', ok: false });
  })
  .finally(() => {
    server.kill();
    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} smoke checks passed`);
    if (failed.length) {
      console.log('--- server log ---\n' + serverLog.slice(-3000));
      process.exit(1);
    }
    process.exit(0);
  });
