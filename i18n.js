// Interface texts (the three language files are i18n-en.js, i18n-ru.js, i18n-ka.js). Each person picks a language in "Me"; missing keys fall back to English.
(() => {
  const { en, ru, ka } = window.I18N_PARTS;   // i18n-en.js, i18n-ru.js, i18n-ka.js load first
  const dict = { en, ru, ka };
  window.I18N = {
    dict,
    t(lang, key, vars) {
      let s = (dict[lang] && dict[lang][key]) || en[key] || key;
      // Plurals: [[n|one|few|many]] picks the form for the number n in this language (en: tour|tours; ru: тур|тура|туров).
      if (vars && s.includes('[[')) s = s.replace(/\[\[(\w+)\|([^\]]*)\]\]/g, (_, k, forms) => { const f = forms.split('|'), n = Number(String(vars[k] ?? '').replace(/[^\d.-]/g, '')) || 0; let c = 'other'; try { c = new Intl.PluralRules(lang).select(n); } catch (e) { c = n === 1 ? 'one' : 'other'; } const i = { one: 0, few: 1, many: 2 }[c]; return f[i !== undefined && f[i] !== undefined ? i : f.length - 1]; });
      if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
      return s;
    }
  };
})();
