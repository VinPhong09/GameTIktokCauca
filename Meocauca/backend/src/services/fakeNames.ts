import type { LiveUser } from '@shared/types';

/**
 * Realistic Vietnamese TikTok viewer names for the Mock simulator.
 * Mixes the styles people really use: real names, lowercase, emoji decorations, birth-year tags,
 * pet nicknames, English names, TikTok's default "user123…" and short "status" nicknames.
 */

const SURNAMES = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý', 'Đinh', 'Trương', 'Mai', 'Tô'];
const MIDDLE_M = ['Văn', 'Đức', 'Minh', 'Quốc', 'Hữu', 'Thành', 'Công', 'Gia', 'Hoàng', 'Tuấn'];
const MIDDLE_F = ['Thị', 'Ngọc', 'Thu', 'Thanh', 'Bảo', 'Khánh', 'Phương', 'Minh', 'Mỹ', 'Hồng'];

/** Common two-word given names people show on TikTok. */
const GIVEN_M = [
  'Minh Quân', 'Hoàng Long', 'Gia Huy', 'Đức Anh', 'Tuấn Kiệt', 'Quang Huy', 'Minh Khang', 'Bảo Nam', 'Thành Đạt', 'Hải Đăng',
  'Văn Toàn', 'Nhật Minh', 'Trung Kiên', 'Anh Tuấn', 'Đức Mạnh', 'Quốc Bảo', 'Hữu Phước', 'Minh Trí', 'Tiến Dũng', 'Duy Khánh',
];
const GIVEN_F = [
  'Ngọc Anh', 'Minh Thư', 'Thảo Vy', 'Phương Linh', 'Khánh Linh', 'Bảo Ngọc', 'Thu Hà', 'Lan Anh', 'Thuý Hằng', 'Mai Anh',
  'Hà My', 'Quỳnh Như', 'Diệu Linh', 'Thanh Trúc', 'Yến Nhi', 'Kim Ngân', 'Trâm Anh', 'Gia Hân', 'Ngọc Hân', 'Tường Vi',
  'Mỹ Duyên', 'Thanh Hương', 'Bích Ngọc', 'Hồng Nhung', 'Cẩm Tú',
];
const SINGLE = ['Huy', 'Linh', 'Trang', 'Nam', 'Vy', 'Hùng', 'My', 'Tú', 'Ngân', 'Phúc', 'Hân', 'Khoa', 'Nhi', 'Bảo', 'Thư', 'Quân', 'Trinh', 'Long'];
const PET = ['Bé Su', 'Bánh Bao', 'Mỡ', 'Su Kem', 'Cún Con', 'Bé Bông', 'Gấu Mập', 'Heo Con', 'Bé Na', 'Mochi', 'Bắp', 'Tôm Tít', 'Bé Mây', 'Sún', 'Bé Ốc'];
const ENGLISH = ['Kenny', 'Jenny', 'Tony', 'Hana', 'Bella', 'Kevin', 'Lily', 'Jack', 'Vivian', 'Andy', 'Rosie', 'Daniel', 'Cindy', 'Leo', 'Mia', 'Ken'];
const STATUS = [
  'Thích Câu Cá', 'Chill cùng tui', 'Buồn ngủ quá', 'Ăn hại nhưng xinh', 'Hay ghé live', 'Mê mèo', 'Đi ngang qua',
  'Fan cứng', 'Cá ơi cắn câu', 'Người qua đường', 'Ngủ sớm đi',
];
const EMOJI = ['🌸', '✨', '🐰', '💕', '🍀', '⭐', '🌙', '🦋', '🎀', '🐟', '🌻', '🐱', '💫', '🍓'];

const rnd = (n: number) => Math.floor(Math.random() * n);
const pick = <T>(a: T[]) => a[rnd(a.length)];
const chance = (p: number) => Math.random() < p;

function stripVi(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function given(): { name: string; female: boolean } {
  const female = chance(0.55);
  return { name: pick(female ? GIVEN_F : GIVEN_M), female };
}

function birthTag() {
  return pick(['2k5', '2k6', '2k7', '2k8', '2k4', '2k3', '99', '98', '03', '05', '09']);
}

/** One display name in a random real-world style. */
export function randomNickname(): string {
  const r = Math.random() * 100;
  if (r < 22) return given().name; // "Ngọc Anh"
  if (r < 32) {
    const g = given();
    return `${pick(SURNAMES)} ${chance(0.4) ? pick(g.female ? MIDDLE_F : MIDDLE_M) + ' ' : ''}${g.name.split(' ')[1]}`; // "Nguyễn Văn Tùng"
  }
  if (r < 42) return given().name.toLowerCase(); // "thuý hằng"
  if (r < 56) {
    const e = pick(EMOJI);
    const n = chance(0.5) ? given().name : pick(SINGLE);
    return pick([`${n} ${e}`, `${n} ${e}`, `${n} ${e}${e}`, `${e} ${n} ${e}`, `${e}${n}`, `ღ ${n} ღ`]); // "Minh Thư 🌸"
  }
  if (r < 66) return `${chance(0.5) ? pick(SINGLE) : given().name} ${birthTag()}`; // "Huy 2k7"
  if (r < 74) return chance(0.3) ? `${pick(PET)} ${pick(EMOJI)}` : pick(PET); // "Bánh Bao"
  if (r < 86) return chance(0.5) ? `${pick(ENGLISH)} ${pick(SURNAMES)}` : pick(ENGLISH); // "Jenny Trần"
  if (r < 92) return `user${1000000000 + rnd(8999999999)}`; // TikTok default name (~6%)
  return pick(STATUS);
}

/** TikTok-style @handle derived from the display name (or "user…" kept as is). */
export function handleFor(nickname: string): string {
  if (/^user\d+$/.test(nickname)) return nickname;
  const base = stripVi(nickname)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
    .replace(/\s+/g, chance(0.5) ? '.' : chance(0.5) ? '_' : '');
  const safe = base || 'viewer';
  // Names that already carry a number ("Huy 2k7") rarely get another one.
  const hasNumber = /\d/.test(safe);
  const r = Math.random();
  const suffix = hasNumber || r < 0.35 ? '' : r < 0.65 ? String(rnd(10000)) : r < 0.8 ? '.' + birthTag() : r < 0.9 ? '_' + birthTag() : '_' + rnd(100);
  return (safe + suffix).slice(0, 24);
}

const recent: string[] = [];

/** A fresh simulated viewer: realistic nickname, @handle and a long numeric TikTok-like user id. */
export function randomViewer(): LiveUser {
  let nickname = randomNickname();
  // Avoid showing the same name twice in a short window (looks fake).
  for (let i = 0; i < 6 && recent.includes(nickname); i++) nickname = randomNickname();
  recent.push(nickname);
  if (recent.length > 150) recent.shift();
  const userId = '7' + String(rnd(1e9)).padStart(9, '0') + String(rnd(1e9)).padStart(9, '0');
  return { userId, uniqueId: handleFor(nickname), nickname, bot: true };
}
