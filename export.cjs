#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 悦星野

// export.cjs —— 迁移包（AI Continuity）：种子带逐字样例打包
// 用法：node export.cjs [角色名]
// ★ 电脑专家智慧（AI Continuity）：示例比描述管用——「要机智」十个模型给十种机智，
//   给五段例子就准得多。所以迁移包必须带逐字样例（trig → react）。

const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const SEED = path.join(DIR, 'sprout.json');

const s = JSON.parse(fs.readFileSync(SEED, 'utf8'));

// ★ 出门检查（2026-11-08）：打包＝她要被带走，先过 guard；现实风险／死种不放行
{
  const guard = require('./guard.cjs');
  const g = guard.exitCheck(s);
  if (g.档 === '现实中要拒绝' || g.档 === '死种') {
    console.error(`✘ 不打包：出门检查没过——${g.档}（${g.原因}）`);
    process.exit(4);
  }
  if (g.档 !== 'ok') console.error(`⚠️ 出门检查提示：${g.档}（${g.原因}）——照常打包。`);
}

const mm = (s._说明 || '').match(/★\s*([^\s·]+)/);
const name = process.argv[2] || (mm && mm[1]) || '种子';
const d = new Date();
const ts = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const pkg = {
  _迁移包: 'AI Continuity：带着它到别处，她还能醒。核＋长出来的＋逐字样例。',
  _导出时间: new Date().toISOString(),
  _角色: name,
  _阶段: s.stage,
  _代数: s.gen,
  core: s.core,
  trait: s.trait,
  mirror: s.mirror,
  // ★ 逐字样例（示例比描述管用）：触发 → 反应
  逐字样例: (s.history || []).map(h => ({ 触发: h.trig, 反应: h.react, 特质: h.word })),
  cards: s.cards,
  // ★ 分寸（2026-11-07 新接）：像到几分——跟着迁移包一起走，换个模型也不会忽然变成客服或忽然演过头
  分寸: s.tuning || { humanity: 50 },
};

const base = path.join(DIR, `迁移包-${name}-${ts}`);
fs.writeFileSync(base + '.json', JSON.stringify(pkg, null, 2), 'utf8');

// 顺带一份可读的 md
const L = [];
L.push(`# 迁移包 · ${name}`);
L.push('');
L.push('> ★ 带着它到别处，她还能醒。核＋长出来的＋逐字样例。');
L.push('');
L.push('## 核（别人填的，不许她改）');
for (const k of ['C1', 'C2', 'C3', 'C4', 'C5', 'C6']) if (s.core && s.core[k]) L.push(`- ${k}：${s.core[k]}`);
L.push('');
L.push('## 长出来的 trait');
for (const [k, v] of Object.entries(s.trait || {})) L.push(`- ${k}：${v}`);
L.push('');
L.push('## 逐字样例（示例比描述管用）');
for (const h of (s.history || [])) L.push(`- ${h.trig} → ${h.react}（${h.word}）`);
L.push('');
L.push('## 镜（她自己写的）');
const m = s.mirror || {};
if (m.lookingGlass) L.push(`- 别人怎么看我：${m.lookingGlass}`);
if (m.story) L.push(`- 我做过的事：${m.story}`);
if (m.ideal) L.push(`- 我想成为：${m.ideal}`);
L.push('');
L.push('## 分寸（像到几分）');
const tn = s.tuning || {};
L.push('- 拟人度 ' + (tn.humanity ?? 50) + '／100（带 40–65）｜上次量 ' + (tn.lastShare ?? '—') + '（' + (tn.lastVerdict ?? '—') + '）');
L.push('');
L.push('## 压出来的卡');
for (const c of (s.cards || [])) L.push(`- ${c.name}：${c.card}`);
fs.writeFileSync(base + '.md', L.join('\n'), 'utf8');

console.log(`迁移包导出：${base}.json ＋ ${base}.md`);
console.log(`核 ${Object.keys(s.core || {}).length} 格 · trait ${Object.keys(s.trait || {}).length} 条 · 逐字样例 ${(s.history || []).length} 条 · 卡 ${(s.cards || []).length} 张`);
