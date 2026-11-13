// GENESIS TOKEN - game logic (no DOM code here).
(function (root) {
  var C = root.GT_CONFIG;

  function createGame(opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random;
    var state = null;
    var records = { endings: 0, best_clear_time: null, total_genesis: 0 };
    var autoAcc = 0;
    var word = '';
    var streak = 0, burnLeft = 0;   // Burning time: not saved

    // ---------- state ----------
    function newState() {
      return {
        version: 1,
        saved_at: 0,
        tokens: 0,
        auto_miner_level: 1,
        mine_level: 1,
        inventory_size: C.INVENTORY.startSize,
        next_jewel_id: 1,
        jewels: [],
        slots: [],
        combos_found: [],
        genesis_owned: 0,
        stats: { play_time: 0, words_typed: 0, jewels_found: 0, best_jewel: null, clear_time: null }
      };
    }

    // ---------- Wallet: the only place tokens change ----------
    function earn(n) { state.tokens += n; }
    function pay(cost) {
      if (state.tokens < cost) return false;
      state.tokens -= cost;
      return true;
    }
    function fail(msg) { return { ok: false, msg: msg }; }
    var NO_TOKENS = 'Not enough tokens.';

    // ---------- Auto Miner ----------
    function autoAmount(lv) {
      lv = lv || state.auto_miner_level;
      return Math.round((C.AUTO.baseAmount + C.AUTO.amountPerLevel * (lv - 1)) * 10) / 10;
    }
    function autoCost() {
      if (state.auto_miner_level >= C.AUTO.maxLevel) return null;
      return Math.round(C.AUTO.costBase * Math.pow(C.AUTO.costGrowth, state.auto_miner_level - 1));
    }
    function autoLevelUp() {
      var cost = autoCost();
      if (cost === null) return fail('Auto mine is already MAX.');
      if (!pay(cost)) return fail(NO_TOKENS);
      state.auto_miner_level++;
      return { ok: true, msg: 'Auto mine Lv.' + state.auto_miner_level + '!' };
    }

    // dt in seconds. Returns number of auto payouts done.
    function tick(dt) {
      if (!(dt > 0)) return 0;
      dt = Math.min(dt, C.MAX_TICK_GAP_SEC);
      state.stats.play_time += dt;
      if (burnLeft > 0) {
        burnLeft -= dt;
        if (burnLeft <= 0) stopBurn();
      }
      autoAcc += dt;
      var interval = effects().interval;
      var count = 0;
      while (autoAcc >= interval) {
        autoAcc -= interval;
        earn(applyReward(autoAmount(), true).amount);
        count++;
      }
      return count;
    }
    function autoProgress() { return Math.min(1, autoAcc / effects().interval); }

    // ---------- Jewels ----------
    function gradeIndex(g) { return C.GRADES.indexOf(g); }
    function jewelPoint(j) { return C.GRADE_MULT[j.grade] * (1 + C.JEWEL.powerPerLevel * (j.level - 1)); }
    function jewelPower(j) { return C.JEWEL.powerBase * jewelPoint(j); }
    function jewelLevelCost(j) {
      if (j.level >= C.JEWEL.maxLevel) return null;
      return C.JEWEL.levelCostBase * Math.pow(C.JEWEL.levelCostGrowth, j.level - 1);
    }
    function sellPrice(j) { return Math.floor((C.GRADE_VALUE[j.grade] + j.spent) * C.JEWEL.sellRate); }
    function getJewel(id) {
      for (var i = 0; i < state.jewels.length; i++) if (state.jewels[i].id === id) return state.jewels[i];
      return null;
    }
    function isEquipped(id) {
      for (var s = 0; s < state.slots.length; s++) {
        if (state.slots[s].equipped.indexOf(id) >= 0) return true;
      }
      return false;
    }
    function jewelName(j) { return j.grade + ' ' + j.kind; }

    // Adds a dropped jewel. Auto-sells at Lv.1 price when inventory is full.
    function addJewel(kind, grade) {
      state.stats.jewels_found++;
      var best = state.stats.best_jewel;
      if (!best || gradeIndex(grade) > gradeIndex(best.split(' ')[0])) state.stats.best_jewel = grade + ' ' + kind;
      if (state.jewels.length >= state.inventory_size) {
        var price = Math.floor(C.GRADE_VALUE[grade] * C.JEWEL.sellRate);
        earn(price);
        return { sold: true, price: price, name: grade + ' ' + kind };
      }
      var j = { id: state.next_jewel_id++, kind: kind, grade: grade, level: 1, spent: 0 };
      state.jewels.push(j);
      return { sold: false, jewel: j, name: jewelName(j) };
    }
    function jewelLevelUp(id) {
      var j = getJewel(id);
      if (!j) return fail('No jewel selected.');
      var cost = jewelLevelCost(j);
      if (cost === null) return fail('This jewel is already MAX.');
      if (!pay(cost)) return fail(NO_TOKENS);
      j.level++;
      j.spent += cost;
      return { ok: true, msg: jewelName(j) + ' Lv.' + j.level + '!' };
    }
    function sellJewel(id) {
      var j = getJewel(id);
      if (!j) return fail('No jewel selected.');
      if (isEquipped(id)) return fail('Cannot sell equipped jewel.');
      var price = sellPrice(j);
      state.jewels.splice(state.jewels.indexOf(j), 1);
      earn(price);
      return { ok: true, msg: 'Sold ' + jewelName(j) + ' for ' + fmt(price) + '.' };
    }

    // ---------- Inventory ----------
    function expandCost() {
      if (state.inventory_size >= C.INVENTORY.maxSize) return null;
      return C.INVENTORY.expandCosts[(state.inventory_size - C.INVENTORY.startSize) / C.INVENTORY.step];
    }
    function expand() {
      var cost = expandCost();
      if (cost == null) return fail('Inventory is already MAX.');
      if (!pay(cost)) return fail(NO_TOKENS);
      state.inventory_size += C.INVENTORY.step;
      return { ok: true, msg: 'Inventory expanded to ' + state.inventory_size + '.' };
    }

    // ---------- Slots ----------
    function slotBuyCost() {
      if (state.slots.length >= C.SLOTS.length) return null;
      return C.SLOTS[state.slots.length][0];
    }
    function buySlot() {
      var cost = slotBuyCost();
      if (cost === null) return fail('All slots are bought.');
      if (!pay(cost)) return fail(NO_TOKENS);
      state.slots.push({ level: 1, equipped: [null] });
      return { ok: true, msg: 'Slot ' + state.slots.length + ' bought!' };
    }
    function slotLevelCost(i) {
      var s = state.slots[i];
      if (!s || s.level >= 3) return null;
      return C.SLOTS[i][s.level];
    }
    function slotLevelUp(i) {
      if (!state.slots[i]) return fail('No slot selected.');
      var cost = slotLevelCost(i);
      if (cost === null) return fail('Slot ' + (i + 1) + ' is already MAX.');
      if (!pay(cost)) return fail(NO_TOKENS);
      state.slots[i].level++;
      state.slots[i].equipped.push(null);
      return { ok: true, msg: 'Slot ' + (i + 1) + ' Lv.' + state.slots[i].level + '!' };
    }
    function freeJewels() {
      return state.jewels.filter(function (j) { return !isEquipped(j.id); });
    }
    function equip(si, ci, id) {
      var s = state.slots[si];
      if (!s || ci < 0 || ci >= s.equipped.length) return fail('No cell selected.');
      var j = getJewel(id);
      if (!j || isEquipped(id)) return fail('Jewel not available.');
      s.equipped[ci] = id; // previous jewel (if any) goes back to inventory
      var msg = 'Equipped ' + jewelName(j) + '.';
      var found = checkNewCombos();
      if (found.length) msg = 'New combo found: ' + found.join(', ') + '!';
      return { ok: true, msg: msg };
    }
    function unequip(si, ci) {
      var s = state.slots[si];
      if (!s || s.equipped[ci] == null) return fail('Cell is empty.');
      var j = getJewel(s.equipped[ci]);
      s.equipped[ci] = null;
      return { ok: true, msg: 'Unequipped ' + jewelName(j) + '.' };
    }

    // ---------- Combos ----------
    function sortedKey(kinds) { return kinds.slice().sort().join('+'); }
    function slotJewels(s) {
      return s.equipped.map(function (id) { return id == null ? null : getJewel(id); });
    }
    function slotCombo(si) {
      var s = state.slots[si];
      if (!s || s.equipped.length < 3) return null;
      var js = slotJewels(s);
      if (js.some(function (j) { return !j; })) return null;
      var key = sortedKey(js.map(function (j) { return j.kind; }));
      for (var i = 0; i < C.COMBOS.length; i++) {
        if (sortedKey(C.COMBOS[i].kinds) === key) return C.COMBOS[i];
      }
      return null;
    }
    function checkNewCombos() {
      var found = [];
      for (var i = 0; i < state.slots.length; i++) {
        var c = slotCombo(i);
        if (c && state.combos_found.indexOf(c.name) < 0) {
          state.combos_found.push(c.name);
          found.push(c.name);
        }
      }
      return found;
    }

    // ---------- Effects ----------
    function effects() {
      var E = C.EFFECT;
      var total = { Ruby: 0, Topaz: 0, Sapphire: 0, Emerald: 0 };
      var amountPct = 0, intervalCut = 0, doubleBonus = 0, triple = false, allSlotPct = 0;
      var perSlot = [];
      for (var si = 0; si < state.slots.length; si++) {
        var js = slotJewels(state.slots[si]).filter(Boolean);
        var combo = slotCombo(si);
        var b = {};
        if (combo) {
          var avg = js.reduce(function (a, j) { return a + jewelPoint(j); }, 0) / js.length;
          var scale = 1 + C.COMBO_SCALE_PER_POINT * (avg - 1);
          for (var k in combo.bonus) b[k] = combo.bonus[k] === true ? true : combo.bonus[k] * scale;
          amountPct += b.amountPct || 0;
          intervalCut += b.intervalCut || 0;
          doubleBonus += b.doubleChance || 0;
          allSlotPct += b.allSlotPct || 0;
          if (b.triple) triple = true;
        }
        var diamond = 0;
        js.forEach(function (j) { if (j.kind === 'Diamond') diamond += jewelPower(j); });
        var amp = (1 + diamond * E.diamondAmp * (1 + (b.diamondAmp || 0))) * (1 + (b.allPct || 0));
        var sums = { Ruby: 0, Topaz: 0, Sapphire: 0, Emerald: 0 };
        js.forEach(function (j) {
          if (j.kind === 'Diamond') return;
          var p = jewelPower(j) * amp;
          if (j.kind === 'Ruby') p *= 1 + (b.rubyPct || 0);
          if (j.kind === 'Topaz') p *= 1 + (b.topazPct || 0);
          sums[j.kind] += p;
        });
        perSlot.push(sums);
      }
      perSlot.forEach(function (sums) {
        for (var k in sums) total[k] += sums[k] * (1 + allSlotPct);
      });
      intervalCut = Math.min(intervalCut, E.maxIntervalCut);
      var baseInterval = Math.max(C.AUTO.minIntervalSec,
        C.AUTO.intervalSec - (C.AUTO.intervalPerLevel || 0) * (state.auto_miner_level - 1));
      var interval = baseInterval / (1 + total.Sapphire * E.sapphireSpeed) * (1 - intervalCut);
      return {
        typeFlat: total.Ruby * E.rubyTypeFlat,
        autoFlat: total.Ruby * E.rubyAutoFlat,
        mult: (1 + total.Topaz * E.topazPct) * (1 + amountPct),
        interval: Math.max(C.AUTO.minIntervalSec, interval),
        doubleChance: Math.min(E.maxDoubleChance, total.Emerald * E.emeraldChance + doubleBonus),
        triple: triple
      };
    }
    function applyReward(base, isAuto) {
      var e = effects();
      var amount = (base + (isAuto ? e.autoFlat : e.typeFlat)) * e.mult;
      var lucky = 1;
      if (rng() < e.doubleChance) lucky = e.triple ? 3 : 2;
      return { amount: amount * lucky, lucky: lucky };
    }

    // ---------- Mine ----------
    function mineCost() {
      if (state.mine_level >= C.MINE.maxLevel) return null;
      return Math.round(C.MINE.costBase * Math.pow(C.MINE.costGrowth, state.mine_level - 1));
    }
    function mineLevelUp() {
      var cost = mineCost();
      if (cost === null) return fail('Mine is already MAX.');
      if (!pay(cost)) return fail(NO_TOKENS);
      state.mine_level++;
      newWord();
      return { ok: true, msg: 'Mine Lv.' + state.mine_level + '!' };
    }
    function mineRewardRange(lv) {
      lv = lv || state.mine_level;
      var b = C.MINE.rewardBase * Math.pow(C.MINE.rewardGrowth, lv - 1);
      return [Math.round(b), Math.round(b * C.MINE.rewardSpread)];
    }
    function jewelChance(lv) {
      lv = lv || state.mine_level;
      var c = C.MINE.jewelChanceBase + C.MINE.jewelChancePerLevel * (lv - 1);
      return C.TEST_JEWEL_RATE ? c * C.TEST_JEWEL_MULT : c;
    }
    function charsetOf(lv) {
      var ch = C.CHARS, t = C.MINE.charsets[lv - 1];
      if (t === 'lower') return ch.lower;
      if (t === 'lowernum') return ch.lower + ch.digit;
      if (t === 'mixed') return ch.lower + ch.upper;
      return ch.lower + ch.upper + ch.digit;
    }
    function pick(str) { return str.charAt(Math.floor(rng() * str.length)); }
    function newWord() {
      var lv = state.mine_level, len = C.MINE.lengths[lv - 1], easy = burnLeft > 0;
      var set = easy ? C.CHARS.lower : charsetOf(lv);
      var arr = [];
      for (var i = 0; i < len; i++) arr.push(easy && i > 0 ? arr[0] : pick(set));
      if (!easy && C.MINE.charsets[lv - 1] === 'confusing') {
        for (var n = 0; n < C.MINE.confusingMin; n++) arr[Math.floor(rng() * len)] = pick(C.CHARS.confusing);
      }
      word = arr.join('');
      return word;
    }
    function rollGrade() {
      var lv = state.mine_level, r = rng() * 100, acc = 0;
      for (var i = C.GRADES.length - 1; i >= 1; i--) {
        var g = C.GRADE_CHANCE[C.GRADES[i]];
        acc += g.base + g.perLevel * (lv - 1);
        if (r < acc) return C.GRADES[i];
      }
      return 'Normal';
    }
    function rollJewel() {
      return { kind: C.KINDS[Math.floor(rng() * C.KINDS.length)], grade: rollGrade() };
    }
    // Burning time: ends on time out, typo, or leaving the Mine screen.
    function stopBurn() {
      var was = burnLeft > 0;
      streak = 0;
      burnLeft = 0;
      if (was) newWord();
    }
    function submit(input) {
      var target = word, burning = burnLeft > 0;
      if (input !== target) {
        stopBurn();
        newWord();
        return fail(burning ? 'Burning time over. Typo!' : 'Wrong. Try the next one.');
      }
      state.stats.words_typed++;
      var range = mineRewardRange();
      var base = burning ? range[1] : range[0] + Math.floor(rng() * (range[1] - range[0] + 1));
      var r = applyReward(base, false);
      earn(r.amount);
      var msg = '+' + fmt(r.amount) + ' tokens!' + (r.lucky > 1 ? ' (x' + r.lucky + ')' : '');
      if (!burning && ++streak >= C.MINE.burnStreak) { burnLeft = C.MINE.burnSec + C.MINE.burnSecPerLevel * (state.mine_level - 1); msg += '  BURNING TIME!'; }
      newWord();
      if (rng() < jewelChance()) {
        var jw = rollJewel();
        var res = addJewel(jw.kind, jw.grade);
        msg += res.sold ? '  Inventory full. Jewel auto-sold for ' + fmt(res.price) + '.' : '  Got ' + res.name + '!';
      }
      return { ok: true, msg: msg, amount: r.amount };
    }

    // ---------- Genesis ----------
    function genesisChecks() {
      var slotsMax = state.slots.length === 3 && state.slots.every(function (s) { return s.level === 3; });
      var allJewels = slotsMax && state.slots.every(function (s) {
        return s.equipped.every(function (id) { var j = id != null && getJewel(id); return j && j.level >= C.JEWEL.maxLevel; });
      });
      return [
        { label: 'Auto mine Lv.50', done: state.auto_miner_level >= C.AUTO.maxLevel },
        { label: 'Mine Lv.10', done: state.mine_level >= C.MINE.maxLevel },
        { label: 'All 3 slots Lv.3', done: slotsMax },
        { label: '9 cells filled with Lv.10 jewels', done: allJewels },
        { label: 'Inventory 50', done: state.inventory_size >= C.INVENTORY.maxSize }
      ];
    }
    function genesisUnlocked() {
      return state.genesis_owned > 0 || genesisChecks().every(function (c) { return c.done; });
    }
    function buyGenesis() {
      if (!genesisUnlocked()) return fail('Genesis is locked.');
      if (!pay(C.GENESIS_PRICE)) return fail(NO_TOKENS);
      var first = state.genesis_owned === 0;
      state.genesis_owned++;
      records.total_genesis++;
      if (first) {
        state.stats.clear_time = state.stats.play_time;
        records.endings++;
        if (records.best_clear_time == null || state.stats.play_time < records.best_clear_time) {
          records.best_clear_time = state.stats.play_time;
        }
      }
      return { ok: true, serial: state.genesis_owned, msg: 'You forged Genesis Token #' + state.genesis_owned + '!' };
    }
    function newGame() {
      state = newState();
      autoAcc = 0;
      newWord();
    }

    // ---------- Save ----------
    // storage: object with getItem/setItem (localStorage)
    function save(storage) {
      state.saved_at = Date.now() / 1000;
      var prev = storage.getItem(C.SAVE_KEY);
      if (prev) storage.setItem(C.BACKUP_KEY, prev);
      storage.setItem(C.SAVE_KEY, JSON.stringify(state, null, 2));
      storage.setItem(C.RECORDS_KEY, JSON.stringify(records, null, 2));
    }
    function validSave(s) {
      return s && s.version === 1 && typeof s.tokens === 'number' && Array.isArray(s.jewels) &&
        Array.isArray(s.slots) && Array.isArray(s.combos_found) && s.stats && typeof s.stats === 'object';
    }
    // Returns a message when the save was corrupted, else null.
    function load(storage) {
      try {
        var r = JSON.parse(storage.getItem(C.RECORDS_KEY) || 'null');
        if (r && typeof r === 'object') {
          records.endings = r.endings || 0;
          records.best_clear_time = r.best_clear_time == null ? null : r.best_clear_time;
          records.total_genesis = r.total_genesis || 0;
        }
      } catch (e) { /* keep default records */ }
      var raw = storage.getItem(C.SAVE_KEY);
      newGame();
      if (!raw) return null;
      try {
        var s = JSON.parse(raw);
        if (!validSave(s)) throw new Error('invalid');
        var base = newState();
        for (var k in base) if (s[k] === undefined) s[k] = base[k];
        for (var t in base.stats) if (s.stats[t] === undefined) s.stats[t] = base.stats[t];
        state = s;
        newWord();
        return null;
      } catch (e) {
        return 'Save file was corrupted. Starting a new game.';
      }
    }

    newGame();

    return {
      get state() { return state; },
      get records() { return records; },
      get word() { return word; },
      get streak() { return streak; },
      get burnLeft() { return burnLeft; },
      stopBurn: stopBurn,
      tick: tick, autoProgress: autoProgress, autoAmount: autoAmount, autoCost: autoCost, autoLevelUp: autoLevelUp,
      mineCost: mineCost, mineLevelUp: mineLevelUp, mineRewardRange: mineRewardRange, jewelChance: jewelChance,
      newWord: newWord, submit: submit,
      getJewel: getJewel, isEquipped: isEquipped, jewelPower: jewelPower, jewelLevelCost: jewelLevelCost,
      sellPrice: sellPrice, jewelLevelUp: jewelLevelUp, sellJewel: sellJewel, addJewel: addJewel, rollJewel: rollJewel,
      expandCost: expandCost, expand: expand,
      slotBuyCost: slotBuyCost, buySlot: buySlot, slotLevelCost: slotLevelCost, slotLevelUp: slotLevelUp,
      freeJewels: freeJewels, equip: equip, unequip: unequip, slotCombo: slotCombo,
      effects: effects, earn: earn,
      genesisChecks: genesisChecks, genesisUnlocked: genesisUnlocked, buyGenesis: buyGenesis, newGame: newGame,
      save: save, load: load
    };
  }

  function fmt(n) { return Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function dur(sec) {
    sec = Math.floor(sec || 0);
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    return h > 0 ? h + 'h ' + m + 'm' : m + 'm ' + (sec % 60) + 's';
  }

  root.GT = { createGame: createGame, fmt: fmt, dur: dur };
})(typeof window !== 'undefined' ? window : globalThis);
