// ============================================================
// MAIN.JS — Entry point, initializes the game
// ============================================================

(function () {

  function init() {
    // Load saved state
    State.load();

    // Init UI (nav, back buttons)
    UI.init();

    // Init base screen
    Base.init();

    // Show base screen first
    UI.showScreen('base');

    // Welcome message if new game
    const st = State.get();
    if (st.day === 1 && st.messages.length === 0) {
      State.addMessage('Yeni bir gün başladı. Ehtiyatlı ol.', 'normal');
    }

    Base.draw();
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
