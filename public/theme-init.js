// Apply the stored theme preference before first paint to avoid a flash.
// Kept as an external script so the nginx CSP (script-src 'self') allows it.
(function () {
  try {
    var theme = localStorage.getItem('theme');
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.dataset.theme = theme;
    }
  } catch (e) {
    /* localStorage unavailable — fall back to system preference */
  }
})();
