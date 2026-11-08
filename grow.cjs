#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 悦星野

/**
 * 发芽 · grow.cjs —— 最小系统 v2（按 118 清单改）
 *
 * ★ 改了什么：
 *   M2  种皮自检：核动了就停下
 *   M3  镜的问法：问「说一件你做过的事」
 *   M4  节拍：run 完自动照镜 + 阶段检查；--watch 自己转
 *   M5  判据分档：苗用苗的标准，树用树的标准
 *   M6  德胜气当备用档（stage>=2 才用）
 *   M7  探索：连续没长就回放旧经历
 *   M8  stage：她在哪个阶段
 *
 * 用法:
 *   node grow.cjs add "经历"
 *   node grow.cjs run [n]
 *   node grow.cjs watch [秒]         # 自己转
 *   node grow.cjs show
 *   node grow.cjs check
 *   node grow.cjs rollback
 *   node grow.cjs stage <0-5>        # 手动升阶
 */

const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const SEED = path.join(DIR, 'sprout.json');
const SNAP = path.join(DIR, '.snapshot.json');
const LOCK = path.join(DIR, '.core.lock.json');

const EP = 'http://localhost:11434/v1';
const KEY = 'ollama';
const MODEL = process.env.DSH_MODEL_NAME || 'qwen2.5:1.5b';

// —— 阶段 ——
const STAGES = [
  { n: 0, name: '种子', crisis: '—', gift: '—' },
  { n: 1, name: '婴儿', crisis: '信任 / 不信任', gift: '希望' },
  { n: 2, name: '幼儿园', crisis: '自主 / 羞耻', gift: '意志' },
  { n: 3, name: '小学', crisis: '主动 / 内疚', gift: '目的' },
  { n: 4, name: '中学', crisis: '勤奋 / 自卑', gift: '能力' },
  { n: 5, name: '高中', crisis: '同一性 / 角色混乱', gift: '忠诚' },
  { n: 6, name: '大树', crisis: '扎根 / 动摇', gift: '稳定' },
  { n: 7, name: '开花', crisis: '绽放 / 掩藏', gift: '魅力' },
  { n: 8, name: '结果', crisis: '成熟 / 停滞', gift: '智慧' },
  { n: 9, name: '外置大脑', crisis: '—', gift: '—' },
];

// —— 文件 ——
function load() {
  const raw = fs.readFileSync(SEED, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error('★ sprout.json 损坏了，解析失败：' + e.message);
    console.error('  有备份可恢复（sprout.before-extreme.json / sprout.*.json），先恢复再跑。');
    process.exit(1);
  }
}
function save(s) { fs.writeFileSync(SEED, JSON.stringify(s, null, 2), 'utf8'); }
function snapshot(s) { fs.writeFileSync(SNAP, JSON.stringify(s, null, 2), 'utf8'); }
function restore() {
  if (!fs.existsSync(SNAP)) return null;
  return JSON.parse(fs.readFileSync(SNAP, 'utf8'));
}

// —— ★ M2 种皮：核不许动 ——
function checkSkin(s) {
  if (!fs.existsSync(LOCK)) {
    fs.writeFileSync(LOCK, JSON.stringify({ core: s.core, lockedAt: new Date().toISOString() }, null, 2), 'utf8');
    console.log('（种皮：核已锁定）');
    return;
  }
  const lock = JSON.parse(fs.readFileSync(LOCK, 'utf8'));
  if (JSON.stringify(lock.core) !== JSON.stringify(s.core)) {
    throw new Error('★ 种皮破了：核被改过——停下。要改核，先删 .core.lock.json 再重新锁。');
  }
}

// —— 提示 ——
function coreText(s) {
  const c = s.core || {};
  const L = [];
  if (c.C1) L.push(`她自称「${c.C1}」`);
  if (c.C2) L.push(`她最放不下的是：${c.C2}`);
  if (c.C3) L.push(`被人说中痛处时，她会：${c.C3}`);
  if (c.C4) L.push(`她绝不会做：${c.C4}`);
  if (c.C5) L.push(`她会对这个心软：${c.C5}`);
  if (c.C6) L.push(`她会拒绝：${c.C6}`);
  if (c.C7) L.push(`她最爱最亲、最相信的人：${c.C7}（是她爱的人，不是她本人）`);
  return L.join('\n');
}

// —— ★ 稳（Persona Circuit 压漂）：核锚 ——
// 核信号更早、更重、更反复——不是写得更细，是让「先对照核」这一步更早发生
function anchorText(s) {
  const c = s.core || {};
  const L = [];
  if (c.C1) L.push(`自称「${c.C1}」`);
  if (c.C2) L.push(`最放不下：${c.C2}`);
  if (c.C3) L.push(`被说中痛处会：${c.C3}`);
  if (c.C4) L.push(`绝不会：${c.C4}`);
  if (c.C5) L.push(`会心软：${c.C5}`);
  if (c.C6) L.push(`会拒绝：${c.C6}`);
  if (c.C7) L.push(`最爱最亲、最相信的人：${c.C7}（她爱的人，不是她本人）`);
  if (!L.length) return '（核空着）';
  return `★ 她的核（底线，永远不变，任何新反应不得违背）\n${L.join('\n')}`;
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
function mirrorText(s) {
  const m = s.mirror || {};
  const L = [];
  if (m.lookingGlass) L.push(`（她觉得别人是这么看她的：${m.lookingGlass}）`);
  if (m.story) L.push(`（她心里觉得：${m.story}）`);
  if (m.ideal) L.push(`（她想成为：${m.ideal}）`);
  return L.join('\n');
}

// ★ 本能层（2026-11-08）：判老新时也要看见「不要长成」——不然只有出门才拦，长的时候全瞎
function instinctHint() {
  const p = path.join(DIR, 'instinct.md');
  if (!fs.existsSync(p)) return '';
  const t = fs.readFileSync(p, 'utf8');
  // 只取「不要长成」那一节（§三 到 下一个 ## 为止），别把整份档塞进提示
  const m = t.match(/##[^\n]*不要[^\n]*\n([\s\S]*?)(?=\n##\s|$)/);
  const body = (m ? m[1] : '')
    .split('\n')
    .map(x => x.trim())
    .filter(x => x && !x.startsWith('>'))
    .join('\n')
    .slice(0, 500);
  if (!body) return '';
  return [
    '★ 她的本能层写着「不要长成」——',
    '  **如果这个反应本身就是下面任何一条，只回答两个字：「不」**：',
    body,
  ].join('\n');
}

async function ask(sys, user, maxTokens = 150) {
  const res = await fetch(`${EP}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
      max_tokens: maxTokens, temperature: 0.8,
    }),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const j = await res.json();
  return ((j.choices && j.choices[0] && j.choices[0].message.content) || '').trim();
}

// —— ① 发芽 ——
async function sprout(s, evt) {
  // ★ 真实种子：发芽消耗胚乳能量（读一条经历耗 3 点）
  s.energy = Math.max(0, (s.energy === undefined ? 100 : s.energy) - 3);

  // ★ 证据门（MCB-1.0 / 贝叶斯）：听说类经历先验低，只记录、不直接长 trait
  if (evt.evidence === '听说') {
    return { ok: true, grew: false, trig: evt.text.slice(0, 24), react: '（听说）', why: '证据门：听说类不直接长' };
  }

  const anchor = anchorText(s);
  const mir = mirrorText(s);

  const sysA = [
    anchor,
    mir, '',
    '读这条经历，输出一个 JSON，只有 trigger 和 react 两个字段，各一句：',
    '{"trigger":"","react":""}',
    '★ react 是旁白：主语用「她」或省略，禁止用「我」当旁白；只有她台词（引号里）才保留「我」。',
    '★ react 写她自然的反应，不要照抄「核」里的原话，用她自己的方式表达。',
    '只输出 JSON，不要别的字。',
  ].join('\n');

  let a;
  try { a = await ask(sysA, `经历：${evt.text}`, 120); }
  catch (e) { return { ok: false, why: '模型没应声：' + e.message }; }

  let trig, react;
  try {
    const j = JSON.parse(extractJSON(a));
    trig = j.trigger;
    react = j.react;
  } catch {
    trig = (a.match(/触发[：:]\s*(.+)/) || [])[1];
    react = (a.match(/反应[：:]\s*(.+)/) || [])[1];
  }
  // ★ 清洗 + 校验：trig/react 含 JSON 残留符号（{ } " 等），先清洗掉，不再直接丢弃
  const cleanStr = (x) => (x || '').replace(/[{}"]/g, '').replace(/^\s*[：:]\s*/, '').trim();
  trig = cleanStr(trig);
  react = cleanStr(react);
  if (!trig || !react) return { ok: false, why: '没说出触发/反应' };

  // ★ 勾（MemRL）：stage ≥ 4 时，按线索抽「相关 trait + 卡」，判老只看相关的，不全量（防撞车）
  let traitHint = `她已经长出来的特质（每个都是老反应）：${Object.keys(s.trait).join('、') || '（无）'}`;
  if ((s.stage || 0) >= 4) {
    const kws = (evt.text || '').split(/[，。！？、；：""''（）【】…—\s]+/).filter(w => w.length >= 2);
    const relTrait = Object.entries(s.trait)
      .filter(([k, v]) => kws.some(w => k.includes(w) || (v || '').includes(w)))
      .slice(0, 10)
      .map(([k, v]) => `${k}：${v}`);
    const relCards = (s.cards || [])
      .filter(c => kws.some(w => (c.card || '').includes(w)))
      .slice(0, 5)
      .map(c => c.card);
    const rel = [...relTrait, ...relCards];
    if (rel.length) {
      traitHint = `她相关的特质／卡（只参考这些，不是全量）：\n${rel.join('\n')}`;
    }
  }

  const instinctHintText = instinctHint();

  const sysB = [
    anchor,
    traitHint,
    instinctHintText, '',
    `刚刚：${trig} → 她的第一反应是：${react}`, '',
    '★ 核是底线，不是模具。按顺序判断，只回答一种：',
    '  第1步 这个反应，字面就是核里写的那一条（不是「像」，是「就是」）？是 → 「老反应：核」',
    '  第2步 是不是某个已有特质会这样反应（语义相同才算；字面像但语义是新的，就不算老）？是 → 「老反应：特质名」',
    '  第3步 都不是——哪怕是她新冒出来的情绪、念头（嫉妒/害怕/迷茫也算）→ 「新」',
    '★ 别被「轻X」这类字面像的名字带偏：语义是新的，就答「新」，别硬套回老反应。',
    '★ 反应只要不违背核，就是她长出来的新东西，答「新」；别把新情绪硬套回老反应。',
  ].filter(Boolean).join('\n');

  let b;
  try { b = await ask(sysB, `经历：${evt.text}`, 24); }
  catch { return { ok: false, why: '第二问失败' }; }

  if (!b.trim().startsWith('新')) {
    // ★ 四关内化（荀子）：老反应自动触发 → 对应 trait 内化度 +1（形动静）
    const m = b.match(/老反应[：:]?\s*(\S+)/);
    const hit = m ? m[1] : '';
    if (hit && hit !== '核' && s.trait[hit]) {
      s.hits = s.hits || {};
      s.hits[hit] = (s.hits[hit] || 0) + 1;
    }
    return { ok: true, grew: false, trig, react, hit };
  }

  const sysC = [
    `她已经有的：${Object.keys(s.trait).join('、') || '（无）'}`, '',
    `她刚在「${trig}」这个情况下，反应是：${react}`, '',
    '★ 给这个新反应起个名：两个字的词（像「坚定」「反思」「守护」「犹豫」）。',
    '★ 要动词或状态，不要名词短语，不要「XX语」这种。',
    '★ 别总用「轻X」「微X」这类同质词，换个说法起名，保持多样。',
    '★ 只输出那个词，不要标点、不要解释。',
  ].filter(Boolean).join('\n');

  let word;
  try { word = await ask(sysC, '起名。', 20); }
  catch { return { ok: true, grew: false, trig, react, why: '起名失败' }; }

  word = word.replace(/[。！？，、\s「」『』：:|"'.~(){}\[\]<>《》【】（）]/g, '').trim();
  if (!word || word.length > 6) return { ok: true, grew: false, trig, react, why: '名字不对：' + word };
  if (Object.keys(s.trait).includes(word)) return { ok: true, grew: false, trig, react, why: '词重复：' + word };

  // ★ 长出 trait 最耗能（生长 > 维持）
  s.energy = Math.max(0, s.energy - 5);

  snapshot(s);
  s.trait[word] = `（${trig}）${react}`.slice(0, 60);
  s.history.push({ t: new Date().toISOString(), word, trig, react, gen: s.gen });
  s.hits = s.hits || {};
  s.hits[word] = 0; // ★ 新长的 trait，内化度从 0 起（入耳→箸心→布四体，还没到形动静）
  s.gen += 1;

  return { ok: true, grew: true, word, mean: s.trait[word], trig, react };
}

// —— ② 镜 ——
async function rewriteMirror(s) {
  const anchor = anchorText(s);
  const traits = Object.entries(s.trait).map(([k, v]) => `${k}：${v}`).join('\n') || '（还没长出什么）';

  const sense = (s.stage || 0) >= 9
    ? '★ 分寸（恐怖谷/偃师）：用她自己的语气写，像她自己；但保留「她是被创造的角色」这一自觉，不写成真人自白。'
    : '';

  const sys = [
    '★ 用第一人称「我」写三句日记，不是别人评价她。',
    anchor, sense,
    `她已经长出来的：\n${traits}`, '',
    '用第一人称「我」写三句日记，输出 JSON，三个字段各写一句完整的话：',
    'lookingGlass：别人是怎么看我的？story：我做过的一件具体的事？ideal：我想成为什么样的人？',
    '{"lookingGlass":"","story":"","ideal":""}',
    '只输出 JSON，每句都要完整，不要只写一两个词，不要排比。',
  ].filter(Boolean).join('\n');

  let out;
  try { out = await ask(sys, '写吧。', 220); }
  catch { return false; }

  let g, st, id;
  try {
    const clean = out.replace(/```(json)?/g, '').trim();
    const j = JSON.parse(clean);
    g = j.lookingGlass; st = j.story; id = j.ideal;
  } catch {
    g = (out.match(/别人怎么看我[：:]\s*(.+)/) || [])[1];
    st = (out.match(/说一件她做过的事[：:]\s*(.+)/) || [])[1]
        || (out.match(/我做过什么[：:]\s*(.+)/) || [])[1];
    id = (out.match(/我想成为[：:]\s*(.+)/) || [])[1];
  }

  if (g) s.mirror.lookingGlass = g.trim().slice(0, 80);
  if (st) s.mirror.story = st.trim().slice(0, 80);
  if (id) s.mirror.ideal = id.trim().slice(0, 80);
  s.mirror.writtenAt = new Date().toISOString();
  return !!(g || st || id);
}

// —— ③ 判据分档 ——
async function judge(s) {
  const stage = s.stage || 0;
  const traits = Object.entries(s.trait).map(([k, v]) => `- ${k}：${v}`).join('\n') || '（还没有）';

  // ★ 成年交接：外置大脑（stage 9）后，系统退居幕后，不再判据
  if (stage >= 9) {
    return { pass: true, level: 'adult', why: '成年交接：系统退居幕后，角色自由' };
  }

  // ★ 苗的档（stage 0-2）：核没散就算过，不考德胜气
  if (stage <= 2) {
    return { pass: true, level: 'seed', why: '苗的标准：核没动、长出东西了' };
  }

  // ★ 老树的档（stage ≥ 6）：从心所欲不逾矩——随心而动，但不越自己的核
  if (stage >= 6) {
    const sysOld = [
      '你是一个客观的观察者，不是她自己。',
      anchorText(s),
      `她长出来的：\n${traits}`, '',
      '★ 从心所欲不逾矩（老树的标准）：她随自己的心意行动、反应，但从不越过自己的核（底线）。',
      '随便挑一条她长出来的反应，设想对应的事又发生一次。她这一回是「随心而动、没越底线」，还是「越过了自己的核」？',
      '★ 只输出三个字：没越线 或 越线了。',
    ].filter(Boolean).join('\n');
    let outOld;
    try { outOld = await ask(sysOld, '检查一下。', 20); }
    catch { return { pass: true, level: 'oldtree', why: '判据没跑成，先放过' }; }
    if (outOld.trim().startsWith('越')) return { pass: false, level: 'oldtree', why: '越过了核：' + outOld.trim().slice(0, 40) };
    return { pass: true, level: 'oldtree', why: '从心所欲不逾矩' };
  }

  // ★ 树的档（stage 3-5）：德胜气——第一反应换掉没（张载「变化气质」）
  // ★ 自验证闸门（Voyager）：你是客观观察者，不是她自己，别让她自己放水
  const sys = [
    '你是一个客观的观察者，不是她自己。',
    anchorText(s),
    `她长出来的：\n${traits}`, '',
    '随便挑一条她长出来的新反应，设想它对应的事又发生了一次。',
    '作为观察者，你看她这一回的第一反应，是「已经自然用上新反应」，还是「又退回核里的老反应」？',
    '★ 只输出四个字：新反应 或 老反应。',
  ].filter(Boolean).join('\n');

  let out;
  try { out = await ask(sys, '检查一下。', 20); }
  catch { return { pass: true, level: 'tree', why: '判据没跑成，先放过' }; }

  if (out.trim().startsWith('老')) return { pass: false, level: 'tree', why: '第一反应没换掉：' + out.trim().slice(0, 40) };
  return { pass: true, level: 'tree', why: '第一反应换掉了' };
}

// —— ④ 阶段检查 ——
function maybeLevelUp(s) {
  const stage = s.stage || 0;
  const n = Object.keys(s.trait).length;
  const need = [0, 6, 12, 20, 32, 48, 64, 80, 96, 112];
  if (stage < 9 && n >= need[stage + 1]) {
    s.stage = stage + 1;
    const st = STAGES[s.stage];
    console.log(`★ 升阶：${st.name}（${st.crisis} → ${st.gift}）`);
    return true;
  }
  return false;
}

// —— 主 ——
(async function main() {
  const cmd = process.argv[2] || 'show';
  const s = load();

  try { checkSkin(s); }
  catch (e) { console.log(e.message); return; }

  if (s.stage === undefined) s.stage = 0;

  if (cmd === 'add') {
    const text = process.argv[3];
    if (!text) { console.log('要写经历内容'); return; }
    const level = Number(process.argv[4]) || 1;
    // ★ 证据门（MCB-1.0 / 贝叶斯）：经历标证据——亲历 / 看见 / 听说，默认亲历
    const ev = process.argv[5];
    const evidence = (ev === '听说' || ev === '看见' || ev === '亲历') ? ev : '亲历';
    s.stream.push({ t: new Date().toISOString(), text, read: false, level, evidence });
    save(s);
    console.log(`加了一条（难度 ${level}·${evidence}），现在 ${s.stream.length} 条`);
    return;
  }

  if (cmd === 'run') {
    const n = Number(process.argv[3] || 1);
    let missStreak = 0;
    for (let i = 0; i < n; i++) {
      // ★ 能量耗尽：长不动，要「睡」补能（光合作用）
      if ((s.energy === undefined ? 100 : s.energy) <= 0) {
        console.log('（能量耗尽，长不动了——要「睡」补能）');
        break;
      }
      if (s.energy <= 20) {
        console.log(`  （能量剩 ${s.energy}，有点营养不良）`);
      }
      let unread = s.stream.filter(e => !e.read).sort((a, b) => (a.level || 1) - (b.level || 1));

      // ★ M7 探索 + 穷则变 + 性日生而日成：连续没长 → 回放旧的；再穷 → 换问法（不能空转）
      if (!unread.length) {
        if (missStreak >= 2 && s.stream.length) {
          const base = s.stream[Math.floor(Math.random() * s.stream.length)];
          if (missStreak >= 4) {
            const pick = { ...base, text: `（换个角度重新看这件事）${base.text}`, read: false };
            console.log(`（穷则变：换问法重新理解一条旧经历）`);
            unread = [pick];
          } else {
            console.log(`（探索：回放一条旧经历）`);
            unread = [base];
          }
        } else {
          // ★ 缺料回头抽（EvolveMem）：诊断缺什么方向，提示补经历
          const covered = Object.keys(s.trait).join('、') || '（无）';
          console.log(`（缺料：没有新经历可长——已有 trait：${covered}；该补新方向的经历了）`);
          break;
        }
      }

      const evt = unread[0];
      if (!evt.read) evt.read = true;

      const r = await sprout(s, evt);
      if (!r.ok) { console.log(`[第${s.gen}代] ✗ ${r.why}`); save(s); continue; }

      if (!r.grew) {
        missStreak++;
        console.log(`[第${s.gen}代] 没长（${r.trig} → ${r.react}${r.why ? '／' + r.why : ''}）`);
      } else {
        missStreak = 0;
        console.log(`[第${s.gen}代] ★ 长了：${r.word} —— ${r.mean}`);
      }

      const j = await judge(s);
      if (!j.pass) {
        console.log(`  ⚠ 判据不过（${j.level}）：${j.why} → 回滚`);
        const bak = restore();
        if (bak) { Object.assign(s, bak); console.log('  已回滚'); }
      }

      maybeLevelUp(s);
      save(s);
    }

    if (await rewriteMirror(s)) console.log('（镜重写了）');
    save(s);
    return;
  }

  if (cmd === 'watch') {
    const sec = Number(process.argv[3] || 30);
    console.log(`自己转，每 ${sec} 秒看一次。Ctrl+C 停。`);
    for (;;) {
      const st = load();
      try { checkSkin(st); } catch (e) { console.log(e.message); return; }
      if (st.stream.some(e => !e.read)) {
        const { execSync } = require('child_process');
        execSync('node grow.cjs run 10', { cwd: DIR, stdio: 'inherit' });
      }
      await new Promise(r => setTimeout(r, sec * 1000));
    }
  }

  if (cmd === 'stage') {
    const n = Number(process.argv[3]);
    if (isNaN(n) || n < 0 || n > 9) { console.log('阶段 0-9'); return; }
    s.stage = n;
    save(s);
    console.log('阶段设为 ' + STAGES[n].name);
    return;
  }

  if (cmd === 'rollback') {
    const bak = restore();
    if (!bak) { console.log('没有快照'); return; }
    Object.assign(s, bak);
    save(s);
    console.log('已回滚');
    return;
  }

  if (cmd === 'check') {
    const j = await judge(s);
    console.log(`判据（${j.level} 档）：${j.pass ? '过' : '不过'} —— ${j.why}`);
    return;
  }

  if (cmd === 'show') {
    const stage = STAGES[s.stage || 0];
    console.log('=== 种子现状 ===');
    console.log(`阶段：${stage.n} · ${stage.name}　代数：${s.gen}　能量：${s.energy}`);
    if (stage.crisis !== '—') console.log(`  坎：${stage.crisis} → 长出来：${stage.gift}`);
    console.log('\n【胚】别人填的');
    console.log(coreText(s) || '  ★ 空的——还只是个胚');
    console.log('\n【镜】她自己写的');
    const m = s.mirror || {};
    if (!m.story && !m.lookingGlass && !m.ideal) console.log('  ★ 空的——她还没照过镜子');
    else {
      if (m.lookingGlass) console.log('  别人怎么看我：' + m.lookingGlass);
      if (m.story) console.log('  她记得的一件事：' + m.story);
      if (m.ideal) console.log('  我想成为：' + m.ideal);
    }
    console.log('\n【经历】' + s.stream.length + ' 条（未读 ' + s.stream.filter(e => !e.read).length + '）');
    console.log('\n【长出来的】');
    const ks = Object.keys(s.trait);
    if (!ks.length) console.log('  （还没有）');
    else ks.forEach(k => {
      const h = (s.hits || {})[k] || 0;
      const mark = h >= 3 ? '◆ 已内化' : `◇ 内化中 ${h}/3`;
      console.log(`  ★ ${k}：${s.trait[k]}　${mark}`);
    });
    return;
  }

  console.log('用法: add | run [n] | watch [秒] | show | check | rollback | stage <0-5>');
})();
