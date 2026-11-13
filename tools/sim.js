// GENESIS TOKEN - balance simulation. Usage: node tools/sim.js [runs] [typingHoursPerDay]
const fs = require('fs');
const path = require('path');
const vm = require('vm');

for (const f of ['config.js', 'game.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'public', f), 'utf8'), { filename: f });
}
const C = globalThis.GT_CONFIG;
const RUNS = +process.argv[2] || 20;
const TYPE_HOURS = +process.argv[3] || 1;
const PLAY_HOURS = 8, TYPO = 0.1, MAX_DAYS = 60;
const GRADE = { Normal: 0, Rare: 1, Unique: 2, Legendary: 3 };

function score(j) { return GRADE[j.grade] * 100 + j.level; }

// Greedy player: buy the cheapest useful upgrade, keep best jewels equipped.
function shop(g) {
  const s = g.state;
  for (let guard = 0; guard < 200; guard++) {
    // equip: fill empty cells / replace weaker jewels
    for (let si = 0; si < s.slots.length; si++) {
      s.slots[si].equipped.forEach((id, ci) => {
        const free = g.freeJewels().sort((a, b) => score(b) - score(a))[0];
        const cur = id == null ? null : g.getJewel(id);
        if (free && (!cur || score(free) > score(cur))) g.equip(si, ci, free.id);
      });
    }
    // sell extras when inventory is full
    if (s.jewels.length >= s.inventory_size) {
      const extra = g.freeJewels().sort((a, b) => score(a) - score(b))[0];
      if (extra) g.sellJewel(extra.id);
    }
    const opts = [];
    if (g.autoCost() != null) opts.push([g.autoCost(), () => g.autoLevelUp()]);
    if (g.mineCost() != null) opts.push([g.mineCost(), () => g.mineLevelUp()]);
    if (g.slotBuyCost() != null) opts.push([g.slotBuyCost(), () => g.buySlot()]);
    s.slots.forEach((_, i) => { if (g.slotLevelCost(i) != null) opts.push([g.slotLevelCost(i), () => g.slotLevelUp(i)]); });
    if (g.expandCost() != null) opts.push([g.expandCost(), () => g.expand()]);
    s.jewels.filter(j => g.isEquipped(j.id) && g.jewelLevelCost(j) != null)
      .forEach(j => opts.push([g.jewelLevelCost(j), () => g.jewelLevelUp(j.id)]));
    if (g.genesisUnlocked()) opts.push([C.GENESIS_PRICE, () => g.buyGenesis()]);
    if (!opts.length) return;
    opts.sort((a, b) => a[0] - b[0]);
    if (!opts[0][1]().ok) return;
    if (s.genesis_owned > 0) return;
  }
}

function runOnce() {
  const g = GT.createGame();
  let typeIncome = 0, total = 0;
  for (let day = 0; day < MAX_DAYS; day++) {
    let typed = 0;
    while (typed < TYPE_HOURS * 3600) {
      const len = g.word.length, t = 2 + 0.9 * len;
      const before = g.state.tokens;
      g.tick(t); typed += t;
      const mid = g.state.tokens;
      total += mid - before;
      const r = g.submit(Math.random() < TYPO ? '' : g.word);
      if (r.ok) { typeIncome += r.amount; total += r.amount; }
      shop(g);
      if (g.state.genesis_owned) return { days: day + typed / 3600 / PLAY_HOURS, share: typeIncome / total };
    }
    for (let idle = 0; idle < (PLAY_HOURS - TYPE_HOURS) * 3600; idle += 60) {
      const before = g.state.tokens;
      g.tick(60);
      total += g.state.tokens - before;
      shop(g);
      if (g.state.genesis_owned) return { days: day + 1, share: typeIncome / total };
    }
  }
  return { days: MAX_DAYS, share: typeIncome / total };
}

const res = [];
for (let i = 0; i < RUNS; i++) res.push(runOnce());
res.sort((a, b) => a.days - b.days);
const q = p => res[Math.min(res.length - 1, Math.floor(p * res.length))].days.toFixed(1);
const share = res.reduce((a, r) => a + r.share, 0) / res.length;
console.log(`runs=${RUNS} typing=${TYPE_HOURS}h/day`);
console.log(`best ${q(0)}d | top10% ${q(0.1)}d | median ${q(0.5)}d | bottom10% ${q(0.9)}d`);
console.log(`typing income share ${(share * 100).toFixed(1)}%`);
