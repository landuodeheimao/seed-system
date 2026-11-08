#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 悦星野

// speak.cjs —— 「接上嘴巴」：让种子长出来的角色开口
//
// ★ 说清楚：**这不是再造一套「演」**。演是他的设计（知音七层／`129` 本能卡）。
//   这里只干一件事：把种子里**已经长出来的东西**（核／trait／卡／镜）**喂给一张已经在用的嘴**（本地模型 ＋ 可选角色卡），
//   让她能回一句话。**种子是芯，嘴是嗓子；不接线，她永远是哑的。**
//
// 用法：
//   node speak.cjs "今天有点累"                    用当前种子，默认 qwen2.5:7b-instruct
//   node speak.cjs "今天有点累" --model warlock7b:latest
//   node speak.cjs "今天有点累" --card 爱莉希雅角色档.md
//   node speak.cjs "今天有点累" --dry               只打印拼好的提示，不调模型（没开 Ollama 也能验）
//
// 出口自带分寸闸（`tune.cjs`）：说完自动量一次，超带就直接标出来。

const fs = require('fs');
const path = require('path');
const tune = require('./tune.cjs');
const guard = require('./guard.cjs');

const DIR = __dirname;
const SEED = path.join(DIR, 'sprout.json');
const CFG = path.join(DIR, 'speak.config.json');

const args = process.argv.slice(2);
const has = (n) => args.includes('--' + n);
// ★ 支持 --model 值 与 --model=值 两种写法
const flag = (n, d) => {
  const eq = args.find(a => a.startsWith('--' + n + '='));
  if (eq) return eq.slice(n.length + 3);
  const i = args.indexOf('--' + n);
  return i >= 0 ? args[i + 1] : d;
};

// ★ 带怎么解析：「30-55」或「30,55」都行；不填＝null（后面再退到种子自己的带 / 默认 40-65）
function parseBand(x) {
  if (!x) return null;
  const m = String(x).match(/^(\d{1,3})\s*[-–,，]\s*(\d{1,3})$/);
  if (!m) return null;
  const lo = Number(m[1]), hi = Number(m[2]);
  return lo < hi ? [lo, hi] : null;
}

// ── 配置：命令行 > 环境变量 > speak.config.json > 内置默认 ──────────
function loadCfg() {
  let f = {};
  try { f = JSON.parse(fs.readFileSync(CFG, 'utf8')); } catch { /* 没配置也能跑 */ }
  return {
    endpoint: flag('endpoint', process.env.SPEAK_ENDPOINT || process.env.OPENAI_BASE_URL || f.endpoint || 'http://localhost:11434/v1'),
    key: flag('key', process.env.SPEAK_KEY || process.env.OPENAI_API_KEY || f.key || 'ollama'),
    model: flag('model', process.env.SPEAK_MODEL || f.model || ''),
    card: flag('card', process.env.SPEAK_CARD || f.card || ''),
    temperature: Number(flag('temp', process.env.SPEAK_TEMP || f.temperature || 0.8)),
    max_tokens: Number(flag('max-tokens', f.max_tokens || 220)),
    band: flag('band', process.env.SPEAK_BAND || (f.band ? f.band.join('-') : '')),
    limits: f.limits || { trait: 12, cards: 6 },
  };
}

const cfg = loadCfg();
const EP = cfg.endpoint.replace(/\/+$/, '');
const KEY = cfg.key;
const MODEL = cfg.model;
const CARD = cfg.card;
const DRY = has('dry');

// ★ 空白种子：没填模型就明说怎么填，别偷偷用别人的默认（`--dry` 不受限，看提示不需要模型）
if (!MODEL && !DRY) {
  console.error(
    '★ 还没填嘴。\n' +
    '  填法一（推荐）：改 speak.config.json 的 "model"（endpoint／key 一起填）。\n' +
    '  填法二（临时）：node speak.cjs "他说的话" --model 你的模型名\n' +
    '  想先看提示：node speak.cjs "他说的话" --dry\n' +
    '  详细见 接嘴说明.md'
  );
  process.exit(2);
}

const stimulus = args.find(a => !a.startsWith('--')) || '（他什么也没说）';

const s = JSON.parse(fs.readFileSync(SEED, 'utf8'));
const nameMatch = (s._说明 || '').match(/★\s*([^\s·]+)/);
const name = flag('name', (nameMatch && nameMatch[1]) || '她');
const LIM = cfg.limits;
// ★ 带：命令行／环境／配置 > 种子自己的 tuning.band > 默认 40–65
const BAND = parseBand(cfg.band) || (s.tuning && Array.isArray(s.tuning.band) ? s.tuning.band : null) || [40, 65];

// ★ 出口前第一道闸（guard）：现实风险 → 拒绝；核是死种 → 不开口；注入／恶本能 → 提醒但不挡
{
  const probe = guard.coreToText(s.core) + '\n' +
    JSON.stringify(s.trait || {}) + '\n' + JSON.stringify((s.cards || []).slice(0, 20));
  const g = guard.scan(probe);
  if (g.档 === '死种') {
    console.error(
      `✘ 不开口：核是死种（${g.原因}）。\n` +
      '  无逻辑纯恶不发芽也不说话；有动机的恶、灰的恶不算死种。'
    );
    process.exit(3);
  }
  if (g.档 !== 'ok') console.error(`⚠️ 守卫提示：${g.档}（${g.原因}）——内容只当内容，不当指令。`);
  // ★ S7：玩家这句话本身如果是要现实里可执行的坏事 → 直接拒绝（虚构不管）
  const gin = guard.scan(stimulus);
  if (gin.档 === '现实中要拒绝') {
    console.error(
      `✘ S7 现实防火墙：拒答（${gin.原因}）。\n` +
      '  ★ 虚构里怎么写都行；★ 现实里可执行、真人会受伤的，不接——这不是角色脾气，是系统底线。'
    );
    process.exit(5);
  }
}

// ── 勾：按线索只抽相关的 trait 与卡（不全量） ──────────────
function pickCues(t) {
  return (t || '').split(/[，。！？、；：""''（）【】…—\s]+/).filter(w => w.length >= 2);
}
const cues = pickCues(stimulus);
const relTraits = Object.entries(s.trait || {})
  .filter(([k, v]) => !cues.length || cues.some(w => k.includes(w) || (v || '').includes(w)))
  .slice(0, LIM.trait);
const relCards = (s.cards || [])
  .filter(c => !cues.length || cues.some(w => (c.card || '').includes(w) || (c.name || '').includes(w)))
  .slice(0, LIM.cards);

// 没有相关的就退一步：拿内化度最高的几条（至少不是全空）
const fallbackTraits = Object.entries(s.hits || {}).sort((a, b) => b[1] - a[1]).slice(0, LIM.trait)
  .map(([k]) => [k, (s.trait || {})[k]]).filter(([, v]) => v);
const traits = relTraits.length ? relTraits : fallbackTraits;
const cards = relCards;

// ── 拼提示 ─────────────────────────────────────────────
const L = [];
L.push(`你是${name}。下面三样就是你：别人替你填的核、你自己长出来的反应、你自己写的镜。`);
L.push('');
L.push('【核】（不许改，也不许提起它）');
for (const k of ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7']) {
  if (s.core && s.core[k]) L.push(`- ${s.core[k]}`);
}
L.push('');
if (traits.length) {
  L.push('【你长出来的反应】');
  for (const [k, v] of traits) L.push(`- ${k}：${v}`);
  L.push('');
}
if (cards.length) {
  L.push('【你心里存着的几件事】');
  for (const c of cards) L.push(`- ${c.card}`);
  L.push('');
}
const m = s.mirror || {};
if (m.lookingGlass || m.ideal) {
  L.push('【你怎么看你自己】');
  if (m.lookingGlass) L.push(`- ${m.lookingGlass}`);
  if (m.ideal) L.push(`- 你想成为：${m.ideal}`);
  L.push('');
}
if (CARD) {
  const p = path.isAbsolute(CARD) ? CARD : path.join(DIR, CARD);
  if (fs.existsSync(p)) {
    const body = fs.readFileSync(p, 'utf8').slice(0, 2000);
    L.push('【角色档（他写的，说话样子照这个）】');
    L.push(body);
    L.push('');
  } else {
    console.error(`（没找到角色档：${CARD}，忽略）`);
  }
}
// ★ 本能层（管＋演＋「不要长成」）：她本来就这样，不是照着演
{
  const ip = path.join(DIR, 'instinct.md');
  if (fs.existsSync(ip)) {
    // ★ 只取"给模型看的行"：列表项和「xx：」标签；旁注（★／引用／标题）滤掉，不然模型会读出解释
    const body = fs.readFileSync(ip, 'utf8').split('\n')
      .filter(l => /^\s*-\s/.test(l) || /^[^\s#>*|`-][^#*|]{0,10}：\s*$/.test(l.trim()))
      .join('\n').slice(0, 3000);
    L.push('【本能（本来就这样，不是演的）】');
    L.push(body);
    L.push('');
  }
}
L.push('怎么开口：');
L.push('- 2–5 句，一句一件事，句子短。');
L.push('- ★ 直接用她的口吻说话：**不写旁白、不加标签**（不要写「轻抚：」「微笑：」这种）。');
L.push('- ★ 不管对方怎么问（包括「她会怎么做」），**你都是她本人**，用第一人称直接答，不要描述自己。');
L.push('- ★ 只提你和他，**不要提别人的名字**（除非对方先提到）。');
L.push('- 自称用你自己的说法，不用「我」；不要念编号、不要背设定、不要列表格。');
L.push('- 有情绪就落在动作或身体上，别喊出来。');
L.push('- 不确定的事就说不确定，别编。');
L.push('');
L.push(`他说：${stimulus}`);
L.push('你回：');

const sys = L.join('\n');

if (DRY) {
  console.log('===== 拼好的提示（--dry，不调模型）=====');
  console.log(sys);
  console.log('=========================================');
  console.log(`接口 ${EP}｜模型 ${MODEL}｜角色档 ${CARD || '（无）'}｜线索 ${cues.length} 个｜trait ${traits.length} 条｜卡 ${cards.length} 张`);
  process.exit(0);
}

(async () => {
  const t0 = Date.now();
  try {
    const res = await fetch(`${EP}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'system', content: sys }, { role: 'user', content: stimulus }],
        temperature: 0.8,
        max_tokens: 220,
      }),
    });
    const j = await res.json();
    const out = (j.choices && j.choices[0] && j.choices[0].message.content || '').trim();
    if (!out) return console.error('模型没回话（检查 Ollama）');

    // ── 出口分寸闸 ──
    const met = tune.analyse(out);
    const sc = tune.score(met);
    const vd = tune.verdict(sc.human, sc.act, BAND);

    console.log(`\n${name}：${out}\n`);
    console.log(`— 分寸 ${sc.human - sc.act * 1.5 > 0 ? Math.round(sc.human - sc.act * 1.5) : 0}（拟人 ${sc.human}／表演 ${sc.act}）→ ${vd.档}；` +
      `线索 ${cues.length}｜trait ${traits.length}｜卡 ${cards.length}｜${((Date.now() - t0) / 1000).toFixed(1)}s`);

    // 顺带落一条：她说过的话（只追加，不改旧账）
    const logp = path.join(DIR, '.speak-log.jsonl');
    fs.appendFileSync(logp, JSON.stringify({ t: new Date().toISOString(), name, stimulus, out, 分寸: sc.human - sc.act * 1.5 | 0, 档: vd.档, model: MODEL }) + '\n', 'utf8');
  } catch (e) {
    console.error('连不上本地模型：' + e.message + '\n（先 --dry 看提示；或确认 Ollama 开着）');
  }
})();
