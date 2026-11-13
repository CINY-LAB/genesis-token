// GENESIS TOKEN - screen rendering and input.
(function (root) {
  var C = root.GT_CONFIG, fmt = root.GT.fmt, dur = root.GT.dur;
  var LIST_ROWS = 12;

  function createUI(game, el, hooks) {
    var ui = {
      screen: 'main', msg: '', input: '',
      slot: 0, cell: 0, popup: null, popupCursor: 0,
      inv: 0, combo: 0, serial: 0,
      editing: false, urlInput: '',
      menu: 0, mineMode: 'type', mineSel: 0, burning: false, flash: 0
    };
    var URL_RE = /^https?:\/\/\S+$/i;
    var URL_CHAR = /^[A-Za-z0-9:\/.\-_?=&%#~+@!$'()*,;]$/;
    function bossUrl() {
      try {
        var u = localStorage.getItem(C.BOSS_URL_KEY);
        if (u && URL_RE.test(u)) return u;
      } catch (e) { /* storage blocked: use default */ }
      return C.BOSS_URL_DEFAULT;
    }
    function setBossUrl(u) {
      try {
        if (u == null) localStorage.removeItem(C.BOSS_URL_KEY);
        else localStorage.setItem(C.BOSS_URL_KEY, u);
        return true;
      } catch (e) { return false; }
    }

    function esc(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function btn(key, label) { return '<span class="btn" data-key="' + key + '">' + esc(label) + '</span>'; }
    function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }
    function header(title) {
      return '<div class="title">=== ' + esc(title) + ' ===</div>' +
        '<div>Tokens: <span class="tok">' + fmt(game.state.tokens) + '</span></div><br>';
    }
    function cost(n) { return n == null ? 'MAX' : fmt(n); }
    function footer(keys) {
      return '<br><div class="keys">' + keys.join('  ') + '</div>' +
        '<div class="msg">' + esc(ui.msg || ' ') + '</div>';
    }
    function scrollWindow(len, cursor) {
      var start = Math.max(0, Math.min(cursor - Math.floor(LIST_ROWS / 2), len - LIST_ROWS));
      return [start, Math.min(len, start + LIST_ROWS)];
    }

    // ---------- screens ----------
    function renderMain() {
      var s = game.state, e = game.effects();
      var bar = Math.round(game.autoProgress() * 20);
      var h = header('GENESIS TOKEN');
      h += '<div>' + pad('Auto mine', 11) + 'Lv.' + s.auto_miner_level + '  ' + game.autoAmount() + ' / ' +
        e.interval.toFixed(1) + 's  [' + new Array(bar + 1).join('#') + new Array(21 - bar).join('.') + ']</div>';
      h += '<div>' + pad('Mine', 11) + 'Lv.' + s.mine_level + '</div>';
      h += '<div>' + pad('Slots', 11) + s.slots.length + '/3</div>';
      h += '<div>' + pad('Inventory', 11) + s.jewels.length + '/' + s.inventory_size + '</div>';
      if (s.genesis_owned > 0) h += '<div>' + pad('Genesis', 11) + s.genesis_owned + '</div>';
      h += '<div class="dim">' + pad('Bonus', 11) + 'x' + e.mult.toFixed(2) + ' amount, +' + e.typeFlat.toFixed(1) +
        ' per word, ' + Math.round(e.doubleChance * 100) + '% ' + (e.triple ? 'triple' : 'double') + '</div>';
      h += '<br>' + menuRows(mainMenu(), ui.menu);
      var keys = ['[Up/Down] Move  [Enter] Select'];
      if (C.DEV_MODE) {
        keys.push('<br><span class="dev">DEV</span> ' + btn('t', '[t] +100,000 tokens'), btn('g', '[g] Give jewel'),
          btn('x', '[x] Jewel rate x10: ' + (C.TEST_JEWEL_RATE ? 'ON' : 'OFF')));
      }
      return h + footer(keys);
    }

    // Menu rows with a cursor. Number/letter shortcuts still work.
    function mainMenu() {
      var m = [['1', '[1] Mine'], ['2', '[2] Slots'], ['3', '[3] Inventory'], ['4', '[4] Combos']];
      if (game.genesisUnlocked()) m.push(['5', '[5] Genesis']);
      return m.concat([['u', '[u] Auto mine level up' + (game.autoCost() == null ? ' (MAX)' : ' (Next: ' + fmt(game.autoCost()) + ')')], ['s', '[s] Settings'], ['q', '[q] Save & Quit']]);
    }
    var MINE_MENU = [['Tab', '[Tab] Level up'], ['b', '[b] Back']];
    function menuRows(items, cursor) {
      return items.map(function (it, i) {
        var on = i === cursor;
        return '<div class="row btn' + (on ? ' sel' : '') + '" data-key="' + esc(it[0]) + '">' +
          (on ? '&gt; ' : '  ') + esc(it[1]) + '</div>';
      }).join('');
    }
    function moveCursor(k, cursor, len) {
      if (k === 'arrowup') return Math.max(0, cursor - 1);
      if (k === 'arrowdown') return Math.min(len - 1, cursor + 1);
      return cursor;
    }

    function renderMine() {
      var s = game.state, w = game.word, r = game.mineRewardRange();
      var typing = ui.mineMode === 'type', burn = game.burnLeft > 0;
      var fx = burn ? ' burn' + (ui.flash++ % 2) : '';
      var h = header('MINE Lv.' + s.mine_level);
      h += '<div>' + btn('Escape', typing ? 'Mode: TYPING (타이핑)  [Esc] Select mode (선택 모드)'
        : 'Mode: SELECT (선택)  [Esc] Typing mode (타이핑 모드)') + '</div>';
      h += '<div>Type:  <span class="word' + fx + '">' + esc(w) + '</span></div>';
      h += '<div>Input: <span class="word">' + esc(ui.input) + (typing ? '<span class="cur">_</span>' : '') + '</span></div>';
      h += '<div class="dim">Combo ' + (burn ? C.MINE.burnStreak : game.streak) + '/' + C.MINE.burnStreak + '</div><br>';
      h += '<div class="dim">Reward ' + fmt(r[0]) + '~' + fmt(r[1]) + '  Jewel ' +
        (game.jewelChance() * 100).toFixed(1) + '%</div>';
      h += '<div>Mine level up: ' + cost(game.mineCost()) + '</div>';
      if (!typing) h += '<br>' + menuRows(MINE_MENU, ui.mineSel);
      h += footer(typing ? [btn('Enter', '[Enter] Submit'), btn('Escape', '[Esc] Select mode')]
        : ['[Up/Down] Move  [Enter] Select', btn('Escape', '[Esc] Typing mode')]);
      if (burn) h += '<div class="' + fx + '">*** BURNING TIME *** (' + Math.max(0, game.burnLeft).toFixed(1) + 's)</div>';
      return h;
    }

    function cellLabel(id, selected) {
      var t = id == null ? 'empty' : game.getJewel(id).kind;
      return selected ? '<span class="sel">&gt;[' + t + ']&lt;</span>' : '[' + t + ']';
    }
    function renderSlots() {
      var s = game.state, h = header('SLOTS');
      for (var i = 0; i < 3; i++) {
        var sl = s.slots[i], on = i === ui.slot && sl;
        var row = (on ? '&gt; ' : '  ') + 'Slot ' + (i + 1) + ' ';
        if (!sl) row += '(locked)';
        else {
          row += 'Lv.' + sl.level + '  ';
          row += sl.equipped.map(function (id, ci) {
            return '<span data-slot="' + i + '" data-cell="' + ci + '">' + cellLabel(id, on && ci === ui.cell) + '</span>';
          }).join(' ');
        }
        h += '<div class="row" data-slot="' + i + '">' + row + '</div>';
      }
      h += '<br>';
      var cur = s.slots[ui.slot];
      if (cur) {
        var jid = cur.equipped[ui.cell], j = jid == null ? null : game.getJewel(jid);
        h += '<div class="dim">Cell: ' + (j ? esc(j.grade + ' ' + j.kind + ' Lv.' + j.level) : 'empty') + '</div>';
        h += '<div>Slot ' + (ui.slot + 1) + ' level up: ' + cost(game.slotLevelCost(ui.slot)) + '</div>';
      }
      h += '<div>Buy next slot: ' + cost(game.slotBuyCost()) + '</div>';
      var c = cur ? game.slotCombo(ui.slot) : null;
      h += '<div>Combo: ' + (c ? '<span class="good">' + esc(c.name) + '</span> (' + esc(c.text) + ')' : 'none') + '</div>';
      if (ui.popup) h += renderPopup();
      return h + footer([btn('n', '[n] Buy slot'), btn('l', '[l] Level up'), btn('e', '[e] Equip'),
        btn('r', '[r] Unequip'), btn('b', '[b] Back')]);
    }
    function renderPopup() {
      var list = ui.popup, h = '<div class="popup"><div class="title">Equip jewel</div>';
      var win = scrollWindow(list.length, ui.popupCursor);
      for (var i = win[0]; i < win[1]; i++) {
        var j = list[i];
        h += '<div class="row" data-pick="' + i + '">' + (i === ui.popupCursor ? '&gt; ' : '  ') +
          pad('#' + (game.state.jewels.indexOf(j) + 1), 5) + pad(j.kind, 10) + pad(j.grade, 10) + 'Lv.' + j.level + '</div>';
      }
      return h + '<div class="dim">[Enter] Equip  [b] Cancel</div></div>';
    }

    function renderInventory() {
      var s = game.state, h = header('INVENTORY ' + s.jewels.length + '/' + s.inventory_size);
      if (!s.jewels.length) h += '<div class="dim">No jewels yet. Mine to find some.</div>';
      var win = scrollWindow(s.jewels.length, ui.inv);
      for (var i = win[0]; i < win[1]; i++) {
        var j = s.jewels[i];
        h += '<div class="row g-' + j.grade + '" data-inv="' + i + '">' + (i === ui.inv ? '&gt; ' : '  ') +
          pad('#' + (i + 1), 5) + pad(j.kind, 10) + pad(j.grade, 10) + pad('Lv.' + j.level, 6) +
          (game.isEquipped(j.id) ? '[E]' : '') + '</div>';
      }
      if (s.jewels.length > LIST_ROWS) h += '<div class="dim">(' + (ui.inv + 1) + '/' + s.jewels.length + ')</div>';
      h += '<br>';
      var sel = s.jewels[ui.inv];
      if (sel) h += '<div>Level up: ' + cost(game.jewelLevelCost(sel)) + '   Sell: ' + fmt(game.sellPrice(sel)) +
        '   Power: ' + game.jewelPower(sel).toFixed(2) + '</div>';
      var ec = game.expandCost();
      h += '<div>' + (ec == null ? 'Expand: MAX' : 'Expand +5: ' + fmt(ec)) + '</div>';
      return h + footer([btn('l', '[l] Level up'), btn('x', '[x] Sell'), btn('e', '[e] Expand'), btn('b', '[b] Back')]);
    }

    function renderCombos() {
      var found = game.state.combos_found;
      var h = header('COMBOS ' + found.length + '/' + C.COMBOS.length);
      var win = scrollWindow(C.COMBOS.length, ui.combo);
      for (var i = win[0]; i < win[1]; i++) {
        var c = C.COMBOS[i], on = found.indexOf(c.name) >= 0;
        h += '<div class="row">' + (i === ui.combo ? '&gt; ' : '  ') + pad(i + 1, 3) +
          (on ? pad(c.name, 14) + pad(recipe(c.kinds), 28) + esc(c.text) : '???') + '</div>';
      }
      return h + footer([btn('ArrowUp', '[Up]'), btn('ArrowDown', '[Down] Scroll'), btn('b', '[b] Back')]);
    }
    function recipe(kinds) {
      var cnt = {};
      kinds.forEach(function (k) { cnt[k] = (cnt[k] || 0) + 1; });
      return Object.keys(cnt).map(function (k) { return cnt[k] > 1 ? k + ' x' + cnt[k] : k; }).join(' + ');
    }

    function renderGenesis() {
      var h = header('GENESIS');
      game.genesisChecks().forEach(function (c) { h += '<div>' + (c.done ? '[x] ' : '[ ] ') + esc(c.label) + '</div>'; });
      h += '<br><div>Price: ' + fmt(C.GENESIS_PRICE) + '   Owned: ' + game.state.genesis_owned + '</div>';
      return h + footer([btn('Enter', '[Enter] Buy'), btn('b', '[b] Back')]);
    }

    // ---------- ending ----------
    var FONT = {
      G: [' ███ ', '█    ', '█ ██ ', '█  █ ', ' ███ '],
      E: ['████', '█   ', '███ ', '█   ', '████'],
      N: ['█   █', '██  █', '█ █ █', '█  ██', '█   █'],
      S: [' ███', '█   ', ' ██ ', '   █', '███ '],
      I: ['███', ' █ ', ' █ ', ' █ ', '███'],
      T: ['█████', '  █  ', '  █  ', '  █  ', '  █  '],
      O: [' ██ ', '█  █', '█  █', '█  █', ' ██ '],
      K: ['█  █', '█ █ ', '██  ', '█ █ ', '█  █'],
      ' ': ['  ', '  ', '  ', '  ', '  ']
    };
    function bigText(text) {
      var rows = ['', '', '', '', ''];
      text.split('').forEach(function (ch) {
        for (var r = 0; r < 5; r++) rows[r] += FONT[ch][r] + ' ';
      });
      return rows;
    }
    function coin(serial) {
      var no = '#' + ('000' + serial).slice(-4);
      return [
        '      .-""""""""-.      ',
        '    .\'   ______   \'.    ',
        '   /    /      \\    \\   ',
        '  |    |   GT   |    |  ',
        '  |    | ' + no + '  |    |  ',
        '   \\    \\______/    /   ',
        '    \'.            .\'    ',
        '      \'-........-\'      '
      ];
    }
    function dots(label, value) {
      var s = label + ' ';
      while (s.length < 18) s += '.';
      return s + ' ' + value;
    }
    function renderCredits() {
      var s = game.state, st = s.stats, name = C.CREDITS_NAME;
      var lines = coin(ui.serial).concat([''], bigText('GENESIS TOKEN'), ['', '',
        'You forged Genesis Token #' + ui.serial, '',
        dots('Clear time', dur(st.clear_time)),
        dots('Words typed', fmt(st.words_typed)),
        dots('Jewels found', fmt(st.jewels_found)),
        dots('Best jewel', st.best_jewel || '-'),
        dots('Combos found', s.combos_found.length + '/' + C.COMBOS.length), '',
        dots('Game design', name), dots('Code', name), dots('Played by', name), '',
        'Thank you for playing']);
      var h = '<div class="credits"><div class="roll">';
      lines.forEach(function (l, i) {
        h += '<div class="cl" style="animation-delay:' + (i * 0.25).toFixed(2) + 's">' + (esc(l) || ' ') + '</div>';
      });
      h += '</div><br><div class="keys">' + btn('c', '[c] Continue') + '    ' + btn('n', '[n] New game') + '</div></div>';
      return h;
    }
    function renderSettings() {
      var h = header('SETTINGS');
      if (ui.editing) {
        h += '<div>Boss site: <span class="word">' + esc(ui.urlInput) + '<span class="cur">_</span></span></div>';
        return h + footer([btn('Enter', '[Enter] Save'), btn(' ', '[Space] Cancel')]);
      }
      h += '<div>Boss site: ' + esc(bossUrl()) + '</div>';
      // TODO(T-0010 보류): [Esc] Open boss site 안내는 esc 동작 확정 후 추가
      return h + footer([btn('e', '[e] Edit URL'), btn('d', '[d] Reset to default'), btn('b', '[b] Back')]);
    }
    function renderQuit() {
      return header('GENESIS TOKEN') + '<div>Game saved. You can close this tab now.</div>' +
        footer([btn('Enter', '[Enter] Back to game')]);
    }

    var RENDER = {
      main: renderMain, mine: renderMine, slots: renderSlots, inventory: renderInventory,
      combos: renderCombos, genesis: renderGenesis, credits: renderCredits, quit: renderQuit, settings: renderSettings
    };
    function render() {
      el.innerHTML = RENDER[ui.screen]();
      ui.burning = game.burnLeft > 0;
    }
    // Called by the loop. Credits are static so the animation does not restart.
    function refresh() {
      if (ui.screen === 'mine' && ui.burning && !(game.burnLeft > 0)) { ui.msg = 'Burning time over.'; ui.input = ''; }
      if (ui.screen !== 'credits' && ui.screen !== 'quit') render();
    }

    // ---------- input ----------
    function result(r) { if (r) ui.msg = r.msg; }
    function go(screen) {
      if (ui.screen === 'mine' && screen !== 'mine') game.stopBurn();
      ui.screen = screen;
      ui.popup = null;
      ui.editing = false;
      if (screen === 'mine') { ui.input = ''; ui.mineMode = 'type'; ui.mineSel = 0; }
    }
    function clampCursors() {
      var s = game.state;
      ui.inv = Math.max(0, Math.min(ui.inv, s.jewels.length - 1));
      ui.slot = Math.max(0, Math.min(ui.slot, s.slots.length - 1));
      var sl = s.slots[ui.slot];
      ui.cell = sl ? Math.max(0, Math.min(ui.cell, sl.equipped.length - 1)) : 0;
    }

    function keyMain(k) {
      var menu = mainMenu();
      ui.menu = Math.min(ui.menu, menu.length - 1);
      if (k === 'arrowup' || k === 'arrowdown') { ui.menu = moveCursor(k, ui.menu, menu.length); return; }
      if (k === 'enter') k = menu[ui.menu][0];
      if (k === '1') go('mine');
      else if (k === '2') go('slots');
      else if (k === '3') go('inventory');
      else if (k === '4') go('combos');
      else if (k === '5' && game.genesisUnlocked()) go('genesis');
      else if (k === 'u') result(game.autoLevelUp());
      else if (k === 's') go('settings');
      else if (k === 'q') { hooks.save(); go('quit'); ui.msg = 'Saved.'; }
      else if (C.DEV_MODE && k === 't') { game.earn(100000); ui.msg = 'DEV: +100,000 tokens.'; }
      else if (C.DEV_MODE && k === 'g') {
        var jw = game.rollJewel(), r = game.addJewel(jw.kind, jw.grade);
        ui.msg = r.sold ? 'Inventory full. Jewel auto-sold for ' + fmt(r.price) + '.' : 'DEV: Got ' + r.name + '!';
      } else if (C.DEV_MODE && k === 'x') {
        C.TEST_JEWEL_RATE = !C.TEST_JEWEL_RATE;
        ui.msg = 'DEV: Jewel rate x10 ' + (C.TEST_JEWEL_RATE ? 'ON' : 'OFF') + '.';
      }
    }
    // Typing mode: letters, Backspace, Enter, Esc only. Select mode: menu, Tab, b.
    function keyMine(k, raw) {
      if (k === 'escape') { ui.mineMode = ui.mineMode === 'type' ? 'select' : 'type'; return; }
      if (ui.mineMode === 'type') {
        if (k === 'enter') { result(game.submit(ui.input)); ui.input = ''; }
        else if (k === 'backspace') ui.input = ui.input.slice(0, -1);
        else if (/^[A-Za-z0-9]$/.test(raw) && ui.input.length < 16) ui.input += raw;
        return;
      }
      if (k === 'arrowup' || k === 'arrowdown') { ui.mineSel = moveCursor(k, ui.mineSel, MINE_MENU.length); return; }
      if (k === 'enter') raw = MINE_MENU[ui.mineSel][0];
      if (raw === 'b') go('main');
      else if (raw === 'Tab') result(game.mineLevelUp());
    }
    function keySlots(k) {
      var s = game.state;
      if (ui.popup) {
        if (k === 'arrowup') ui.popupCursor = Math.max(0, ui.popupCursor - 1);
        else if (k === 'arrowdown') ui.popupCursor = Math.min(ui.popup.length - 1, ui.popupCursor + 1);
        else if (k === 'enter') { result(game.equip(ui.slot, ui.cell, ui.popup[ui.popupCursor].id)); ui.popup = null; }
        else if (k === 'b') ui.popup = null;
        return;
      }
      if (k === 'arrowup') ui.slot--;
      else if (k === 'arrowdown') ui.slot++;
      else if (k === 'arrowleft') ui.cell--;
      else if (k === 'arrowright') ui.cell++;
      else if (k === 'n') { result(game.buySlot()); if (game.state.slots.length) ui.slot = s.slots.length - 1; }
      else if (k === 'l') result(game.slotLevelUp(ui.slot));
      else if (k === 'e') {
        if (!s.slots[ui.slot]) { ui.msg = 'Buy a slot first.'; return; }
        var list = game.freeJewels();
        if (!list.length) { ui.msg = 'No free jewels to equip.'; return; }
        ui.popup = list; ui.popupCursor = 0;
      } else if (k === 'r') result(game.unequip(ui.slot, ui.cell));
      else if (k === 'b') go('main');
    }
    function keyInventory(k) {
      var j = game.state.jewels[ui.inv];
      if (k === 'arrowup') ui.inv--;
      else if (k === 'arrowdown') ui.inv++;
      else if (k === 'l') result(j ? game.jewelLevelUp(j.id) : { msg: 'No jewel selected.' });
      else if (k === 'x') result(j ? game.sellJewel(j.id) : { msg: 'No jewel selected.' });
      else if (k === 'e') result(game.expand());
      else if (k === 'b') go('main');
    }
    function keyCombos(k) {
      if (k === 'arrowup') ui.combo = Math.max(0, ui.combo - 1);
      else if (k === 'arrowdown') ui.combo = Math.min(C.COMBOS.length - 1, ui.combo + 1);
      else if (k === 'b') go('main');
    }
    function keyGenesis(k) {
      if (k === 'enter') {
        var r = game.buyGenesis();
        result(r);
        if (r.ok) { ui.serial = r.serial; hooks.save(); go('credits'); }
      } else if (k === 'b') go('main');
    }
    function keyCredits(k) {
      if (k === 'c') { go('main'); ui.msg = 'Genesis: ' + game.state.genesis_owned; }
      else if (k === 'n') { game.newGame(); hooks.save(); ui.slot = ui.cell = ui.inv = ui.combo = 0; go('main'); ui.msg = 'New game started.'; }
    }
    function keyQuit(k) { if (k === 'enter' || k === 'b') { go('main'); ui.msg = ''; } }

    function keySettings(k, raw) {
      if (ui.editing) {
        if (raw === ' ') { ui.editing = false; ui.msg = ''; }
        else if (k === 'enter') {
          var u = ui.urlInput.trim();
          if (!URL_RE.test(u)) { ui.msg = 'Invalid URL. Use http:// or https://'; return; }
          ui.msg = setBossUrl(u) ? 'Saved.' : 'Save failed.';
          ui.editing = false;
        } else if (k === 'backspace') ui.urlInput = ui.urlInput.slice(0, -1);
        else if (URL_CHAR.test(raw) && ui.urlInput.length < C.BOSS_URL_MAX) ui.urlInput += raw;
        return;
      }
      if (k === 'e') { ui.editing = true; ui.urlInput = bossUrl(); ui.msg = ''; }
      else if (k === 'd') { setBossUrl(null); ui.msg = 'Reset to default.'; }
      else if (k === 'b') go('main');
    }

    var KEYS = {
      main: keyMain, mine: keyMine, slots: keySlots, inventory: keyInventory,
      combos: keyCombos, genesis: keyGenesis, credits: keyCredits, quit: keyQuit, settings: keySettings
    };
    function handleKey(raw) {
      KEYS[ui.screen](raw.toLowerCase(), raw);
      clampCursors();
      render();
    }

    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Tab' || e.key.indexOf('Arrow') === 0 || e.key === ' ' || e.key === 'Backspace') e.preventDefault();
      var typing = ui.screen === 'mine' || (ui.screen === 'settings' && ui.editing);
      if (e.repeat && (!typing || e.key === 'Escape' || e.key === ' ')) return;
      // TODO(T-0010 보류): esc 보스 키(bossUrl() 새 탭 열기) 트리거 지점. 대표님 확정 전 구현 금지.
      // T-0013: Esc는 마이닝 모드 전환, 설정 URL 편집 취소는 Space로 변경됨.
      handleKey(e.key);
    });
    // Paste URL while editing in Settings (Ctrl+V is ignored by keydown above)
    document.addEventListener('paste', function (e) {
      if (ui.screen !== 'settings' || !ui.editing) return;
      var t = ((e.clipboardData && e.clipboardData.getData('text')) || '').replace(/\s/g, '');
      e.preventDefault();
      ui.urlInput = (ui.urlInput + t).slice(0, C.BOSS_URL_MAX);
      render();
    });
    el.addEventListener('click', function (e) {
      var t = e.target.closest('[data-key],[data-pick],[data-inv],[data-cell],[data-slot]');
      if (!t) return;
      var d = t.dataset;
      if (d.key) return handleKey(d.key);
      if (d.pick) { ui.popupCursor = +d.pick; return handleKey('Enter'); }
      if (d.inv) ui.inv = +d.inv;
      if (d.slot && !ui.popup) { ui.slot = +d.slot; if (d.cell) ui.cell = +d.cell; }
      clampCursors();
      render();
    });

    return { ui: ui, render: render, refresh: refresh };
  }

  root.GT_UI = { createUI: createUI };
})(window);
