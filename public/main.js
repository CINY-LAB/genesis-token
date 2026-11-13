// GENESIS TOKEN - entry point: load, game loop, auto save.
(function () {
  var C = window.GT_CONFIG;
  var game = window.GT.createGame();
  var storage = window.localStorage;

  function save() {
    try { game.save(storage); } catch (e) { view.ui.msg = 'Save failed: ' + e.message; }
  }

  var view = window.GT_UI.createUI(game, document.getElementById('screen'), { save: save });
  var warn = game.load(storage);
  if (warn) view.ui.msg = warn;
  view.render();

  var last = performance.now();
  setInterval(function () {
    var now = performance.now();
    game.tick((now - last) / 1000);
    last = now;
    view.refresh();
  }, 250);

  setInterval(save, C.AUTOSAVE_SEC * 1000);
  window.addEventListener('beforeunload', save);
  window.addEventListener('pagehide', save);
})();
