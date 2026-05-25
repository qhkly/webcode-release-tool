(function () {
  var stored = localStorage.getItem('release-lang');
  var sysLang = (navigator.language || '').toLowerCase();
  var lang = stored || (sysLang.startsWith('zh') ? 'zh-CN' : 'en-US');

  window.i18n = {
    lang: lang,
    messages: {},
    t: function (key, vars) {
      var msg = this.messages[key] !== undefined ? this.messages[key] : key;
      if (vars) {
        Object.keys(vars).forEach(function (k) {
          msg = msg.replace(new RegExp('\\{' + k + '\\}', 'g'), String(vars[k]));
        });
      }
      return msg;
    },
    setLang: function (newLang) {
      localStorage.setItem('release-lang', newLang);
      location.reload();
    }
  };

  document.documentElement.lang = lang;
})();
