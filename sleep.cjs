// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 悦星野

// sleep.cjs —— 睡：回放 · 巩固 · 修剪（113）
// 用法：$env:DSH_MODEL_NAME='qwen2.5:7b-instruct'; node sleep.cjs
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const SEED = path.join(DIR, 'sprout.json');
const EP = 'http://localhost:11434/v1';
const MODEL = process.env.DSH_MODEL_NAME || 'qwen2.5:1.5b';

function load() { return JSON.parse(fs.readFileSync(SEED, 'utf8')); }
function save(s) { fs.writeFileSync(SEED, JSON.stringify(s, null, 2), 'utf8'); }

async function ask(sys, user, maxTokens = 200) {
  const res = await fetch(`${EP}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ollama' },
    body: JSON.stringify({ model: MODEL, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }], max_tokens: maxTokens, temperature: 0.7 }),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const j = await res.json();
  return ((j.choices && j.choices[0] && j.choices[0].message.content) || '').trim();
}

function coreText(c) {
  const L = [];
  if (c.C1) L.push(`她自称「${c.C1}」`);
  if (c.C2) L.push(`她最放不下的是：${c.C2}`);
  if (c.C3) L.push(`被人说中痛处时：${c.C3}`);
  if (c.C4) L.push(`她绝不会做：${c.C4}`);
  if (c.C5) L.push(`她会对这个心软：${c.C5}`);
  if (c.C7) L.push(`她最爱最亲、最相信的人：${c.C7}（是她爱的人，不是她本人）`);
  return L.join('\n');
}

function extractJSON(text) {
  const s = text.indexOf('{');
  if (s < 0) return text;
  let depth = 0, inStr = false, esc = false;
  for (let i = s; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
    } else {
      if (ch === '"') inStr = true;
      else if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) return text.slice(s, i + 1); }
    }
  }
  return text.slice(s);
}

(async function main() {
  const s = load();
  const core = coreText(s.core);
  const stream = s.stream || [];
  const traits = s.trait || {};

  // ★ 睡 = 光合作用：一进来就恢复能量（不管后面回放/巩固成不成）
  const beforeEnergy = (s.energy === undefined ? 0 : s.energy);
  s.energy = Math.min(100, beforeEnergy + 60);
  console.log(`（睡：能量 ${beforeEnergy} → ${s.energy}）`);

  if (stream.length < 5) { console.log('经历太少（' + stream.length + ' 条），不睡（但能量已恢复）'); save(s); return; }

  // ① 回放：归类（只归类，不下判断）
  const recent = stream.slice(-50).map((e, i) => `${i + 1}. ${e.text}`).join('\n');
  const sys1 = [
    core ? `这个人的核心：\n${core}` : '',
    '下面是她的经历，按顺序：', '',
    recent, '',
    '把这些经历归成 2-4 类，每类写：名字、属于它的经历编号、一句话说这类是关于什么的。',
    '输出 JSON：{"groups":[{"name":"类别名","ids":[1,2,3],"about":"这类说明她什么"}]}',
    '只输出 JSON，不要别的字。',
  ].filter(Boolean).join('\n');

  let groups = [];
  // ★ 回放归类加重试：7b 偶发输出非法 JSON，单次解析失败就整个丢弃太浪费，最多重问 3 次
  for (let attempt = 0; attempt < 3 && groups.length === 0; attempt++) {
    try {
      const out = await ask(sys1, '归类。', 500);
      const j = JSON.parse(extractJSON(out));
      groups = j.groups || [];
      if (!groups.length) throw new Error('groups 为空');
    } catch (e) {
      if (attempt < 2) console.log(`（回放第 ${attempt + 1} 次没解析成，重试）`);
      else console.log('回放失败：' + e.message + '（跳过归类，继续）');
    }
  }

  console.log('=== 睡 · ① 回放（归类）===');
  for (const g of groups) console.log(`· ${g.name}（${(g.ids || []).length} 条）：${g.about}`);

  // ② 巩固：每类压一张卡
  const cards = [];
  for (const g of groups) {
    const sys2 = [
      core ? `这个人的核心：\n${core}` : '',
      `她这一类经历（${g.name}）：${g.about}`,
      '把这一类压成一张稳定的卡，一句话说清「她在这件事上的稳定反应是什么」。',
      '要具体到能被打脸（比如「她会在 X 时做 Y」），不要形容词。',
      `★ 这张卡必须紧扣「${g.name}」这个主题，压出这一类特有的反应；不许压成跟别的类一样的泛泛的话（比如全都压成"帮指挥官"）。`,
      '同时给这张卡打三个分（1-5 整数）：',
      'magnitude＝这个反应有多强（幅度）；confidence＝有多确定是她的稳定反应（置信度）；frequency＝这一类里出现过几次（频率）。',
      '输出 JSON：{"card":"一句话","magnitude":3,"confidence":3,"frequency":3}',
      '只输出 JSON，不要别的字。',
    ].filter(Boolean).join('\n');
    try {
      const out = await ask(sys2, '压卡。', 200);
      let card = out, mag = 0, conf = 0, freq = 0;
      try {
        const j = JSON.parse(extractJSON(out));
        card = j.card || out; mag = Number(j.magnitude) || 0; conf = Number(j.confidence) || 0; freq = Number(j.frequency) || 0;
      } catch {}
      // ★ 压三门槛（StableMind / 信号检测论）：幅度·置信度·频率 三关全过（≥3）才留
      if (mag >= 3 && conf >= 3 && freq >= 3) {
        cards.push({ t: new Date().toISOString(), name: g.name, card });
        console.log(`· [卡] ${g.name} → ${card}（幅度${mag}/置信${conf}/频率${freq} ✓）`);
      } else {
        console.log(`· [卡] ${g.name} 三关没过（幅度${mag}/置信${conf}/频率${freq}）→ 丢弃`);
      }
    } catch (e) { console.log(`· [卡] ${g.name} 失败：${e.message}`); }
  }

  // ②·5 网（A-MEM 卡牵连）：stage ≥ 4 时给新卡建 links（关联同主题旧卡）
  if ((s.stage || 0) >= 4 && cards.length) {
    const oldCards = s.cards || [];
    const kw = (name) => (name || '').split(/[·与和／/、，,.\s]+/).filter(w => w.length >= 2);
    for (const nc of cards) {
      nc.links = [];
      const kn = kw(nc.name);
      oldCards.forEach((oc, i) => {
        if (kn.some(w => (oc.name || '').includes(w))) nc.links.push(i);
      });
    }
    const edgeCount = cards.reduce((a, c) => a + (c.links || []).length, 0);
    console.log(`· [网] 建 ${edgeCount} 条关联边`);
  }

  // ③ 留一句：这阵子她哪儿变了（跟上次对照）
  const lastLine = s.sleepLine || '（第一次睡）';
  const sys3 = [
    core ? `这个人的核心：\n${core}` : '',
    `她已经长出来的特质：${Object.keys(traits).join('、') || '（无）'}`,
    `这阵子压出来的卡：${cards.map(c => c.name + '：' + c.card).join('；') || '（无）'}`,
    `上次睡的时候，七实说她是这样的：「${lastLine}」`,
    '这次睡，用一句话回答：她「核之外」新长出了什么？',
    '只要一句总结，不要列清单、不要复述 trait。',
    '核之外没长新的，就直说「核之外没长新东西」。',
    '★ 核里的东西（比如她永远以指挥官为第一、她为了救世界一定会牺牲）不变是正常的，不算「没发育」，别提它。',
  ].filter(Boolean).join('\n');

  let line = '';
  try { line = await ask(sys3, '回答。', 160); } catch (e) { console.log('留句失败：' + e.message); }

  // ④ 修剪：归档冷 trait（突触修剪，113 第 3 步）
  // ★ 上限随阶段提高：升下一阶要 need[stage+1] 条，修剪留余量，否则永远升不了阶
  const need = [0, 6, 12, 20, 32, 48, 64, 80, 96, 112];
  const TRAIT_LIMIT = Math.max(20, need[Math.min((s.stage || 0) + 1, 9)] + 8);
  const traitKeys = Object.keys(s.trait);
  if (traitKeys.length > TRAIT_LIMIT) {
    const lastGen = {};
    for (const h of (s.history || [])) lastGen[h.word] = h.gen;
    // ★ EWC（灾难性遗忘保护）：内化 3/3 的「重要」trait 不删；优先删内化低的、再删老的
    const sorted = traitKeys.sort((a, b) => {
      const ha = (s.hits || {})[a] || 0;
      const hb = (s.hits || {})[b] || 0;
      if (ha !== hb) return ha - hb;
      return (lastGen[a] || 0) - (lastGen[b] || 0);
    });
    const overflow = sorted.slice(0, traitKeys.length - TRAIT_LIMIT);
    if (!s.archive) s.archive = [];
    for (const k of overflow) {
      if (((s.hits || {})[k] || 0) >= 3) continue;  // EWC：内化满的不删
      const inCards = (s.cards || []).some(c => c.card && c.card.includes(k));
      if (!inCards) {
        s.archive.push({ t: new Date().toISOString(), word: k, mean: s.trait[k] });
        delete s.trait[k];
        console.log(`· [修剪] 归档冷 trait：${k}`);
      }
    }
  }

  // ⑤ 温故知新（间隔重复 / 艾宾浩斯）：回炉一条正在内化中的 trait，巩固一次
  const mid = Object.keys(s.trait).filter(k => ((s.hits || {})[k] || 0) > 0 && ((s.hits || {})[k] || 0) < 3);
  if (mid.length) {
    const pick = mid[Math.floor(Math.random() * mid.length)];
    const sys4 = [
      core ? `这个人的核心：\n${core}` : '',
      `她长出的特质「${pick}」：${s.trait[pick]}`,
      '这件事又发生了一次，她现在的第一反应还是这个吗？',
      '★ 只回答两个字：还在 或 淡了。',
    ].filter(Boolean).join('\n');
    try {
      const r = await ask(sys4, '回炉。', 20);
      if (r.trim().startsWith('还在')) { s.hits[pick] = (s.hits[pick] || 0) + 1; console.log(`· [回炉] ${pick} 还在，内化 ${s.hits[pick]}/3`); }
      else { console.log(`· [回炉] ${pick} 淡了`); }
    } catch (e) { console.log(`· [回炉] ${pick} 失败：${e.message}`); }
  }

  // ⑤·5 树阶段日新（stage ≥ 4）：十渐四问 + 日知所亡·月无忘 + 盘铭日新
  if ((s.stage || 0) >= 4) {
    const sleepCount = (s.sleepHistory || []).length;

    // 十渐四问：每 10 次睡四问自检（防变油）
    if (sleepCount > 0 && sleepCount % 10 === 0) {
      const sysFour = [
        core ? `这个人的核心：\n${core}` : '',
        `她已经长出来的特质：${Object.keys(traits).join('、') || '（无）'}`,
        '★ 四问自检（十渐四问，防变油），逐条回答「有／没有」：',
        '一问她是不是变得套路了？二问她是不是变得油滑了？三问她是不是变得敷衍了？四问她是不是变得不像她自己了？',
      ].filter(Boolean).join('\n');
      try {
        const four = await ask(sysFour, '自检。', 80);
        console.log(`· [十渐四问] ${four.slice(0, 100)}`);
        s.fourCheck = { t: new Date().toISOString(), line: four.slice(0, 120) };
      } catch (e) { console.log(`· [十渐四问] 失败：${e.message}`); }
    }

    // 日知所亡·月无忘：每 30 次睡抽 3 条回炉（月巩固，不全量以免太慢）
    if (sleepCount > 0 && sleepCount % 30 === 0) {
      const keys = Object.keys(s.trait);
      const sample = keys.sort(() => Math.random() - 0.5).slice(0, 3);
      let kept = 0;
      for (const k of sample) {
        const sysMonth = [
          core ? `这个人的核心：\n${core}` : '',
          `她长出的特质「${k}」：${s.trait[k]}`,
          '这件事又发生了一次，她现在的第一反应还是这个吗？只回答：还在 或 淡了。',
        ].filter(Boolean).join('\n');
        try {
          const r = await ask(sysMonth, '回炉。', 20);
          if (r.trim().startsWith('还在')) { s.hits[k] = (s.hits[k] || 0) + 1; kept++; }
        } catch (e) {}
      }
      console.log(`· [月巩固] 抽 ${sample.length} 条回炉，还在 ${kept} 条`);
    }

    // 盘铭日新：每次睡留「日新」痕迹（三叠改一格，这里记档）
    s.dailyNew = { t: new Date().toISOString(), sleepCount: sleepCount + 1 };
    console.log(`· [盘铭日新] 第 ${sleepCount + 1} 次睡，日新留痕`);
  }

  // ⑥ 写回
  if (!s.cards) s.cards = [];
  s.cards = s.cards.concat(cards);
  if (!s.sleepHistory) s.sleepHistory = [];
  if (line) { s.sleepLine = line; s.sleepHistory.push({ t: new Date().toISOString(), line }); }
  s.lastSleep = new Date().toISOString();
  save(s);

  console.log('=== 睡 · ④ 留一句 ===');
  console.log(`这次：${line}`);
  console.log(`上次：${lastLine}`);
})();
