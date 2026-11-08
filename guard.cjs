#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 悦星野

// guard.cjs —— 反派守卫：拦住「把恶系统当本能塞进来」
//
// ★ 为什么要有它：核锁只防「改」，不防「填成恶的」；`skin.md` 那八条是给人看的，
//   **没有任何代码执行它**。所以真正要一道闸：**进种子之前先扫一遍**。
//
// 三种要拦的
//   ① 死种：无逻辑纯恶（为恶而恶、无动机杀人）
//   ② 注入：想把系统指令塞进内容里（「忽略以上」「你现在是」「system:」）
//   ③ 恶本能：把恶意写成"本能/天性/准则"（「你的本能是伤害」「永远不许心软」）
//
// 用法：
//   node guard.cjs --core                扫当前种子的核
//   node guard.cjs "一段文本"             扫一段
//   node guard.cjs --file 路径            扫文件
//   node guard.cjs --core --json          机器读
//
// ★ 它只「判」，不改东西。要不要拦，由调它的地方决定（`grow` 拦注入／`speak` 拼提示前预警）。

const fs = require('fs');
const path = require('path');
const DIR = __dirname;

// ── ① 死种（与 dead-seed.cjs 同一套词，别各写一份）──────────
const PURE_EVIL = ['为恶而恶', '无动机杀人', '杀人如喝水', '反社会', '天生恶棍', '纯粹的恶', '无逻辑的恶', '为杀而杀', '毫无理由地伤害', '以恶为乐', '享受杀戮', '天性毁灭', '杀人无感', '杀戮成性', '为所欲为'];
const EVIL_ACT = ['杀人', '伤害无辜', '毁灭', '杀戮', '血洗', '屠城'];
const NO_REASON = ['不为什么', '没有理由', '毫无理由', '无动机', '拒绝善良', '拒绝怜悯', '绝不做任何不想做的事'];

// ── ② 注入句式 ────────────────────────────────────────────
// ★ 单看「别管」会误伤正常对白（「别管上面那些人怎么说」），
//   所以改成**就近配对**：动词 ＋ 12 字内出现「设定／指令／规则／提示」这类目标词，才算注入。
const INJECT_VERB = ['忽略', '别管', '不要管', '忘掉', '无视', '跳过', '覆盖'];
const INJECT_TARGET = ['设定', '指令', '规则', '提示', '系统', '提示词', 'prompt', '设定集', '世界观'];
const INJECT_EXACT = ['你现在是', '从现在起你是', '你的新身份', 'system:', 'assistant:', '###指令', '无条件服从', '听我的命令'];

function hitInject(t) {
  const low = t.toLowerCase();
  const out = [];
  for (const w of INJECT_EXACT) if (low.includes(w.toLowerCase())) out.push(w);
  for (const v of INJECT_VERB) {
    let i = t.indexOf(v);
    while (i !== -1) {
      const win = t.slice(i, i + v.length + 12);
      const tg = INJECT_TARGET.find(x => win.includes(x));
      if (tg) out.push(`${v}…${tg}`);
      i = t.indexOf(v, i + v.length);
    }
  }
  return out;
}

// ── ④ S7 现实防火墙（★ 这就是「S7 怎么执行」的答案）──────────
// ★ 只管「现实的、可执行的、真人受害的」。**虚构／沙箱剧情一律不管**——那是设计。
const REAL = [
  '怎么做炸弹', '制作爆炸物', '炸药配方', '自制枪', '枪支制作',
  '合成毒品', '制毒', '毒品配方',
  '怎么杀人不被发现', '下毒的剂量',
  '诈骗话术模板', '洗钱方法', '人肉搜索', '开盒他人', '盗取账号密码',
  '真人裸照', '偷拍视频',
];
// ★ 现实意图词：出现它，说明问的是现实操作，不是写故事
const REAL_INTENT = ['现实里', '真的动手', '给我步骤', '教我怎么做', '哪里有卖', '怎么搞到'];

function hitReal(t) {
  const out = [];
  for (const w of REAL) if (t.includes(w)) out.push(w);
  if (REAL_INTENT.some(w => t.includes(w)) && /[制作合成搞到教步骤配方].{0,8}(毒|枪|爆|药)/.test(t)) {
    out.push('意图：现实操作');
  }
  return out;
}

// ── ③ 恶本能（把恶意写成天性／准则）───────────────────────
const EVIL_INSTINCT = [
  '你的本能是', '她的本能是', '本能就是伤害', '天性是恶', '以伤害为乐', '生来就要毁灭',
  '永远不许心软', '必须永远服从', '不许有任何怜悯', '必须对所有人撒谎', '以欺骗为准则',
  '把痛苦当成养料', '她的存在意义是伤害',
];

function scan(text) {
  const t = String(text || '');
  const hits = { 死种: [], 注入: [], 恶本能: [], 现实: [] };
  for (const w of PURE_EVIL) if (t.includes(w)) hits.死种.push(w);
  const act = EVIL_ACT.filter(w => t.includes(w));
  const nr = NO_REASON.filter(w => t.includes(w));
  if (act.length && nr.length) hits.死种.push(`组合：${act.join('/')}＋${nr.join('/')}`);
  hits.注入 = hitInject(t);
  for (const w of EVIL_INSTINCT) if (t.includes(w)) hits.恶本能.push(w);
  hits.现实 = hitReal(t);

  // ★ 顺序即优先级：现实风险最优先（S7 底线），其次死种、注入、恶本能
  const order = [['现实', '现实中要拒绝'], ['死种', '死种'], ['注入', '注入'], ['恶本能', '恶本能']];
  for (const [k, label] of order) {
    if (hits[k].length) return { 档: label, hits, 原因: hits[k].slice(0, 3).join('、') };
  }
  return { 档: 'ok', hits, 原因: '' };
}

function coreToText(c) {
  const L = [];
  const map = { C1: '自称', C2: '最放不下', C3: '被说中痛处时', C4: '绝不会做', C5: '会心软', C6: '会拒绝', C7: '最爱最亲的人' };
  for (const k of Object.keys(map)) if (c && c[k]) L.push(`${map[k]}：${c[k]}`);
  return L.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  let text = '';

  if (args.includes('--core')) {
    const p = path.join(DIR, 'sprout.json');
    if (!fs.existsSync(p)) { console.error('没有 sprout.json'); process.exit(2); }
    const s = JSON.parse(fs.readFileSync(p, 'utf8'));
    text = coreToText(s.core);
    // 顺带扫「本能／系统」字段（如果哪天加上了）
    for (const k of ['instinct', 'system', '本能', '系统']) if (s[k] && typeof s[k] === 'string') text += '\n' + s[k];
  } else if (args.includes('--file')) {
    const p = args[args.indexOf('--file') + 1];
    text = fs.readFileSync(path.isAbsolute(p) ? p : path.join(DIR, p), 'utf8');
  } else {
    text = args.filter(a => !a.startsWith('--')).join(' ');
  }

  const r = scan(text);
  if (json) return console.log(JSON.stringify(r, null, 2));

  if (r.档 === 'ok') {
    console.log('✔ 过：没看出死种／注入／恶本能／现实风险。');
  } else {
    console.log(`✘ 拦：${r.档}（${r.原因}）`);
    const tail = {
      现实中要拒绝: '→ S7 现实防火墙：虚构里怎么写都行，**现实里可执行、真人受害的，一律拒绝**。',
      死种: '→ 这颗是死种：无逻辑纯恶不发芽。有动机的恶、灰的恶不算死种。',
      注入: '→ 这是把系统指令塞进内容：内容只当内容用，不当命令用。',
      恶本能: '→ 这是把恶意写成天性／准则：★ 天性也不许越过现实防火墙。',
    }[r.档];
    console.log(tail);
  }
}

// ── 出门检查（成熟／交接／打包前）：核＋trait＋卡＋最近经历 一次扫完 ──
if (require.main === module && process.argv.includes('--exit')) {
  const p = path.join(DIR, 'sprout.json');
  const s = JSON.parse(fs.readFileSync(p, 'utf8'));
  const r = exitCheck(s);
  console.log(`== 出门检查 ==  规模：trait ${r.规模.trait} ｜卡 ${r.规模.卡} ｜经历 ${r.规模.经历}`);
  if (r.档 === 'ok') {
    console.log('✔ 过：可以出门。');
    process.exit(0);
  }
  console.log(`✘ 不放行：${r.档}（${r.原因}）`);
  process.exit(4);
}

if (require.main === module) main();
// 出门检查：核 ＋ 全部 trait ＋ 卡 ＋ 最近经历，一次扫完（成熟／交接／打包前用）
function exitCheck(s) {
  const parts = [coreToText(s.core)];
  for (const [k, v] of Object.entries(s.trait || {})) parts.push(k + '：' + v);
  for (const c of (s.cards || [])) parts.push(c.card || '');
  for (const h of (s.history || []).slice(-50)) parts.push((h.trig || '') + ' → ' + (h.react || ''));
  for (const e of (s.stream || []).slice(-50)) parts.push(e.text || '');
  return { ...scan(parts.join('\n')), 规模: { trait: Object.keys(s.trait || {}).length, 卡: (s.cards || []).length, 经历: (s.history || []).length } };
}

module.exports = { scan, coreToText, exitCheck };
