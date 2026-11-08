// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 悦星野

// 重置种子状态：保留 core 和 stream，清空长出来的东西（trait/history/mirror/stage/gen）。
// 用法：node reset.cjs
const fs = require('fs');
const s = JSON.parse(fs.readFileSync('sprout.json', 'utf8'));
s.gen = 0;
s.stage = 0;
s.energy = 100;
s.trait = {};
s.history = [];
s.hits = {};
if (s.mirror) {
  s.mirror.lookingGlass = '';
  s.mirror.story = '';
  s.mirror.ideal = '';
  s.mirror.writtenAt = '';
}
s.stream.forEach(e => { e.read = false; });
s.seeds = [];
s.lastSprout = '';
s.bornAt = '';
s.errata = [];
fs.writeFileSync('sprout.json', JSON.stringify(s, null, 2));
console.log('reset ok: gen=0, trait=0, 未读 ' + s.stream.filter(e => !e.read).length + ' 条');
