#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 悦星野

// tune.cjs —— 分寸（恐怖谷／偃师）：像到几分
//
// ★ 为什么要有它：她长得太像人会被"看穿"，长得很不像人又成了客服。
//   「分寸」就是那根尺：**不是越像越好，是落在带里才对**。
// ★ 只用统计，不叫模型 —— 所以随时能跑，不花算力、不看 Ollama 在不在。
//
// 用法：
//   node tune.cjs <文本文件>            量一段台词，出分寸分与判定
//   node tune.cjs <文本文件> --set      量完顺手把建议值写进 sprout.json（只写 tuning）
//   node tune.cjs --show                看当前种子的分寸设定
//
// 判据（三档，别混）：
//   0–39  太冷  → 像系统提示/客服，不像她
//   40–65 刚好  → 带内
//   66–100 太甜 → 演过头，假（恐怖谷的另一侧）

const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const SEED = path.join(DIR, 'sprout.json');

// ── 词表（短、够用；要加就加在这里，别散在代码里） ────────────────
const EMOTION = ['开心', '高兴', '难过', '伤心', '生气', '火大', '害怕', '紧张', '委屈', '害羞', '喜欢', '讨厌', '舒服', '难受', '心疼', '放心', '安心', '烦', '累', '想哭', '想笑'];
const PARTICLE = ['啦', '哦', '呢', '呀', '吧', '嘛', '诶', '嘿', '哈', '哇', '嗯', '唔', '唔'];
const MACHINE = ['系统', '参数', '模块', '接口', '配置', '流程', '数据', '正在处理', '建议您', '请确认', '已收到', '无法', '权限', '调用', '返回', '异常'];
const SOB = ['呜呜', '嘤嘤', '啊啊', '呜呜呜', '嘤'];

function splitSentences(t) {
  return t.split(/[。！？…~\n]+/).map(x => x.trim()).filter(x => x.length > 1);
}

function countWords(t, list) {
  let n = 0;
  for (const w of list) {
    let i = t.indexOf(w);
    while (i !== -1) { n++; i = t.indexOf(w, i + w.length); }
  }
  return n;
}

function analyse(text) {
  const sents = splitSentences(text);
  const lens = sents.map(s => s.length).sort((a, b) => a - b);
  const med = lens.length ? lens[Math.floor(lens.length / 2)] : 0;
  const n = Math.max(1, sents.length);
  const c = (ch) => text.split(ch).length - 1;

  const m = {
    句数: sents.length,
    句长中位: med,
    情绪词: countWords(text, EMOTION),
    语气词: countWords(text, PARTICLE),
    机械词: countWords(text, MACHINE),
    拟声词: countWords(text, SOB),
    感叹号: c('！'),
    省略号: c('…'),
    自称她: c('七实') + c('我'),
  };
  m.每句情绪 = +(m.情绪词 / n).toFixed(2);
  m.每句语气 = +(m.语气词 / n).toFixed(2);
  m.每句机械 = +(m.机械词 / n).toFixed(2);
  m.每句省略 = +(m.省略号 / n).toFixed(2);
  m.每句拟声 = +(m.拟声词 / n).toFixed(2);
  return m;
}

function score(m) {
  // ★ 两条轴分开算，别混：
  //   拟人度 = 像不像人（语气词、情绪词，减机械词）
  //   表演度 = 演没演过头（呜呜、省略号成灾、情绪堆砌）
  const n = Math.max(1, m.句数);
  const 每句拟声 = (m.拟声词 || 0) / n;

  let human = 50;
  human += 16 * (m.每句语气 - 0.45);
  human += 14 * (m.每句情绪 - 0.30);
  human -= 55 * m.每句机械;
  if (m.句长中位 > 30) human -= 8;
  human = Math.max(0, Math.min(100, human));

  let act = 0;
  act += 6.0 * 每句拟声;                        // 呜呜／嘤嘤这类，最像"演"
  act += 2.0 * Math.max(0, m.每句省略 - 0.8);     // 省略号成灾
  act += 8 * Math.max(0, m.每句情绪 - 0.60);      // 情绪词堆砌

  return { human: Math.round(human), act: +act.toFixed(1) };
}

// ★ 带是可调的（2026-11-08 指挥官：「可以按照说的话自由调整，不要死板」）
//   band = [下限, 上限]；不传就是七实的默认 [40,65]
function verdict(human, act, band) {
  const [lo, hi] = band || [40, 65];
  if (act >= 2.5) return { 档: '太甜', 话: '演过头了，假' };
  if (human < lo) return { 档: '太冷', 话: `低于这个角色的带（${lo}–${hi}）` };
  if (human > hi) return { 档: '太甜', 话: `高于这个角色的带（${lo}–${hi}）` };
  return { 档: '刚好', 话: `在带内 ${lo}–${hi}` };
}

function advice(m, v, d) {
  const a = [];
  if (m.每句机械 > 0) a.push(`去掉机械词（${m.机械词} 处：系统／参数／建议您这类）——这是最伤分寸的一项`);
  if (m.拟声词 > 0) a.push(`拟声词 ${m.拟声词} 处（呜呜／嘤嘤）——那是演，她难过是"小太阳暗"，不是哭出声`);
  if (m.每句语气 < 0.25) a.push('加一点口语（啦／哦／呢／呀），她说话不是发通告');
  if (m.每句省略 > 1.2) a.push('省略号收一收——每句一个「……」是演，不是她');
  if (m.每句情绪 > 0.6) a.push('情绪词太密，改成身体指标（推进轮／小太阳）更真');
  if (m.句长中位 > 30) a.push('句子太长，拆开——一句一件事');
  if (!a.length && d.档 === '刚好') a.push('没要改的，这一版分寸正合适');
  if (!a.length) a.push('两侧都不像，重写一遍比调词快');
  return a;
}

function loadSeed() {
  if (!fs.existsSync(SEED)) return null;
  return JSON.parse(fs.readFileSync(SEED, 'utf8'));
}

function show() {
  const s = loadSeed();
  if (!s) return console.log('没有 sprout.json');
  const t = s.tuning || {};
  console.log(`== 分寸（当前种子）==`);
  console.log(`拟人度 ${t.humanity ?? '（未设，默认 50）'}｜带 40–65｜上次量：${t.lastShare ?? '—'}（${t.lastVerdict ?? '—'}）`);
  console.log(`卡 ${(s.cards || []).length} 张｜trait ${Object.keys(s.trait || {}).length} 条｜阶段 ${s.stage}/${s.gen} 代`);
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--show')) return show();
  const file = args.find(a => !a.startsWith('--'));
  if (!file) {
    console.log('用法：node tune.cjs <文本文件> [--set]｜node tune.cjs --show');
    process.exit(1);
  }
  const text = fs.readFileSync(file, 'utf8');
  const m = analyse(text);
  const { human, act } = score(m);
  const v = Math.max(0, Math.min(100, Math.round(human - act * 1.5)));
  const d = verdict(human, act);

  console.log(`== 分寸 · ${path.basename(file)} ==`);
  console.log(`分寸 ${v}／100（拟人 ${human}／表演 ${act}）→ ★ ${d.档}（${d.话}）｜带＝40–65`);
  console.log(`句数 ${m.句数}｜句长中位 ${m.句长中位}｜情绪 ${m.情绪词}｜语气 ${m.语气词}｜机械 ${m.机械词}｜！${m.感叹号}｜…${m.省略号}`);
  console.log('改法：');
  for (const a of advice(m, v, d)) console.log('  · ' + a);

  if (args.includes('--set')) {
    const s = loadSeed();
    if (!s) return console.log('没有 sprout.json，没写');
    if (!s.tuning) s.tuning = {};
    // 只写 tuning（assist 区），不碰 core / trait / history
    s.tuning.humanity = Math.max(40, Math.min(65, v));
    s.tuning.lastShare = v;
    s.tuning.lastVerdict = d.档;
    s.tuning.updatedAt = new Date().toISOString();
    fs.writeFileSync(SEED, JSON.stringify(s, null, 2), 'utf8');
    console.log(`已写 sprout.tuning：humanity=${s.tuning.humanity}（收回带内）`);
  }
}

if (require.main === module) main();
module.exports = { analyse, score, verdict };
