#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 悦星野

// use.cjs —— 切角色（把种子状态＋核锁＋快照 三件一起换）
//
// ★ 为什么要有它：五个角色的状态是分文件存的（sprout.<角色>.json），
//   可 `grow.cjs` 只认 `sprout.json` 和 `.core.lock.json` 这一对。
//   **手动拷容易漏**——漏了核锁，`grow` 就会报「种皮破了」，那其实是自己的手抖。
//
// 用法：
//   node use.cjs --list          看有哪些角色、各自多少代、有没有锁
//   node use.cjs lucia          切到 lucia（自动备份当前三件，失败自动回滚）
//
// 规矩：
//   1. ★ 只换「状态／核锁／快照」三件，**不动 core.md／skin.md／grow.cjs**
//   2. ★ 切之前必须核得上：sprout 的 core 要和锁里的 core 逐字一致，不一致就拒切
//   3. ★ 每次都备份到 .switch-backup-<时间戳>，回滚一条命令的事

const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const CUR_SEED = path.join(DIR, 'sprout.json');
const CUR_LOCK = path.join(DIR, '.core.lock.json');
const CUR_SNAP = path.join(DIR, '.snapshot.json');

// 当前是哪个角色（按核认，不靠记性）
function activeName(core) {
  if (!core) return '';
  for (const f of fs.readdirSync(DIR)) {
    const m = f.match(/^sprout\.(.+)\.json\$/);
    if (!m) continue;
    const j = readJSON(path.join(DIR, f));
    if (j && same(j.core, core)) return m[1];
  }
  return '';
}

const readJSON = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const exists = (p) => fs.existsSync(p);
// ★ 比核要用「规范串」：键序不同但内容一样得算相等（踩过：selina 的锁和状态键序不一样）
function stable(x) {
  if (Array.isArray(x)) return '[' + x.map(stable).join(',') + ']';
  if (x && typeof x === 'object') {
    return '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + stable(x[k])).join(',') + '}';
  }
  return JSON.stringify(x);
}
const same = (a, b) => stable(a) === stable(b);

function candidates() {
  const out = [];
  for (const f of fs.readdirSync(DIR)) {
    const m = f.match(/^sprout\.(.+)\.json$/);
    if (!m) continue;
    const name = m[1];
    const seed = readJSON(path.join(DIR, f));
    if (!seed) continue;
    const lockPath = findLock(name, seed.core);
    const lock = lockPath ? readJSON(lockPath) : null;
    out.push({
      名: name,
      代: seed.gen ?? 0,
      阶段: seed.stage ?? 0,
      trait: Object.keys(seed.trait || {}).length,
      卡: (seed.cards || []).length,
      锁: !!lock,
      锁文件: lockPath ? path.basename(lockPath) : '',
      对得上: !!lock && same(lock.core, seed.core),
    });
  }
  return out;
}

// ★ 核锁怎么找：先按名字（含短名），再按「哪把锁和这份状态的核逐字一致」——
//   因为真正要紧的是"有没有一把锁能对上"，不是文件名对不对。
function findLock(name, core) {
  const exact = path.join(DIR, `.core.lock.${name}.json`);
  if (exists(exact) && same(readJSON(exact).core, core)) return exact;
  const short = path.join(DIR, `.core.lock.${name.split('-')[0]}.json`);
  if (exists(short) && same(readJSON(short).core, core)) return short;
  for (const f of fs.readdirSync(DIR)) {
    if (!/^\.core\.lock.*\.json$/.test(f)) continue;
    const p = path.join(DIR, f);
    const j = readJSON(p);
    if (j && same(j.core, core)) return p;
  }
  return null;
}

function activeCore() {
  const s = readJSON(CUR_SEED);
  return s ? s.core : null;
}

function list() {
  const cur = activeCore();
  const rows = candidates();
  const pad = (t, n) => String(t).padEnd(n, ' ');
  console.log('== 可切的角色 ==');
  console.log(pad('名', 18) + pad('代', 6) + pad('阶', 5) + pad('trait', 7) + pad('卡', 6) + pad('锁', 5) + '核');
  for (const r of rows) {
    const isCur = same(readJSON(path.join(DIR, `sprout.${r.名}.json`)).core, cur);
    console.log(
      pad((isCur ? '★ ' : '  ') + r.名, 18) + pad(r.代, 6) + pad(r.阶段, 5) + pad(r.trait, 7) + pad(r.卡, 6) +
      pad(r.锁 ? '有' : '无', 5) + (r.对得上 ? '对得上' : '对不上')
    );
  }
  console.log('★ ＝ 现在正在用的那个');
}

function backup() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = path.join(DIR, `.switch-backup-${ts}`);
  fs.mkdirSync(dir, { recursive: true });
  for (const [src, dst] of [[CUR_SEED, 'sprout.json'], [CUR_LOCK, '.core.lock.json'], [CUR_SNAP, '.snapshot.json']]) {
    if (exists(src)) fs.copyFileSync(src, path.join(dir, dst));
  }
  return dir;
}

function use(name) {
  const seedSrc = path.join(DIR, `sprout.${name}.json`);
  const lockSrc = path.join(DIR, `.core.lock.${name}.json`);
  const snapSrc = path.join(DIR, `.snapshot.${name}.json`);

  if (!exists(seedSrc)) return console.error(`没这个角色：${name}（先跑 --list）`);
  const seed = readJSON(seedSrc);

  const lockPath = findLock(name, seed.core);
  if (!lockPath) {
    return console.error(
      `★ 不能切到 ${name}：找不到和它核逐字一致的锁。\n` +
      `  硬切会让 grow 报「种皮破了」。要么补一把锁（按它的 core 生成），要么先别切。`
    );
  }
  const lock = readJSON(lockPath);
  if (!same(lock.core, seed.core)) {
    return console.error(
      `★ 不能切到 ${name}：这份状态的 core 和它的锁对不上——切过去也会被判「种皮破了」。\n` +
      `  先用 diff 看差在哪，别硬来。`
    );
  }

  const bak = backup();
  try {
    // ★ 先把「当前这个角色」的锁和快照按名字存好再切——否则 .core.lock.json 一被覆盖，原来那份就没了（踩过）
    const cur = readJSON(CUR_SEED);
    const curLock = readJSON(CUR_LOCK);
    if (cur && curLock && same(cur.core, curLock.core)) {
      const curName = activeName(cur.core);
      if (curName) {
        const lk = path.join(DIR, `.core.lock.${curName}.json`);
        const sp = path.join(DIR, `.snapshot.${curName}.json`);
        if (!exists(lk)) fs.copyFileSync(CUR_LOCK, lk);
        if (!exists(sp) && exists(CUR_SNAP)) fs.copyFileSync(CUR_SNAP, sp);
      }
    }
    fs.copyFileSync(seedSrc, CUR_SEED);
    fs.copyFileSync(lockPath, CUR_LOCK);
    if (exists(snapSrc)) fs.copyFileSync(snapSrc, CUR_SNAP);
    fs.writeFileSync(path.join(DIR, '.active.json'), JSON.stringify({ name, at: new Date().toISOString() }, null, 2), 'utf8');
    // 落地校验：换完之后必须仍然对得上
    const after = readJSON(CUR_SEED);
    const afterLock = readJSON(CUR_LOCK);
    if (!same(after.core, afterLock.core)) throw new Error('切完核对不上');
    console.log(`✔ 已切到 ${name}｜${after.gen} 代 · 阶段 ${after.stage} · trait ${Object.keys(after.trait || {}).length} · 卡 ${(after.cards || []).length}`);
    console.log(`  备份在 ${path.basename(bak)}（要退回：把里面三件拷回来）`);
  } catch (e) {
    for (const [src, dst] of [['sprout.json', CUR_SEED], ['.core.lock.json', CUR_LOCK], ['.snapshot.json', CUR_SNAP]]) {
      const p = path.join(bak, src);
      if (exists(p)) fs.copyFileSync(p, dst);
    }
    console.error(`✘ 切失败（${e.message}），已回滚到原状态。`);
    process.exit(1);
  }
}

const arg = process.argv[2];
if (!arg || arg === '--list') list();
else use(arg);
