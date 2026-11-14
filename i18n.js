// Interface texts (the three language files are i18n-en.js, i18n-ru.js, i18n-ka.js). Each person picks a language in "Me"; missing keys fall back to English.
(() => {
  const { en, ru, ka } = window.I18N_PARTS;   // i18n-en.js, i18n-ru.js, i18n-ka.js load first
  const dict = { en, ru, ka };
  window.I18N = {
    dict,
    t(lang, key, vars) {
      let s = (dict[lang] && dict[lang][key]) || en[key] || key;
      if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
      return s;
    }
  };
})();
