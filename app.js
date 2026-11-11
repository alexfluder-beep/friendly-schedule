// Friendly Schedule: UI. Plain JavaScript, no build step.
(() => {
  'use strict';
  const S = window.Store, db = S.db, CFG = window.APP_CONFIG || {};
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const APP_VERSION = '3.25';
  // Busy periods: days off are not suggested here, and a request for these dates gets a warning. Admin edits them in Rules.
  const DEFAULT_PEAKS = `2026-12-20..2027-01-10 Christmas and New Year
2027-01-05..2027-01-08 Orthodox Christmas
2027-02-05..2027-02-14 Chinese New Year
2027-03-08..2027-03-14 Eid al-Fitr (date depends on the moon)
2027-03-20..2027-04-02 Nowruz
2027-03-26..2027-03-29 Easter
2027-04-30..2027-05-05 Orthodox Easter and May holidays
2027-05-15..2027-05-20 Eid al-Adha (date depends on the moon)
2027-10-01..2027-10-07 Golden Week (China)`;
  const peaks = () => String(rules().peaks ?? DEFAULT_PEAKS).split('\n').map(l => l.trim().match(/^(\d{4}-\d\d-\d\d)\s*\.\.\s*(\d{4}-\d\d-\d\d)\s*(.*)$/)).filter(Boolean).map(x => ({ from: x[1], to: x[2], name: x[3] || '' }));
  const peakOn = d => peaks().find(p => p.from <= d && p.to >= d);
  const DEFAULT_RULES = { maxStreak: 6, carSeats: 6, seasonFrom: 6, seasonTo: 10, maxSeasonBlock: 5, minNoticeDays: 14 };
  const LOCALES = { en: 'en-GB', ru: 'ru-RU', ka: 'ka-GE' };

  // ---------- dates (Monday is the first day of the week) ----------
  const p2 = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  const D = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  // Date maths and formatting run thousands of times per screen, so results are kept (they never change).
  const dayCache = new Map(), fmtCache = new Map(), fmtObj = new Map();
  const addDays = (s, n) => { const k = s + '|' + n; let v = dayCache.get(k); if (v === undefined) { if (dayCache.size > 40000) dayCache.clear(); const d = D(s); d.setDate(d.getDate() + n); v = iso(d); dayCache.set(k, v); } return v; };
  const monday = s => addDays(s, -((D(s).getDay() + 6) % 7));
  const today = () => iso(new Date());
  const daysBetween = (a, b) => Math.round((D(b) - D(a)) / 864e5);
  // Some browsers ship without Georgian date names, so those are built in.
  const KA = { wd: ['კვი', 'ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ'], wdl: ['კვირა', 'ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი'],
    mo: ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'], mol: ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'] };
  let kaNative = null;
  const fmt = (s, o) => {
    const ck = lang() + '|' + s + '|' + JSON.stringify(o); const hit = fmtCache.get(ck); if (hit !== undefined) return hit;
    if (fmtCache.size > 20000) fmtCache.clear();
    const v = fmtRaw(s, o); fmtCache.set(ck, v); return v;
  };
  const fmtRaw = (s, o) => {
    const d = D(s);
    if (lang() === 'ka') {
      if (kaNative === null) { try { kaNative = Intl.DateTimeFormat.supportedLocalesOf(['ka-GE']).length > 0; } catch (e) { kaNative = false; } }
      if (!kaNative) return [o.weekday ? (o.weekday === 'long' ? KA.wdl : KA.wd)[d.getDay()] + (o.day ? ',' : '') : '', o.day ? d.getDate() : '', o.month ? (o.month === 'long' ? KA.mol : KA.mo)[d.getMonth()] : '', o.year ? d.getFullYear() : ''].filter(x => x !== '').join(' ');
    }
    const fk = lang() + '|' + JSON.stringify(o); let f = fmtObj.get(fk); if (!f) { f = new Intl.DateTimeFormat(LOCALES[lang()], o); fmtObj.set(fk, f); }
    return f.format(d);
  };
  const fmtDay = s => fmt(s, s.slice(0, 4) === String(new Date().getFullYear()) ? { weekday: 'short', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
  const fmtRange = (a, b) => a === b ? fmtDay(a) : `${fmt(a, { day: 'numeric', month: 'short' })} – ${fmt(b, { day: 'numeric', month: 'short', year: 'numeric' })}`;

  // ---------- state ----------
  const state = { meTab: 'profile', adminTab: null, view: 'calendar', mode: 'week', date: today(), mine: false, modal: null, year: new Date().getFullYear(), auth: 'signin', authMsg: '', taskFilter: 'open', imp: null, bell: false };
  let memo = {};
  // "Look as": the admin sees the app exactly as one guide or driver would. Nothing can be saved while looking.
  const me = () => (state.viewAs && S.me && S.me.role === 'admin' && db.profiles.find(p => p.id === state.viewAs)) || S.me;
  const viewOnly = () => { const e = new Error('view only'); e.viewOnly = true; return Promise.reject(e); };
  ['save', 'saveMany', 'remove'].forEach(k => { const f = S[k]; if (typeof f === 'function') S[k] = (...a) => (state.viewAs ? viewOnly() : f.apply(S, a)); });
  const isAdmin = () => me() && me().role === 'admin';
  const lang = () => (me() && me().lang) || S.ls.get('fs-lang') || (['ru', 'ka'].includes((navigator.language || '').slice(0, 2)) ? navigator.language.slice(0, 2) : 'en');
  const T = (k, v) => window.I18N.t(lang(), k, v);
  const rules = () => ({ reviewGoogle: 'https://g.page/r/CYVGOaetm7xDEBE/review', tipUrl: 'https://tiny.keepz.me/46b6ewkt', ...DEFAULT_RULES, ...((db.settings.find(s => s.id === 'rules') || {}).value || {}) });
  const pv = () => ({ guideDays: 14, keepMonths: 24, auto: true, ...(rules().privacy || {}) });
  // Guides and drivers see guest names only around the tour; the database enforces the same limit.
  const guestsHidden = t => !isAdmin() && endOf(t) < addDays(today(), -pv().guideDays);
  const person = id => db.profiles.find(p => p.id === id);
  const pname = id => (person(id) || {}).name || '—';
  const roleRank = { admin: 0, guide: 1, driver: 2 };
  const staff = () => db.profiles.filter(p => p.active !== false).sort((a, b) => (roleRank[a.role] - roleRank[b.role]) || a.name.localeCompare(b.name));
  const crew = () => staff().filter(p => p.role !== 'admin' || db.tours.some(t => t.guide_id === p.id || t.driver_id === p.id));
  const live = t => t.status !== 'cancelled';
  const involves = (t, id) => t.guide_id === id || t.driver_id === id;
  const endOf = t => (t.date_to && t.date_to > t.date ? t.date_to : t.date);
  const tourDays = t => { const out = []; for (let d = t.date, i = 0; d <= endOf(t) && i < 60; d = addDays(d, 1), i++) out.push(d); return out; };
  const MARKS = ['wine', 'private_room', 'front_seat', 'bear_food', 'pickup', 'dropoff', 'stays', 'cancellation', 'nonref'];
  const KINDS = ['private', 'group', 'custom', 'transfer'];
  const catalog = () => ((db.settings.find(s => s.id === 'catalog') || {}).value || {}).items || window.TOUR_CATALOG || [];
  const catFind = title => { const k = String(title || '').trim().toLowerCase(); return k ? catalog().find(c => c.title.toLowerCase() === k) || null : null; };
  const TOUR_COLORS = ['#314b3c', '#22618c', '#5b4bb0', '#8a5a00', '#2f6f73', '#6b5b3e', '#3b5bbd', '#7a4b8a', '#4a6b1f', '#0e5a80', '#55606e', '#8a6a1f'];
  const SKIP = /^(\d.*|4x4|private|tour|tours|the|a|of|from|in|to|and|day|trip|group|small-group|half-day|full|&|-)$/i;
  // Rough geography for statistics and badges. Each tour can be corrected in Back office > Tour list.
  const REGIONS = ['Tbilisi', 'Mtskheta-Mtianeti', 'Kakheti', 'Shida Kartli', 'Kvemo Kartli', 'Samtskhe-Javakheti', 'Imereti', 'Racha-Lechkhumi', 'Samegrelo-Zemo Svaneti', 'Guria', 'Adjara'];
  const RHINT = [[/tbilisi|tiflis|brutal|fabrika/i, 'Tbilisi'], [/kazbegi|truso|juta|gudauri|stepantsminda|mtskheta|jvari|sabaduri|khevsureti|shatili|ananuri/i, 'Mtskheta-Mtianeti'], [/kakheti|sighnaghi|signagi|telavi|alaverdi|gareji|tusheti|rainbow/i, 'Kakheti'], [/gori\b|uplistsikhe/i, 'Shida Kartli'], [/dashbashi|tsalka|bolnisi/i, 'Kvemo Kartli'], [/borjomi|bakuriani|vardzia|rabati|akhaltsikhe/i, 'Samtskhe-Javakheti'], [/kutaisi|chiatura|katskhi|tskaltubo/i, 'Imereti'], [/racha|ambrolauri/i, 'Racha-Lechkhumi'], [/svaneti|mestia|ushguli|zugdidi|martvili/i, 'Samegrelo-Zemo Svaneti'], [/guria|ozurgeti/i, 'Guria'], [/batumi|adjara/i, 'Adjara']];
  const KHINT = [[/svaneti|mestia/i, 950], [/batumi/i, 750], [/yerevan/i, 580], [/vardzia/i, 540], [/sevan|dilijan/i, 500], [/kutaisi/i, 470], [/tusheti/i, 400], [/chiatura|katskhi/i, 400], [/bakuriani/i, 370], [/borjomi/i, 330], [/juta/i, 330], [/kazbegi|truso|stepantsminda/i, 320], [/khevsureti|shatili/i, 310], [/kakheti|telavi|alaverdi/i, 280], [/gudauri/i, 250], [/sighnaghi|signagi/i, 230], [/armenia|haghpat/i, 220], [/dashbashi/i, 220], [/uplistsikhe|gori\b/i, 200], [/gareji|rainbow/i, 160], [/sabaduri/i, 80], [/mtskheta/i, 60], [/airport/i, 40]];
  const numSet = v => v !== undefined && v !== null && v !== '';
  const regionsOf = title => { const c = catFind(title); return c && Array.isArray(c.regions) ? c.regions : RHINT.filter(x => x[0].test(title)).map(x => x[1]); };
  const kmOf = title => { const c = catFind(title); if (c && numSet(c.km)) return Number(c.km) || 0; const h = KHINT.find(x => x[0].test(title)); return h ? h[1] : 0; };
  const walkOf = title => { const c = catFind(title); if (c && numSet(c.walk_km)) return Number(c.walk_km) || 0; return /hik/i.test(title) ? 8 : /walking|brutal|night tour/i.test(title) ? 4 : 0; };
  // ---------- weather: forecast for the tour's destination on the tour day (Open-Meteo, no account needed) ----------
  const PLACES = [[/svaneti|mestia/i, 43.05, 42.73, 'Mestia'], [/tusheti|omalo/i, 42.37, 45.63, 'Omalo'], [/khevsureti|shatili/i, 42.66, 45.16, 'Shatili'], [/juta/i, 42.58, 44.74, 'Juta'], [/kazbegi|truso|stepantsminda/i, 42.66, 44.64, 'Stepantsminda'], [/gudauri/i, 42.48, 44.48, 'Gudauri'], [/yerevan/i, 40.18, 44.51, 'Yerevan'], [/sevan|dilijan/i, 40.74, 44.86, 'Dilijan'], [/armenia|haghpat/i, 41.09, 44.71, 'Haghpat'], [/vardzia/i, 41.38, 43.28, 'Vardzia'], [/bakuriani/i, 41.75, 43.53, 'Bakuriani'], [/borjomi/i, 41.84, 43.38, 'Borjomi'], [/kutaisi|tskaltubo/i, 42.27, 42.70, 'Kutaisi'], [/chiatura|katskhi/i, 42.29, 43.28, 'Chiatura'], [/batumi/i, 41.65, 41.64, 'Batumi'], [/telavi|alaverdi|grand kakheti/i, 41.92, 45.47, 'Telavi'], [/sighnaghi|signagi|kakheti/i, 41.62, 45.92, 'Sighnaghi'], [/gareji|rainbow/i, 41.45, 45.38, 'David Gareji'], [/uplistsikhe|gori\b/i, 41.97, 44.21, 'Uplistsikhe'], [/dashbashi/i, 41.59, 44.12, 'Dashbashi'], [/sabaduri/i, 41.87, 44.87, 'Sabaduri'], [/mtskheta|jvari/i, 41.84, 44.72, 'Mtskheta'], [/tbilisi|tiflis|brutal/i, 41.72, 44.79, 'Tbilisi']];
  const placeOf = title => { const c = catFind(title); if (c && numSet(c.lat) && numSet(c.lon)) return { lat: Number(c.lat), lon: Number(c.lon), name: c.place || '' }; const h = PLACES.find(x => x[0].test(title)); return h ? { lat: h[1], lon: h[2], name: h[3] } : null; };
  const WX = {}, wxKey = p => p.lat.toFixed(1) + ',' + p.lon.toFixed(1);
  let wxTimer = null;
  function wxLoad(p) {
    const k = wxKey(p), now = Date.now(); if (WX[k] && (WX[k].days || now - WX[k].at < 6e5)) return;
    try { const c = JSON.parse(S.ls.get('fs-wx-' + k) || 'null'); if (c && now - c.at < 3 * 36e5) { WX[k] = c; return; } } catch (e) { /* no cache */ }
    WX[k] = { at: now };
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.lat.toFixed(2)}&longitude=${p.lon.toFixed(2)}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=Asia%2FTbilisi&forecast_days=16`)
      .then(r => (r.ok ? r.json() : null)).then(j => {
        if (!j || !j.daily || !j.daily.time) return; const d = j.daily, days = {};
        d.time.forEach((day, i) => { days[day] = { c: d.weather_code[i], t: Math.round((d.temperature_2m_max[i] + d.temperature_2m_min[i]) / 2), hi: Math.round(d.temperature_2m_max[i]), lo: Math.round(d.temperature_2m_min[i]), mm: Math.round((d.precipitation_sum[i] || 0) * 10) / 10, w: Math.round(d.wind_speed_10m_max[i] || 0) }; });
        WX[k] = { at: Date.now(), days }; S.ls.set('fs-wx-' + k, JSON.stringify(WX[k]));
        clearTimeout(wxTimer); wxTimer = setTimeout(() => { render(); if (state.modal && state.modal.type === 'tour' && !state.modal.edit) renderModal(); }, 120);
      }).catch(() => {
        // offline or blocked: no weather line. Only in the demo, show a clearly marked sample so the line can be seen.
        if (S.mode !== 'demo') return;
        const days = {}, high = p.lat > 42.4; for (let i = 0; i < 16; i++) { const d = addDays(today(), i), s = (i * 7 + Math.round(p.lat * 10)) % 5; days[d] = high ? { c: [71, 3, 73, 2, 61][s], t: [-3, 1, -5, 2, 0][s], hi: [1, 5, -1, 6, 3][s], lo: [-7, -3, -9, -2, -4][s], mm: [6.2, 0, 12.4, 0, 3.1][s], w: [28, 14, 38, 11, 22][s] } : { c: [2, 0, 3, 61, 1][s], t: [12, 14, 10, 9, 13][s], hi: [16, 18, 13, 11, 17][s], lo: [8, 9, 7, 6, 8][s], mm: [0, 0, 0, 4.5, 0][s], w: [11, 8, 16, 21, 9][s] }; }
        WX[k] = { at: Date.now(), days, sample: true }; clearTimeout(wxTimer); wxTimer = setTimeout(() => { render(); if (state.modal && state.modal.type === 'tour' && !state.modal.edit) renderModal(); }, 120);
      });
  }
  const wxCond = c => (c === 0 ? 'clear' : c <= 2 ? 'partly' : c === 3 ? 'cloudy' : c <= 48 ? 'fog' : c <= 57 ? 'drizzle' : c <= 67 ? 'rain' : c <= 77 ? 'snow' : c <= 82 ? 'showers' : c <= 86 ? 'snow' : 'storm');
  const wxIcon = { clear: 'sun', partly: 'cloudsun', cloudy: 'cloud', fog: 'cloud', drizzle: 'rain', rain: 'rain', showers: 'rain', snow: 'snow', storm: 'bolt' };
  function weather(t) {
    const td = today(); if (!live(t) || t.date < td || t.date > addDays(td, 15)) return null;
    const p = placeOf(t.title); if (!p) return null; wxLoad(p);
    const d = (WX[wxKey(p)].days || {})[t.date]; return d ? { ...d, cond: wxCond(d.c), place: p.name, sample: !!WX[wxKey(p)].sample } : null;
  }
  const wxLine = (t, full) => { const w = weather(t); if (!w) return ''; const rough = w.mm >= 10 || w.w >= 50 || w.cond === 'storm' || w.cond === 'snow'; return `<span class="wx ${rough ? 'rough' : ''}" title="${esc(w.place)}">${ico(wxIcon[w.cond])}<b class="num">${w.t}°</b><span>${T('wx_' + w.cond)}</span>${w.mm ? `<span class="num">${w.mm} ${T('wx_mm')}</span>` : ''}<span class="num">${T('wx_wind')} ${w.w} ${T('wx_kmh')}</span>${full ? `<span class="muted num">${esc(w.place)} · ${w.lo}°…${w.hi}°</span>` : ''}${w.sample ? `<span class="tag t-muted">${T('wx_sample')}</span>` : ''}</span>`; };
  function tourStyle(title) {
    const k = 'ts' + title; if (memo[k]) return memo[k];
    const c = catFind(title) || {}; let h = 0; for (const ch of String(title)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
    const words = String(title).replace(/[:,()]/g, ' ').split(/\s+/).filter(w => w && !SKIP.test(w));
    const code = (c.code || (words.length > 1 ? [...words[0]][0] + [...words[1]][0] : (words[0] || title || '?').slice(0, 2))).toUpperCase().slice(0, 3);
    return memo[k] = { color: c.color || TOUR_COLORS[h % TOUR_COLORS.length], code };
  }
  // Material Symbols icons (icons.js): fill, 960 grid.
  const msi = (k, cls) => (window.MSI && window.MSI[k] ? `<svg class="msi${cls ? ' ' + cls : ''}" viewBox="0 -960 960 960" aria-hidden="true"><path fill="currentColor" d="${window.MSI[k]}"/></svg>` : '');
  // A picture for each kind of tour, so a guide knows the tour at a glance: mountains, wine, city walk, church, transfer...
  const TOUR_ICONS = [[/airport|аэропорт|flight/i, 'flight'], [/transfer|трансфер|taxi/i, 'airport_shuttle'], [/brutal|soviet|architect|бруталь|советск/i, 'apartment'], [/walk|ussr|tiflis|пешеход|прогулк/i, 'directions_walk'],
    [/stalin|gori\b|museum|музей|сталин/i, 'museum'], [/vardzia|uplistsikhe|chiatura|katskhi|rabati|cave|вардзи|уплисцихе|чиатур/i, 'castle'], [/sevan|lake|севан|озеро/i, 'water'], [/armenia|yerevan|армени|ереван/i, 'flag'],
    [/kazbegi|kazbek|truso|gudauri|tusheti|svaneti|gareji|rainbow|mountain|казбег|гареджи|тушети|сванети|гудаури|горы/i, 'landscape'], [/borjomi|sabaduri|forest|боржоми|сабадури|лес/i, 'forest'],
    [/mtskheta|jvari|church|monaster|мцхета|джвари|монаст/i, 'church'], [/kakheti|signagi|sighnaghi|bodbe|telavi|kvareli|wine|кахети|сигнахи|телави|вин/i, 'wine_bar'], [/car|4x4|4wd|джип/i, 'directions_car']];
  const tourIcon = title => { const c = catFind(title) || {}; if (c.icon) return c.icon; const x = TOUR_ICONS.find(([re]) => re.test(String(title || ''))); return x ? x[1] : ''; };
  const emblem = (t, big) => { const s = tourStyle(t.title), ic = tourIcon(t.title); return `<span class="emb${big ? ' big' : ''}${ic ? ' ic' : ''}" style="background:${esc(s.color)}" aria-hidden="true">${ic ? msi(ic) : esc(s.code)}</span>`; };
  // Pictures people can choose instead of a photo (Me > Choose a picture).
  const AV_ICONS = ['hiking', 'directions_car', 'landscape', 'forest', 'wine_bar', 'coffee', 'pets', 'sailing', 'photo_camera', 'music_note', 'sports_soccer', 'sunny', 'star', 'favorite', 'eco', 'local_florist', 'cottage', 'cake', 'rocket_launch', 'sentiment_satisfied'];
  const AV_COLORS = ['#2f6b48', '#1d3b66', '#22618c', '#5b4bb0', '#a8325f', '#b8441c', '#8a5a00', '#4a3526'];
  const avLib = v => { const m = /^ms:([a-z_]+):(#[0-9a-f]{6})$/i.exec(v || ''); return m && AV_ICONS.includes(m[1]) ? { icon: m[1], color: m[2] } : null; };
  // Country of a phone number from its dialling code. It shows where the number is registered, not the guest's nationality.
  const DIAL = { 1: 'US', 20: 'EG', 27: 'ZA', 30: 'GR', 31: 'NL', 32: 'BE', 33: 'FR', 34: 'ES', 36: 'HU', 39: 'IT', 40: 'RO', 41: 'CH', 43: 'AT', 44: 'GB', 45: 'DK', 46: 'SE', 47: 'NO', 48: 'PL', 49: 'DE', 52: 'MX', 54: 'AR', 55: 'BR', 60: 'MY', 61: 'AU', 62: 'ID', 63: 'PH', 64: 'NZ', 65: 'SG', 66: 'TH', 7: 'RU', 76: 'KZ', 77: 'KZ', 81: 'JP', 82: 'KR', 84: 'VN', 86: 'CN', 90: 'TR', 91: 'IN', 92: 'PK', 94: 'LK', 98: 'IR', 351: 'PT', 352: 'LU', 353: 'IE', 354: 'IS', 356: 'MT', 357: 'CY', 358: 'FI', 359: 'BG', 370: 'LT', 371: 'LV', 372: 'EE', 373: 'MD', 374: 'AM', 375: 'BY', 380: 'UA', 381: 'RS', 385: 'HR', 386: 'SI', 420: 'CZ', 421: 'SK', 852: 'HK', 886: 'TW', 961: 'LB', 962: 'JO', 964: 'IQ', 965: 'KW', 966: 'SA', 968: 'OM', 971: 'AE', 972: 'IL', 973: 'BH', 974: 'QA', 992: 'TJ', 993: 'TM', 994: 'AZ', 995: 'GE', 996: 'KG', 998: 'UZ' };
  function phoneCountry(phone) {
    const iso = phoneIso(phone); if (!iso) return '';
    try { return new Intl.DisplayNames([LOCALES[lang()]], { type: 'region' }).of(iso) || iso; } catch (e) { return iso; }
  }
  const guestCur = () => rules().guestCurrency || 'USD';
  const CURRENCIES = ['GEL', 'USD', 'EUR'];
  function phoneIso(phone) {
    const p = String(phone || '').trim(); if (!/^(\+|00)/.test(p)) return '';
    const d = p.replace(/^00/, '').replace(/\D/g, '');
    for (const n of [3, 2, 1]) if (DIAL[d.slice(0, n)]) return DIAL[d.slice(0, n)];
    return '';
  }
  // Flag picture from the country code, e.g. GE -> flag of Georgia (the phone's own emoji font draws it).
  const flagOf = iso => (iso && iso.length === 2 ? String.fromCodePoint(...[...iso.toUpperCase()].map(ch => 127397 + ch.charCodeAt(0))) : '');
  const phoneFlag = phone => { const iso = phoneIso(phone); return iso ? `${flagOf(iso)} ${phoneCountry(phone)}` : ''; };
  // Local Georgian mobile numbers get +995; 00 becomes +.
  // Email as typed or pasted: drops "mailto:", <brackets>, spaces and trailing dots.
  const cleanEmail = v => { const m = String(v || '').replace(/mailto:/ig, ' ').match(/[^\s<>"'(),;:]+@[^\s<>"'(),;:]+\.[a-z]{2,}/i); return m ? m[0].replace(/\.+$/, '').toLowerCase() : ''; };
  function normPhone(v) {
    const p = String(v || '').trim(); if (!p) return ''; const d = p.replace(/\D/g, '');
    if (/^00/.test(p)) return '+' + d.slice(2); if (p.startsWith('+')) return '+' + d;
    if (/^5\d{8}$/.test(d)) return '+995' + d; if (/^995\d{9}$/.test(d)) return '+' + d; return p;
  }
  // An address field also takes a Google Maps link or coordinates (41.6938, 44.8015 or 41°41'37"N 44°48'05"E).
  function parseLoc(text) {
    const t = String(text || '').trim(); if (!t) return { addr: '', url: '' };
    if (/^https?:\/\//i.test(t)) {
      if (!/google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google|yandex\.[a-z]+\/maps|2gis\./i.test(t)) return { addr: t, url: '' };
      const pl = (t.match(/\/place\/([^/@?]+)/) || [])[1], ll = t.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || t.match(/[?&](?:q|ll|query)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
      let name = ''; try { name = pl ? decodeURIComponent(pl.replace(/\+/g, ' ')) : ''; } catch (e) { name = ''; }
      return { addr: name || (ll ? `${(+ll[1]).toFixed(5)}, ${(+ll[2]).toFixed(5)}` : T('map_pin')), url: t };
    }
    const dec = t.match(/^(-?\d{1,2}\.\d{3,})\s*[,; ]\s*(-?\d{1,3}\.\d{3,})$/);
    if (dec) return { addr: t, url: `https://www.google.com/maps?q=${dec[1]},${dec[2]}` };
    const dms = [...t.matchAll(/(\d{1,3})\s*°\s*(\d{1,2})\s*['′]\s*(\d{1,2}(?:[.,]\d+)?)?\s*(?:"|″|'')?\s*([NSEW])/gi)];
    if (dms.length === 2) { const v = m => { let x = +m[1] + +m[2] / 60 + (+(String(m[3] || 0).replace(',', '.'))) / 3600; if (/[SW]/i.test(m[4])) x = -x; return x.toFixed(6); }; return { addr: t, url: `https://www.google.com/maps?q=${v(dms[0])},${v(dms[1])}` }; }
    return { addr: t, url: '' };
  }
  const knownAddrs = () => [...new Set([...db.bookings.map(b => b.pickup_addr), ...db.tours.map(t => t.pickup)].filter(x => x && !/^https?:/i.test(x)))].sort().slice(0, 300);
  const GUEST_LANGS = ['EN', 'RU', 'KA', 'DE', 'FR', 'ES', 'IT', 'HE', 'ZH', 'AR', 'TR', 'UK', 'PL', 'NL', 'JA', 'KO'];
  const LANG_NAMES = { EN: 'English', RU: 'Русский', KA: 'ქართული', DE: 'Deutsch', FR: 'Français', ES: 'Español', IT: 'Italiano', HE: 'עברית', ZH: '中文', AR: 'العربية', TR: 'Türkçe', UK: 'Українська', PL: 'Polski', NL: 'Nederlands', JA: '日本語', KO: '한국어' };
  const langName = c => LANG_NAMES[c] || c;
  const tourMap = t => t.pickup_url || (t.pickup ? mapsLink(t.pickup) : '');
  const allMarks = () => [...MARKS, ...String(rules().customMarks || '').split(',').map(x => x.trim()).filter(Boolean)];
  const markLabel = m => (MARKS.includes(m) ? T('mark_' + m) : m);
  const RATINGS = { good: 't-ok', fine: 't-muted', bad: 't-warn', trouble: 't-danger' };
  const digits = v => String(v || '').replace(/\D/g, '');
  const isFree = b => /free\s*tour/i.test(sourceOf(b)) || (b.marks || []).some(x => /free\s*tour/i.test(x));
  const freeTag = b => (isFree(b) ? `<span class="tag t-free">${T('free_guest')}</span>` : '');
  const tipUrl = () => (/^https:\/\//i.test(rules().tipUrl || '') ? rules().tipUrl : '');
  const mapFor = (addr, url) => (/^https:\/\//i.test(url || '') ? url : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addr || ''));
  const needsAddr = b => (b.marks || []).some(x => x === 'pickup' || x === 'dropoff' || x === 'stays');
  const staysN = bks => bks.filter(b => (b.marks || []).includes('stays')).reduce((n, b) => n + (Number(b.pax) || 1), 0);
  // ---------- VIP guests: worked out automatically from visits, years, add-ons and marks ----------
  // Admins count from the loaded history; guides and drivers get only the numbers from the server.
  function guestAgg() {
    if (memo.cagg) return memo.cagg;
    const tm = {}, out = {}, td = today(); db.tours.forEach(t => { tm[t.id] = t; });
    const get = c => (out[c] = out[c] || { total: 0, mine: 0, ys: new Set(), addons: 0, noshow: 0, good: 0, bad: 0 });
    for (const b of db.bookings) { const t = tm[b.tour_id]; if (!t || !b.client_id || !live(t) || endOf(t) >= td) continue; const o = get(b.client_id); o.total++; if (involves(t, me().id)) o.mine++; o.ys.add(t.date.slice(0, 4)); if ((b.marks || []).length) o.addons++; if (b.attendance === 'noshow') o.noshow++; }
    for (const r of db.client_ratings) { const o = out[r.client_id]; if (!o) continue; if (r.rating === 'good' || r.rating === 'like') o.good++; else if (r.rating === 'bad' || r.rating === 'trouble' || r.rating === 'dislike') o.bad++; }
    Object.values(out).forEach(o => { o.years = o.ys.size; });
    return memo.cagg = out;
  }
  const guestStats = cid => (!cid ? null : (isAdmin() || S.mode === 'demo') ? guestAgg()[cid] || null : (state.visits || {})[cid] || null);
  const vipScore = v => (v ? v.total * 2 + (v.years || 0) * 3 + (v.addons || 0) + ((v.good || 0) - (v.bad || 0)) * 2 - (v.noshow || 0) * 3 : 0);
  const isVip = cid => { const v = guestStats(cid), r = rules(); return !!v && v.total >= 2 && (v.bad || 0) <= (v.good || 0) && vipScore(v) >= (Number(r.vipScore) || 10); };
  const vipTag = cid => (isVip(cid) ? `<span class="tag t-vip">${T('vip')}</span>` : '');
  const COSTS = ['accommodation', 'food', 'tickets', 'fuel', 'other'];
  const costOf = id => { const c = db.tour_costs.find(x => x.id === id) || {}, items = c.items || {}; return { items, note: c.note || '', total: COSTS.reduce((n, k) => n + (Number(items[k]) || 0), 0) }; };
  const cleanName = v => String(v || '').replace(/\s+x\s*\d+(\s*\+\s*\d+)?/i, '').replace(/\s*\+\S+/g, '').replace(/\b(RUS|ENG|GER|FRA)\b/g, '').trim();
  const clientRating = id => idx().rat[id];
  // Lookup tables rebuilt once per screen draw, so thousands of tours and guests stay fast.
  function idx() {
    if (memo.idx) return memo.idx;
    const byDate = {}, bk = {}, rat = {}, cx = {}, hid = {}, adm = isAdmin();
    for (const t of db.tours) { if (!adm && guestsHidden(t)) hid[t.id] = 1; if (t.status === 'cancelled') { if (adm || involves(t, me().id)) for (const d of tourDays(t)) (cx[d] = cx[d] || []).push(t); continue; } for (const d of tourDays(t)) (byDate[d] = byDate[d] || []).push(t); }
    for (const b of db.bookings) { if (hid[b.tour_id]) continue; (bk[b.tour_id] = bk[b.tour_id] || []).push(b); }
    for (const r of db.client_ratings) { if (!['good', 'fine', 'bad', 'trouble'].includes(r.rating)) continue; const c = rat[r.client_id]; if (!c || (r.created_at || '') > (c.created_at || '')) rat[r.client_id] = r; }
    return memo.idx = { byDate, bk, rat, cx };
  }
  const toursOnDay = d => idx().byDate[d] || [];
  const cancelledOnDay = d => idx().cx[d] || [];
  const tourBookings = id => idx().bk[id] || [];
  const offCls = o => (o ? (o.type === 'sick' ? 'myoff mysick' : 'myoff') : ''); // sick days look different from days off
  const offOn = (id, date) => db.time_off.find(o => o.user_id === id && o.status !== 'declined' && o.date_from <= date && o.date_to >= date);
  const personalOn = (id, date) => db.personal_dates.find(x => x.user_id === id && (x.date === date || (x.yearly && x.date.slice(5) === date.slice(5))));
  // One entry per weekday (0 = Monday): null = not working, otherwise [from, until]; older profiles are converted on the fly.
  // Hours for one week, set on Sunday evening (Tasks > Check next week), win over the usual working hours.
  const availOf = (p, date) => { const a = p && p.display && p.display.avail; return a && date ? a[monday(date)] || null : null; };
  const weekOf = (p, date) => { const av = availOf(p, date); if (av && Array.isArray(av.w) && av.w.length === 7) return av.w; if (p && Array.isArray(p.work_week) && p.work_week.length === 7) return p.work_week; const ds = String((p && p.work_days) || '').split(',').filter(x => x !== '').map(Number); return [0, 1, 2, 3, 4, 5, 6].map(i => (!ds.length || ds.includes(i) ? [(p && p.work_from) || '', (p && p.work_to) || ''] : null)); };
  const workDaysOf = (p, date) => { const w = weekOf(p, date), on = w.map((x, i) => (x ? i : -1)).filter(i => i >= 0); return on.length === 7 ? [] : on; };
  const weekEditor = (p, date) => `<div class="wweek">${weekOf(p, date).map((x, i) => `<div class="wrow"><label class="wday"><input type="checkbox" name="wd${i}" ${x ? 'checked' : ''}>${esc(fmt(addDays('2024-01-01', i), { weekday: 'short' }))}</label>${hmIn('wf' + i, (x || [])[0], T('ws_from'), '--:--')}<span class="muted">–</span>${hmIn('wt' + i, (x || [])[1], T('ws_to'), '--:--')}</div>`).join('')}<div class="bar"><button type="button" class="lnk" data-act="wsame">${T('ws_same')}</button><span class="muted small">${T('ws_hint')}</span></div></div>`;
  // Hours are typed as 24-hour text ("9", "930", "09:30" all become 09:30), so every phone shows the same format.
  const hmNorm = v => { const d = String(v || '').replace(/\D/g, ''); if (!d) return ''; const h = d.length <= 2 ? d : d.slice(0, d.length - 2), m = d.length <= 2 ? '00' : d.slice(-2); return Number(h) < 24 && Number(m) < 60 ? String(Number(h)).padStart(2, '0') + ':' + m : ''; };
  // Dates typed day first: "24.11.2026", "24/11/26", "24.11" (this year). Returns 2026-11-24 or ''.
  const dmyNorm = v => { const m = /^\s*(\d{1,2})[./\-\s](\d{1,2})(?:[./\-\s](\d{2,4}))?\s*$/.exec(String(v || '')) || /^\s*(\d{2})(\d{2})(\d{4}|\d{2})?\s*$/.exec(String(v || '')); if (!m) return ''; let y = m[3] ? Number(m[3]) : Number(today().slice(0, 4)); if (y < 100) y += 2000; const iso = `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`, dt = new Date(iso + 'T12:00:00Z'); return !isNaN(dt) && dt.toISOString().slice(0, 10) === iso ? iso : ''; };
  const PD_KINDS = ['birthday', 'anniversary', 'family', 'private', 'doctor', 'service', 'trip'];
  const PD_ICON = { birthday: 'cake', anniversary: 'favorite', family: 'family_restroom', private: 'lock', doctor: 'medical_services', service: 'build', trip: 'luggage' };
  const pdKind = title => { const t = String(title || '').trim().toLowerCase(); return PD_KINDS.find(k => ['en', 'ru', 'ka'].some(l => t.includes(window.I18N.t(l, 'pdk_' + k).toLowerCase()))) || ''; };
  // Date wheels (day, month, year) that roll like the phone's own picker; the chosen date is kept in the window's draft.
  const WH = 44, daysIn = (y, mo) => new Date(Date.UTC(y, mo, 0)).getUTCDate();
  function wheelHtml(iso) {
    const [y, mo, d] = iso.split('-').map(Number), yNow = Number(today().slice(0, 4));
    const col = (part, items, sel) => `<div class="wcol" data-part="${part}" data-sel="${sel}" tabindex="0" role="listbox" aria-label="${T('wh_' + part)}"><i></i>${items.map(([v, l]) => `<button type="button" class="wit ${v === sel ? 'on' : ''}" data-v="${v}" role="option" aria-selected="${v === sel}">${esc(l)}</button>`).join('')}<i></i></div>`;
    const days = [...Array(31)].map((_, k) => [k + 1, String(k + 1).padStart(2, '0')]), months = [...Array(12)].map((_, k) => [k + 1, fmt(`2024-${String(k + 1).padStart(2, '0')}-01`, { month: 'long' })]), years = [...Array(yNow + 3 - 1930)].map((_, k) => [1930 + k, String(1930 + k)]);
    return `<div class="wheel" id="pd-wheel"><div class="wband"></div>${col('d', days, d)}${col('m', months, mo)}${col('y', years, y)}</div>`;
  }
  function wheelSync(first) {
    const w = document.getElementById('pd-wheel'), m = state.modal; if (!w || !m || m.type !== 'pdate') return;
    const get = part => { const c = w.querySelector(`[data-part=${part}]`), its = [...c.querySelectorAll('.wit')]; if (first) c.scrollTop = Math.max(0, its.findIndex(b => b.dataset.v === c.dataset.sel)) * WH; const ix = Math.min(its.length - 1, Math.max(0, Math.round(c.scrollTop / WH))); its.forEach((b, k) => { b.classList.toggle('on', k === ix); b.setAttribute('aria-selected', k === ix); }); return Number(its[ix].dataset.v); };
    const y = get('y'), mo = get('m'); let d = get('d'); const mx = daysIn(y, mo);
    w.querySelectorAll('[data-part=d] .wit').forEach(b => { b.hidden = Number(b.dataset.v) > mx; }); if (d > mx) { d = mx; w.querySelector('[data-part=d]').scrollTop = (mx - 1) * WH; }
    const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`; if (!first && iso !== m.draft.date) m.touched = true; m.draft.date = iso; const out = document.getElementById('pd-out'); if (out) out.textContent = fmt(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  document.addEventListener('click', ev => { const b = ev.target.closest && ev.target.closest('.wit'); if (!b) return; const c = b.parentElement, k = [...c.querySelectorAll('.wit')].indexOf(b); c.scrollTo({ top: k * WH, behavior: 'smooth' }); });
  let wheelT = 0; document.addEventListener('scroll', ev => { if (ev.target && ev.target.classList && ev.target.classList.contains('wcol')) { clearTimeout(wheelT); wheelT = setTimeout(() => wheelSync(false), 80); } }, true);
  function pdModalHtml(m) {
    const d = m.draft;
    return `<div class="hdr"><h2>${T(d.id ? 'pd_edit' : 'pd_add')}</h2><button class="iconbtn" data-act="close" aria-label="${T('close')}">✕</button></div>
      <form class="f pdform" data-form="pdate"><div class="chips">${PD_KINDS.map(k => `<button type="button" class="chip2 ${pdKind(d.title) === k ? 'on' : ''}" data-act="pdkind" data-k="${k}">${msi(PD_ICON[k])}${T('pdk_' + k)}</button>`).join('')}</div>
        <label>${T('pd_what')}<input class="inp" id="pd-title" name="title" required maxlength="60" value="${esc(d.title || '')}" placeholder="${T('pd_what_ph')}" autocomplete="off"></label>
        <div class="f" style="gap:4px"><span class="lbl">${T('date')}: <b id="pd-out">${esc(fmt(d.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</b></span>${wheelHtml(d.date)}</div>
        <label class="pdy"><input type="checkbox" id="pd-yearly" name="yearly" ${d.yearly ? 'checked' : ''}>${T('pd_yearly')}</label>
        <div class="actions"><button type="button" class="btn" data-act="close">${T('close')}</button><button class="btn primary">${T('save')}</button></div></form>`;
  }
  const hmIn = (name, v, label, ph) => `<input class="inp hm num" type="text" inputmode="numeric" autocomplete="off" maxlength="5" name="${name}" value="${esc(v || '')}" placeholder="${ph}" pattern="\\s*([01]?[0-9]|2[0-3])[:.]?[0-5][0-9]\\s*|\\s*([01]?[0-9]|2[0-3])\\s*" aria-label="${esc(label)}">`;
  const weekFrom = fd => [0, 1, 2, 3, 4, 5, 6].map(i => (fd.get('wd' + i) ? [hmNorm(fd.get('wf' + i)), hmNorm(fd.get('wt' + i))] : null));
  const weekFields = w => ({ work_week: w, work_days: w.every(Boolean) ? '' : w.map((x, i) => (x ? i : -1)).filter(i => i >= 0).join(','), work_from: null, work_to: null });
  // Georgian public holidays, shown for information on every calendar (they do not close the company; company days off are in Back office > Holidays).
  function orthodoxEaster(y) { const a = y % 4, b = y % 7, c = y % 19, d = (19 * c + 15) % 30, e = (2 * a + 4 * b - d + 34) % 7, month = Math.floor((d + e + 114) / 31), day = ((d + e + 114) % 31) + 1; const dt = new Date(Date.UTC(y, month - 1, day + 13)); return dt.toISOString().slice(0, 10); }
  const GE_FIXED = [['01-01', 'ph_newyear'], ['01-02', 'ph_newyear'], ['01-07', 'ph_xmas'], ['01-19', 'ph_epiphany'], ['03-03', 'ph_mother'], ['03-08', 'ph_women'], ['04-09', 'ph_unity'], ['05-09', 'ph_victory'], ['05-12', 'ph_andrew'], ['05-17', 'ph_family'], ['05-26', 'ph_indep'], ['08-28', 'ph_mary'], ['10-14', 'ph_mtskheta'], ['11-23', 'ph_george']];
  const phCache = {};
  function publicHolidays(y) { const k = 'ph' + y; if (phCache[k]) return phCache[k]; const e = orthodoxEaster(y), out = {}; GE_FIXED.forEach(([md, n]) => { out[`${y}-${md}`] = n; }); [[-2, 'ph_friday'], [-1, 'ph_saturday'], [0, 'ph_easter'], [1, 'ph_easter2']].forEach(([o, n]) => { out[addDays(e, o)] = n; }); return phCache[k] = out; }
  const pubHolOn = date => (rules().pubHol === false ? '' : publicHolidays(Number(date.slice(0, 4)))[date] || '');
  const holidayOn = date => db.holidays.find(h => h.kind !== 'event' && h.date_from <= date && h.date_to >= date);
  const eventOn = date => db.holidays.find(h => h.kind === 'event' && h.date_from <= date && h.date_to >= date);
  const SOURCES = ['GetYourGuide', 'Viator', 'Website', 'Airbnb', 'Civitatis', 'Klook', 'Trip.com', 'TourRadar', 'FreeTour', 'Direct'];
  // Booking source from the booking code. Only patterns we are sure about; anything else is set by hand.
  const sourceOf = b => b.source || (/free\s*tour/i.test((b.ref || '') + ' ' + (b.guest || '')) ? 'FreeTour' : /GYG/i.test(b.ref || '') ? 'GetYourGuide' : /^BR-/i.test(b.ref || '') ? 'Viator' : /^#?\d{7,9}$/.test((b.ref || '').trim()) ? 'Website' : '');
  // Where a guest can leave a review: the platform they booked on first (GetYourGuide, Viator), then Google Maps, TripAdvisor, Trustindex.
  const reviewPlaces = b => { const r = rules(), src = sourceOf(b), out = []; if (src === 'GetYourGuide' && r.reviewGyg) out.push(['GetYourGuide', r.reviewGyg]); if (src === 'Viator' && r.reviewViator) out.push(['Viator', r.reviewViator]); if (r.reviewGoogle) out.push(['Google Maps', r.reviewGoogle]); if (r.reviewTripadvisor) out.push(['TripAdvisor', r.reviewTripadvisor]); if (r.reviewTrustindex) out.push(['Trustindex', r.reviewTrustindex]); return out; };
  const reviewLink = b => { const r = rules(), src = sourceOf(b); return (src === 'GetYourGuide' && r.reviewGyg) || (src === 'Viator' && r.reviewViator) || r.reviewGoogle || ''; };
  const mapsLink = a => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(a);
  const waLink = (phone, text) => 'https://wa.me/' + String(phone || '').replace(/\D/g, '') + (text ? '?text=' + encodeURIComponent(text) : '');
  const ICON = { wa: 'WhatsApp', call: '', copy: '' };
  const NAVIC = { calendar: 'cal', timeoff: 'sun', tasks: 'check', clients: 'user', admin: 'grid', me: 'user' };
  const IC = { tg: '<path d="M21 3 3 10.5l6.5 2.5L18 6l-6.5 8.5L18 21z"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>', check: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>', wa: '<path d="M21 11.5a8.4 8.4 0 0 1-12.6 7.3L3 20l1.3-5.2A8.4 8.4 0 1 1 21 11.5z"/>', call: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>', mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>', copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>', pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>', cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>' };
  IC.guide = '<path d="M6 21V4"/><path d="M6 4h11l-2.5 4 2.5 4H6"/>'; IC.driver = '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M12 14v7M10.2 11.2 3.6 8.8M13.8 11.2l6.6-2.4"/>';
  IC.share = '<path d="M12 15V3"/><path d="M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>';
  IC.cloud = '<path d="M7 18a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.6 1.2A3.5 3.5 0 0 1 17 18z"/>'; IC.cloudsun = '<circle cx="8" cy="8" r="3"/><path d="M8 2v1.5M2 8h1.5M3.8 3.8l1 1M12.2 3.8l-1 1"/><path d="M10 20a3.5 3.5 0 0 1-.3-7 4.8 4.8 0 0 1 9.2 1A3 3 0 0 1 18.5 20z"/>'; IC.rain = '<path d="M7 15a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.6 1.2A3.5 3.5 0 0 1 17 15z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>'; IC.snow = '<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9"/>';
  IC.refresh = '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>';
  const ico = k => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[k]}</svg>`;
  const ib = (k, label, href) => `<a class="ib k-${k}" href="${esc(href)}" ${/^https/.test(href) ? 'target="_blank" rel="noopener"' : ''} title="${esc(label)}" aria-label="${esc(label)}">${ico(k)}</a>`;
  const ibCopy = (v, label) => `<button type="button" class="ib k-copy" data-act="copy" data-v="${esc(v)}" title="${esc(label)}" aria-label="${esc(label)}">${ico('copy')}</button>`;
  // Telegram username: "@nino", "nino" or a t.me link all become "nino". Empty when it is not a valid username.
  const tgUser = v => { const u = String(v || '').trim().replace(/^https?:\/\/(www\.)?(t|telegram)\.me\//i, '').replace(/^@/, '').split(/[/?#\s]/)[0]; return /^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(u) ? u : ''; };
  const tgLink = v => (tgUser(v) ? 'https://t.me/' + tgUser(v) : '');
  // Buttons to reach a colleague: WhatsApp, call, Telegram (each only when known), plus Copy in the contacts list.
  const staffBtns = (p, copy) => { if (!p) return ''; const tg = tgLink(p.telegram); return p.phone || tg ? `<span class="cbtns">${p.phone ? ib('wa', 'WhatsApp', waLink(p.phone)) + ib('call', T('call'), 'tel:' + p.phone) : ''}${tg ? ib('tg', 'Telegram', tg) : ''}${copy && p.phone ? ibCopy(p.phone, T('copy')) : ''}</span>` : ''; };
  const contactBtns = (phone, email) => `<span class="cbtns">${phone ? ib('wa', 'WhatsApp', waLink(phone)) + ib('call', T('call'), 'tel:' + phone) : ''}${email ? ib('mail', T('email'), 'mailto:' + email) : ''}${phone ? ibCopy(phone, T('copy')) : ''}</span>`;
  const cashDue = bk => bk.filter(b => b.payment === 'cash' || b.payment === 'unpaid').reduce((a, b) => a + (Number(b.amount_due) || 0), 0);
  // Money to collect, added up per currency: "120 GEL + 40 USD".
  const cashText = bk => { const m = {}; bk.filter(b => b.payment === 'cash' || b.payment === 'unpaid').forEach(b => { const cu = b.currency || guestCur(); m[cu] = (m[cu] || 0) + (Number(b.amount_due) || 0); }); return Object.entries(m).filter(x => x[1]).map(([k, v]) => `${nf(v)} ${k}`).join(' + '); };
  function tourText(t) {
    const bk = t.bookings || tourBookings(t.id), L = [t.title, `${dateText(t)}${t.start_time ? ', ' + t.start_time : ''}${t.end_time ? '–' + t.end_time : ''}`];
    if (t.pickup) L.push(`${T('pickup')}: ${t.pickup}`, tourMap(t));
    L.push(`${T('guide')}: ${pname(t.guide_id)}${t.driver_id ? ' · ' + T('driver') + ': ' + pname(t.driver_id) : ''}`, `${T('guest_list')}: ${acText(t)}`);
    bk.forEach(b => L.push(`- ${b.guest} (${acText(b)})${(b.marks || []).length ? ' · ' + b.marks.map(markLabel).join(', ') : ''}`));
    bk.filter(b => b.pickup_addr).forEach(b => L.push(`  ${b.guest}: ${b.pickup_addr}`));
    if (staysN(bk)) L.push(T('stay_line', { n: staysN(bk), back: Math.max(0, (t.pax || 0) - staysN(bk)) }));
    if (cashDue(bk)) L.push(`${T('cash_collect')}: ${cashText(bk)}`);
    if (t.notes) L.push(`${T('notes')}: ${t.notes}`);
    return L.join('\n');
  }
  function gcalLink(t) {
    const f = (d, tm) => d.replace(/-/g, '') + 'T' + (tm || '09:00').replace(':', '') + '00';
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(t.title) + '&dates=' + f(t.date, t.start_time) + '/' + f(endOf(t), t.end_time || t.start_time) + '&ctz=Asia/Tbilisi&details=' + encodeURIComponent(tourText(t)) + (t.pickup ? '&location=' + encodeURIComponent(t.pickup) : '');
  }
  function logAct(summary) { try { S.save('log', { id: S.uid(), at: new Date().toISOString(), user_id: me().id, summary: String(summary).slice(0, 300) }).catch(() => {}); } catch (e) { /* log is best effort */ } }
  const myScore = (tid, uid) => db.tour_ratings.find(r => r.tour_id === tid && r.user_id === uid);
  function workDays(id) {
    const k = 'wd' + id; if (memo[k]) return memo[k];
    const set = new Set(); db.tours.forEach(t => { if (live(t) && involves(t, id)) tourDays(t).forEach(d => set.add(d)); });
    return memo[k] = set;
  }
  function streakAt(id, date) {
    const mk = 'st' + id + date; if (memo[mk] !== undefined) return memo[mk];
    return memo[mk] = streakCalc(id, date);
  }
  function streakCalc(id, date) {
    const days = workDays(id); if (!days.has(date)) return 0;
    let n = 1; for (let d = addDays(date, -1); days.has(d); d = addDays(d, -1)) n++;
    for (let d = addDays(date, 1); days.has(d); d = addDays(d, 1)) n++; return n;
  }
  const hhmm = n => { n = Math.max(0, Math.min(1439, Math.round(n))); return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`; };
  const durOf = d => (d.start_time && d.end_time && d.end_time > d.start_time ? Math.round((mins(d.end_time) - mins(d.start_time)) / 15) / 4 : '');
  const mins = s => { const [h, m] = String(s || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
  const overlap = (a, b) => (endOf(a) !== a.date || endOf(b) !== b.date) ? (a.date <= endOf(b) && b.date <= endOf(a)) : (a.date === b.date && (a.start_time || '00:00') < (b.end_time || '23:59') && (b.start_time || '00:00') < (a.end_time || '23:59'));
  function tourWarnings(t) {
    const w = [], r = rules();
    if (!live(t)) return w;
    if (t.capacity > 0 && t.pax > t.capacity) w.push({ lv: 'danger', tx: T('w_over', { pax: t.pax, cap: t.capacity }) });
    if (t.driver_id && t.pax > r.carSeats) w.push({ lv: 'danger', tx: T('w_car', { pax: t.pax, seats: r.carSeats }) });
    if (!t.guide_id && !t.driver_id) w.push({ lv: 'warn', tx: T('w_unassigned') });
    if (t.guide_id && !t.driver_id && kmOf(t.title) > 0 && !(person(t.guide_id) || {}).vehicle) w.push({ lv: 'warn', tx: T('w_nocar', { name: pname(t.guide_id) }) });
    const ce = catFind(t.title), mth = Number(t.date.slice(5, 7));
    if (ce && /summer only/i.test(ce.note || '') && (mth < 5 || mth > 10)) w.push({ lv: 'warn', tx: T('w_season') });
    const bks = t.bookings || tourBookings(t.id);
    if (t.driver_id && bks.filter(b => (b.marks || []).includes('front_seat')).length > 1) w.push({ lv: 'danger', tx: T('w_front') });
    if (bks.some(b => b.client_id && (clientRating(b.client_id) || {}).rating === 'trouble')) w.push({ lv: 'warn', tx: T('w_trouble') });
    const h = tourDays(t).map(holidayOn).find(Boolean); if (h) w.push({ lv: 'warn', tx: T('w_holiday', { name: h.name }) });
    for (const id of [t.guide_id, t.driver_id]) {
      if (!id) continue; const n = pname(id);
      const lg = String((person(id) || {}).languages || '').toUpperCase().split(/[\s,;]+/).filter(Boolean);
      if (id === t.guide_id && t.language && lg.length && !lg.includes(String(t.language).toUpperCase())) w.push({ lv: 'warn', tx: T('w_lang', { name: n, lang: t.language }) });
      const o = tourDays(t).map(d => offOn(id, d)).find(Boolean);
      if (o) w.push({ lv: o.status === 'approved' ? 'danger' : 'warn', tx: T(o.type === 'sick' ? 'w_sick' : (o.status === 'approved' ? 'w_off' : 'w_offpending'), { name: n }) });
      if (tourDays(t).some(dd => toursOnDay(dd).some(x => x.id !== t.id && involves(x, id) && overlap(x, t)))) w.push({ lv: 'danger', tx: T('w_double', { name: n }) });
      const pp = person(id) || {}, wds = workDaysOf(pp, t.date), wd = (D(t.date).getDay() + 6) % 7, hrs = weekOf(pp, t.date)[wd] || [];
      if (id === t.guide_id && ce && ce.id && (pp.skills || []).length && !pp.skills.includes(String(ce.id))) w.push({ lv: 'warn', tx: T('w_skill', { name: n }) });
      if (endOf(t) === t.date) for (const x of toursOnDay(t.date)) {
        if (x.id === t.id || !involves(x, id) || endOf(x) !== x.date || overlap(x, t)) continue;
        const [first, second] = (x.start_time || '') <= (t.start_time || '') ? [x, t] : [t, x], rest = Number((catFind(first.title) || {}).rest) || 0;
        if (rest && first.end_time && second.start_time && mins(second.start_time) - mins(first.end_time) < rest) { w.push({ lv: 'warn', tx: T('w_rest', { name: n, title: first.title, n: rest }) }); break; }
      }
      if (wds.length && !wds.includes(wd)) w.push({ lv: 'warn', tx: T('w_notworkday', { name: n }) });
      if ((hrs[0] && t.start_time && t.start_time < hrs[0]) || (hrs[1] && t.end_time && t.end_time > hrs[1] && endOf(t) === t.date)) w.push({ lv: 'warn', tx: T('w_hours', { name: n, from: hrs[0] || '', to: hrs[1] || '' }) });
      const pdte = tourDays(t).map(d => personalOn(id, d)).find(Boolean); if (pdte) w.push({ lv: 'warn', tx: T('w_personal', { name: n, title: pdte.title }) });
      const s = streakAt(id, t.date); if (s > r.maxStreak) w.push({ lv: 'warn', tx: T('w_streak', { name: n, n: s }) });
    }
    return w;
  }
  function offWarnings(o) {
    const w = [], r = rules(); if (o.type === 'sick') return w;
    const len = daysBetween(o.date_from, o.date_to) + 1, m = D(o.date_from).getMonth() + 1, m2 = D(o.date_to).getMonth() + 1;
    const inSeason = x => x >= r.seasonFrom && x <= r.seasonTo;
    if ((inSeason(m) || inSeason(m2)) && len > r.maxSeasonBlock) w.push(T('w_seasonblock', { n: len, max: r.maxSeasonBlock }));
    const notice = daysBetween((o.created_at || new Date().toISOString()).slice(0, 10), o.date_from);
    if (notice < r.minNoticeDays) w.push(T('w_notice', { n: Math.max(notice, 0), min: r.minNoticeDays }));
    const booked = db.tours.filter(t => live(t) && involves(t, o.user_id) && t.date <= o.date_to && endOf(t) >= o.date_from).length;
    if (booked) w.push(T('w_booked', { n: booked }));
    const others = new Set(db.time_off.filter(x => x.id !== o.id && x.user_id !== o.user_id && x.status === 'approved' && x.date_from <= o.date_to && x.date_to >= o.date_from).map(x => x.user_id)).size;
    if (others) w.push(T('w_othersoff', { n: others }));
    const pk = peaks().find(p => p.from <= o.date_to && p.to >= o.date_from); if (pk) w.push(T('w_peak', { name: pk.name || fmtDay(pk.from) }));
    return w;
  }

  // ---------- notifications ----------
  const NOTE_GROUPS = { assigned: ['tour_assigned', 'tour_removed'], changed: ['tour_changed'], cancelled: ['tour_cancelled', 'tour_restored'], reminder: ['tour_tomorrow'] };
  const muted = (id, kind) => ((person(id) || {}).mute || []).some(g => (NOTE_GROUPS[g] || []).includes(kind));
  async function notify(userIds, kind, params) {
    const ids = [...new Set(userIds.filter(Boolean))].filter(id => id !== me().id && !muted(id, kind));
    for (const id of ids) {
      try { await S.save('notifications', { id: S.uid(), user_id: id, kind, params, read: false, created_at: new Date().toISOString() }); } catch (e) { console.error(e); }
    }
  }
  const admins = () => db.profiles.filter(p => p.role === 'admin' && p.active !== false).map(p => p.id);
  const myNotes = () => db.notifications.filter(n => n.user_id === me().id).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  // "X asks to change their tours": the admin answers right on the notice. Older notices have no ids, so the tours are found by their names.
  const tcWho = n => { const q = n.params || {}; return db.profiles.find(x => x.id === q.user_id) || db.profiles.find(x => x.name === q.name); };
  const tcIds = (n, k) => { const q = n.params || {}; if (Array.isArray(q[k + '_ids'])) return q[k + '_ids'].map(String); const txt = String(q[k] || ''); return catalog().filter(c => c.id && c.title && txt.includes(c.title)).map(c => String(c.id)); };
  function tcBtns(n) {
    if (n.kind !== 'tours_change' || !isAdmin() || state.viewAs) return '';
    const done = (n.params || {}).done;
    if (done) return `<div><span class="tag ${done === 'applied' ? 't-ok' : 't-muted'}">${T(done === 'applied' ? 'tc_applied' : 'tc_declined')}</span></div>`;
    if (!tcWho(n)) return '';
    return `<div class="bar tcbar"><button class="btn sm primary" data-act="tcapply" data-id="${n.id}">${T('tc_apply')}</button><button class="btn sm" data-act="tccorrect" data-id="${n.id}">${T('tc_correct')}</button><button class="btn sm" data-act="tcdecline" data-id="${n.id}">${T('tc_decline')}</button></div>`;
  }
  async function tcAnswer(id, ok) {
    const n = db.notifications.find(x => String(x.id) === String(id)), who = n && tcWho(n); if (!who) return;
    if (ok) {
      const all = catalog().filter(c => c.id).map(c => String(c.id)), cur = new Set((who.skills || []).length ? who.skills.map(String) : all);
      tcIds(n, 'drop').forEach(x => cur.delete(x)); tcIds(n, 'add').forEach(x => cur.add(x));
      await S.save('profiles', { ...stripEmail(who), skills: all.filter(x => cur.has(x)) });
    }
    const L = window.I18N.t(['en', 'ru', 'ka'].includes(who.lang) ? who.lang : 'en', 'tc_list');
    await notify([who.id], ok ? 'creq_approved' : 'creq_declined', { title: L });
    await S.save('notifications', { ...n, read: true, params: { ...(n.params || {}), done: ok ? 'applied' : 'declined' } });
    toast(T(ok ? 'tc_applied' : 'tc_declined')); renderModal();
  }
  function noteText(n) { const p = { ...(n.params || {}) }; if (p.date) p.date = fmtDay(p.date); if (p.from) p.range = fmtRange(p.from, p.to || p.from); return T('n_' + n.kind, p); }
  let swReg = null;
  function systemNotify(text) {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      if (swReg && swReg.showNotification) swReg.showNotification('Friendly Schedule', { body: text, icon: 'icon-192.png', tag: 'fs' });
      else new Notification('Friendly Schedule', { body: text });
    } catch (e) { /* not supported here */ }
  }
  // ---------- notification settings for this phone ----------
  const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);
  // Add to Home Screen: Android Chrome offers its own Install window (beforeinstallprompt); on iPhone Safari we show the two steps.
  let installEvt = null; window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; try { render(); } catch (x) { /* not ready yet */ } });
  window.addEventListener('appinstalled', () => { installEvt = null; try { render(); } catch (x) { /* fine */ } });
  const isAndroid = () => /Android/i.test(navigator.userAgent);
  const installHidden = () => { try { return Number(localStorage.getItem('fs-install-later') || 0) > Date.now(); } catch (e) { return false; } };
  function installCardHtml(full) {
    if (standalone()) return full ? `<div class="card f"><b>${T('install_title')}</b><span class="tag t-ok">${T('inst_done')}</span></div>` : '';
    if (!full && installHidden()) return '';
    const how = installEvt ? `<button class="btn primary" data-act="install">${T('inst_btn')}</button>` : isIOS() ? `<ol class="insteps"><li>${T('inst_ios1')}</li><li>${T('inst_ios2')}</li><li>${T('inst_ios3')}</li></ol>` : isAndroid() ? `<ol class="insteps"><li>${T('inst_and1')}</li><li>${T('inst_and2')}</li></ol>` : `<span class="muted">${T('install_text')}</span>`;
    return `<div class="card f instcard"><b>${T('install_title')}</b><span class="muted">${T('inst_why')}</span>${how}${full ? '' : `<div class="bar"><span class="spacer"></span><button class="lnk" data-act="instlater">${T('inst_later')}</button></div>`}</div>`;
  }
  const standalone = () => window.matchMedia && window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  function notifCardHtml(perm) {
    const ready = !!CFG.vapidPublicKey && S.mode === 'supabase', sub = state.pushSub;
    if (state.pushSub === undefined && swReg && 'PushManager' in window) { state.pushSub = null; swReg.pushManager.getSubscription().then(x => { state.pushSub = x || false; render(); }).catch(() => { state.pushSub = false; }); }
    const on = perm === 'granted' && !!sub;
    const st = perm === 'unsupported' ? (isIOS() && !standalone() ? 'nf_ios_home' : 'push_unsupported') : perm === 'denied' ? 'nf_blocked' : on ? 'nf_on' : perm === 'granted' && !ready ? 'nf_open_only' : 'nf_off';
    return `<div class="card f nfcard"><div class="row"><b>${T('nf_title')}</b><span class="spacer"></span><span class="tag ${on ? 't-ok' : 't-muted'}">${T(on ? 'nf_tag_on' : 'nf_tag_off')}</span></div>
      <span class="small">${T(st)}</span>
      <div class="bar">${perm !== 'unsupported' && perm !== 'denied' && !on ? `<button class="btn primary" data-act="push">${T('push_enable')}</button>` : ''}${on ? `<button class="btn" data-act="pushtest">${T('nf_test')}</button><button class="btn" data-act="pushoff">${T('nf_off_btn')}</button>` : ''}</div>
      ${isIOS() ? `<span class="muted small">${T('push_ios')}</span>` : ''}${perm === 'denied' ? `<span class="muted small">${T(isIOS() ? 'nf_unblock_ios' : 'nf_unblock')}</span>` : ''}
      <b class="small">${T('note_pick')}</b>`;
  }
  async function pushOff() { try { const s = swReg && await swReg.pushManager.getSubscription(); if (s) { await S.removePushSubscription(s.endpoint); await s.unsubscribe(); } } catch (e) { console.error(e); } state.pushSub = false; toast(T('nf_off_done')); render(); }
  async function pushTest() { await S.save('notifications', { id: S.uid(), user_id: me().id, kind: 'test', params: {}, read: false, created_at: new Date().toISOString() }); toast(T('nf_test_sent')); }
  async function enableNotifications() {
    if (!('Notification' in window)) { toast(T('push_unsupported')); return; }
    let perm = 'denied';
    try { perm = await Notification.requestPermission(); } catch (e) { perm = 'denied'; }
    if (perm !== 'granted') { toast(T('push_denied')); render(); return; }
    try {
      if (swReg && CFG.vapidPublicKey && 'PushManager' in window) {
        const key = Uint8Array.from(atob(CFG.vapidPublicKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
        const sub = await swReg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
        await S.savePushSubscription(sub); state.pushSub = sub;
        toast(T('push_on'));
      } else toast(T('push_open_only'));
    } catch (e) { console.error(e); toast(T('push_open_only')); }
    render();
  }

  // ---------- small UI helpers ----------
  // ---------- problem log ----------
  // Errors, failed saves and lost connections are kept on the phone and sent to the admin's Problems list when online.
  const ERRQ = 'fs-errq';
  const deviceName = () => `${/Android/i.test(navigator.userAgent) ? 'Android' : /iPhone|iPad/i.test(navigator.userAgent) ? 'iPhone' : /Mac/i.test(navigator.userAgent) ? 'Mac' : /Windows/i.test(navigator.userAgent) ? 'Windows' : 'other'} · ${/CriOS|Chrome/i.test(navigator.userAgent) ? 'Chrome' : /Safari/i.test(navigator.userAgent) ? 'Safari' : /Firefox/i.test(navigator.userAgent) ? 'Firefox' : 'browser'} · ${window.innerWidth}px`;
  let errBusy = false;
  let hiddenAt = 0; document.addEventListener('visibilitychange', () => { hiddenAt = Date.now(); });
  function logErr(kind, message, detail) {
    try {
      const msg = String(message || '').slice(0, 500); if (!msg || /ResizeObserver loop|^Script error\.?$/i.test(msg)) return;
      if (/abort|load failed|failed to fetch|networkerror/i.test(msg) && (!navigator.onLine || document.hidden || Date.now() - hiddenAt < 15000)) return; // the phone paused the app or lost signal: not a real problem
      const q = JSON.parse(localStorage.getItem(ERRQ) || '[]');
      if (q.length && q[q.length - 1].message === msg && Date.now() - new Date(q[q.length - 1].at).getTime() < 60000) return; // same error again within a minute
      q.push({ id: S.uid(), at: new Date().toISOString(), kind, message: msg, detail: String(detail || '').slice(0, 2000), page: `${state.view}${state.view === 'calendar' ? '/' + state.mode : state.view === 'admin' ? '/' + (state.adminTab || '') : ''}`, version: APP_VERSION, device: deviceName() });
      localStorage.setItem(ERRQ, JSON.stringify(q.slice(-60)));
    } catch (e) { /* storage full or blocked */ }
    setTimeout(flushErr, 500);
  }
  async function flushErr() {
    if (errBusy || !me() || !me().active || S.offline) return; let q = [];
    try { q = JSON.parse(localStorage.getItem(ERRQ) || '[]'); } catch (e) { q = []; } if (!q.length) return;
    errBusy = true; try { localStorage.setItem(ERRQ, '[]'); await S.reportErrors(q.map(x => ({ ...x, user_id: me().id }))); } catch (e) { try { const now = JSON.parse(localStorage.getItem(ERRQ) || '[]'); localStorage.setItem(ERRQ, JSON.stringify([...q, ...now].slice(-60))); } catch (e2) { /* blocked */ } } errBusy = false;
  }
  window.addEventListener('error', ev => logErr('error', ev.message, [ev.filename && ev.filename.split('/').pop() + ':' + ev.lineno, ev.error && ev.error.stack].filter(Boolean).join('\n')));
  window.addEventListener('unhandledrejection', ev => { const r = ev.reason || {}; if (r.viewOnly) { ev.preventDefault(); return; } logErr('error', r.message || String(r), r.stack || ''); });
  // When the connection drops for more than 30 seconds, write down for how long.
  let offSince = null;
  // A computer that went to sleep or a hidden tab is not a lost connection: such gaps are not written to the problem log.
  let napped = false, lastTick = Date.now();
  setInterval(() => { if (Date.now() - lastTick > 20000 && offSince) napped = true; lastTick = Date.now(); }, 5000);
  document.addEventListener('visibilitychange', () => { if (document.hidden && offSince) napped = true; });
  function watchConn() { if (S.mode === 'demo') return; if (S.offline && !offSince) { offSince = Date.now(); napped = !!document.hidden; } else if (!S.offline && offSince) { const sec = Math.round((Date.now() - offSince) / 1000), from = new Date(offSince), slept = napped; offSince = null; napped = false; if (sec >= 30 && !slept) logErr('offline', `No connection for ${sec >= 120 ? Math.round(sec / 60) + ' min' : sec + ' s'}, from ${from.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`, navigator.onLine ? 'phone was online: database or network did not answer' : 'phone had no internet'); else flushErr(); } }
  // Short codes for troubleshooting: the same code shows on screen, in the Problems list and in Back office > Problems > What the codes mean.
  function errCode(e) {
    const m = String((e && (e.message || e.code)) || e || '');
    if (!navigator.onLine) return 'E1';
    if (/fetch|network|load failed|timed? ?out|abort/i.test(m)) return 'E2';
    if (/jwt|token|session|refresh|not authenticated|401/i.test(m)) return 'E3';
    if (/row-level security|permission denied|not allowed|only an admin|403|42501/i.test(m)) return 'E4';
    if (/column .* does not exist|schema cache|could not find the .* column|relation .* does not exist|42703|PGRST204|42P01/i.test(m)) return 'E5';
    if (/duplicate key|already exists|23505/i.test(m)) return 'E6';
    return 'E9';
  }
  const ERR_CODES = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E9'];
  // ---------- small sounds and vibration: quiet, short, made in the browser; one switch in Settings ----------
  let actx = null;
  const sndOn = () => { try { return localStorage.getItem('fs-sound') !== 'off'; } catch (e) { return true; } };
  function tone(seq, vol) {
    if (!sndOn()) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume();
      let t = actx.currentTime + 0.01;
      seq.forEach(([f, d, type]) => { const o = actx.createOscillator(), g = actx.createGain(); o.type = type || 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.06, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + d + 0.02); t += d * 0.82; });
    } catch (e) { /* no sound on this phone */ }
  }
  const buzz = p => { if (sndOn() && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) { /* not allowed */ } } };
  const fx = {
    tap() { buzz(8); },
    ok() { tone([[660, 0.09], [880, 0.14]]); buzz(14); },
    err() { tone([[233, 0.16, 'triangle'], [185, 0.22, 'triangle']], 0.08); buzz([24, 50, 24]); },
    sheet() { tone([[520, 0.06]], 0.03); },
    box() { tone([[392, 0.07, 'triangle'], [523, 0.09, 'triangle']], 0.05); buzz(20); },
    badge() { tone([[523, 0.11], [659, 0.11], [784, 0.11], [1047, 0.32]], 0.07); buzz([16, 40, 16, 40, 60]); },
  };
  document.addEventListener('click', ev => { if (ev.target.closest && ev.target.closest('button,a,summary,label,select')) fx.tap(); }, true);
  function toast(text) {
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = text;
    $('#toasts').appendChild(el); setTimeout(() => el.remove(), 3500);
  }
  const initials = n => ((n || '').replace(/\(.*?\)/g, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(x => [...x][0]).join('') || '?').toUpperCase();
  const avatar = (id, big) => { const p = person(id); if (!p) return ''; const c = big ? 'avatar big' : 'avatar', lib = avLib(p.avatar); if (lib) return `<span class="${c} avlib" style="background:${esc(lib.color)}" title="${esc(p.name)}">${msi(lib.icon)}</span>`; return p.avatar ? `<img class="${c}" src="${esc(p.avatar)}" alt="${esc(p.name)}" title="${esc(p.name)}">` : `<span class="${c} ${!big && IC[p.role] ? 'role' : ''}" style="background:${esc(p.color || '#66737f')}" title="${esc(p.name + ' · ' + T('role_' + p.role))}">${!big && IC[p.role] ? ico(p.role) : esc(initials(p.name))}</span>`; };
  const acText = t => (t.children > 0 ? T('ad_ch', { a: t.adults || 0, c: t.children }) : (t.adults || t.pax || 0) === 1 ? T('ad_one') : T('ad_only', { a: t.adults || t.pax || 0 }));
  const dateText = t => (endOf(t) !== t.date ? fmtRange(t.date, endOf(t)) : fmtDay(t.date));
  const payFor = (t, role) => { const o = t[role + '_pay']; if (o !== null && o !== undefined && o !== '') return Number(o) || 0; const pt = (rules().payTable || {})[t.title]; if (pt && (Number(pt[role + '_base']) || Number(pt[role + '_guest']))) return ((Number(pt[role + '_base']) || 0) + (Number(pt[role + '_guest']) || 0) * (t.pax || 0)) * tourDays(t).length; return (Number((rules().pay || {})[role + '_' + t.kind]) || 0) * tourDays(t).length; };
  const pairHtml = t => {
    const parts = [];
    if (t.guide_id) parts.push(`<span class="p">${avatar(t.guide_id)}${esc(pname(t.guide_id))}</span>`);
    if (t.driver_id) parts.push(`<span class="p">${avatar(t.driver_id)}${esc(pname(t.driver_id))}</span>`);
    return parts.length ? `<span class="pair">${parts.join('<span class="plus">+</span>')}</span>` : `<span class="tag t-warn">${T('unassigned')}</span>`;
  };
  const paxText = t => t.capacity > 0 ? `${t.pax || 0}/${t.capacity}` : `${t.pax || 0}`;
  const offTag = o => `<span class="tag ${o.type === 'sick' ? 't-sick' : 't-off'}">${T(o.type === 'sick' ? 'sick' : o.type === 'half' ? 'halfday' : 'dayoff')}${o.status === 'pending' ? ' · ' + T('pending') : ''}</span>`;
  const opt = (v, label, sel) => `<option value="${esc(v)}"${String(v) === String(sel ?? '') ? ' selected' : ''}>${esc(label)}</option>`;
  const peopleOpts = (role, sel) => {
    const st = staff(), grp = (label, list) => (list.length ? `<optgroup label="${esc(label)}">${list.map(p => opt(p.id, p.name, sel)).join('')}</optgroup>` : '');
    if (role === 'driver') return opt('', st.some(p => p.role === 'driver') ? '—' : T('no_drivers'), sel) + grp(T('role_driver'), st.filter(p => p.role === 'driver')) + grp(T('guides_driving'), st.filter(p => p.role === 'guide' && p.vehicle)) + grp(T('others'), st.filter(p => p.role === 'admin' || (p.role === 'guide' && !p.vehicle)));
    return opt('', '—', sel) + grp(T('role_guide'), st.filter(p => p.role === 'guide')) + grp(T('others'), st.filter(p => p.role !== 'guide'));
  };
  // While something is being saved: a thin moving bar at the top, and the pressed button shows it is working and cannot be pressed twice.
  let busyN = 0;
  function busyWhile(btn, p) {
    if (!p || typeof p.then !== 'function') return; busyN++; document.documentElement.classList.add('busy');
    const b = btn && btn.tagName === 'BUTTON' ? btn : null, key = b && (b.dataset.act || '') + '|' + (b.dataset.id || '') + '|' + (b.textContent || '').trim();
    const t = setTimeout(() => { if (b && b.isConnected) { b.setAttribute('aria-busy', 'true'); b.disabled = true; } }, 150);
    Promise.resolve(p).catch(() => {}).finally(() => { clearTimeout(t); if (--busyN <= 0) { busyN = 0; document.documentElement.classList.remove('busy'); } if (b) { b.removeAttribute('aria-busy'); b.disabled = false; } });
  }
  async function run(fn, okText) {
    if (state.viewAs) { toast(T('va_readonly')); return; }
    try { await fn(); if (okText) { toast(okText); fx.ok(); } } catch (e) { fx.err(); console.error(e); const m = String((e && e.message) || ''); logErr('save', `${errCode(e)} ${m || 'Save failed'}`, e && e.stack); toast(/invalid login/i.test(m) ? T('err_login') : /already registered|already exists/i.test(m) ? T('err_exists') : `${T('err_save')} (${errCode(e)}): ${T('ec_' + errCode(e))}`); }
    render();
  }

  // ---------- auth screens ----------
  // A small flat picture of our world (mountains, a hill church, the road and the van) for the login page.
  const HERO_ART = '<svg class="authart" viewBox="0 0 400 150" aria-hidden="true"><rect width="400" height="150" fill="#e9e8dc"/><circle cx="318" cy="46" r="20" fill="#f0901e"/><path d="M0 118 70 52l44 44 40-58 62 80 46-46 138 60V150H0z" fill="#b9c4ae"/><path d="M154 38l22 30-14 8-10-10-12 10z" fill="#f7f5ef"/><path d="M0 150v-30c60-22 120-6 170-14s120-30 230-6v50z" fill="#314b3c"/><g fill="#20251f"><path d="M246 98l10-26 10 26z"/><path d="M262 100l8-20 8 20z"/><path d="M232 100l7-16 7 16z"/></g><path d="M20 150c40-26 110-18 170-26" fill="none" stroke="#f7f5ef" stroke-width="5" stroke-linecap="round" stroke-dasharray="14 12"/><g transform="translate(96 108)"><rect x="0" y="4" width="44" height="18" rx="5" fill="#f7f5ef" stroke="#20251f" stroke-width="2.5"/><path d="M26 6h10l6 8H26z" fill="#9fb7c9" stroke="#20251f" stroke-width="2"/><rect x="6" y="0" width="22" height="4" rx="2" fill="#20251f"/><circle cx="11" cy="23" r="5" fill="#20251f"/><circle cx="33" cy="23" r="5" fill="#20251f"/></g></svg>';
  function authHtml() {
    const a = state.auth, msg = state.authMsg ? `<div class="banner">${esc(state.authMsg)}</div>` : '', pw = state.showPw;
    // Language sits right under the form, next to the account links: a globe and three short buttons.
    const langSel = `<div class="authlang" role="group" aria-label="${T('language')}">${msi('language')}<div class="seg">${[['en', 'EN', 'English'], ['ru', 'RU', 'Русский'], ['ka', 'KA', 'ქართული']].map(([k, l, n]) => `<button type="button" data-act="prelangb" data-v="${k}" aria-pressed="${lang() === k}" lang="${k}" title="${n}" aria-label="${n}">${l}</button>`).join('')}</div></div>`;
    const brand = `${HERO_ART}<div class="authhead"><div class="brand big"><i></i>Friendly Schedule</div><p class="muted">${T('login_sub')}</p></div>`;
    const privacy = `<details class="sect"><summary>${T('privacy_link')}</summary><p class="muted small">${T('privacy_text', { n: pv().guideDays })}</p></details>`;
    if (me() && !me().active) return `<main><div class="auth f">${brand}<div class="card"><h2>${T(me().left_at ? 'closed_title' : 'pending_title')}</h2><p class="muted">${T(me().left_at ? 'closed_text' : 'pending_text')}</p>${S.loginNote ? `<p class="muted small">${esc(me().email || '')} · ${esc(S.loginNote)}</p>` : ''}</div><button class="btn primary" data-act="reload">${T('refresh')}</button><button class="btn" data-act="signout">${T('signout')}</button>${langSel}</div></main>`;
    if (a === 'newpass') return `<main><form class="auth f" data-form="newpass">${brand}<h2>${T('new_password')}</h2>${msg}<label>${T('password')}<input id="np-pass" name="password" type="password" minlength="8" required autocomplete="new-password"></label><button class="btn primary">${T('save')}</button>${langSel}</form></main>`;
    return `<main><form class="auth f" data-form="${a}">${brand}<div class="authcard f"><h2>${T(a === 'signup' ? 'create_account' : a === 'reset' ? 'reset_password' : 'sign_in')}</h2>${msg}
      ${a === 'signup' ? `<p class="muted small">${T('signup_steps')}</p><label>${T('your_name')}<input id="au-name" name="name" required autocomplete="name"></label>` : ''}
      <label>${T('email')}<input id="au-email" name="email" type="email" required autocomplete="email" inputmode="email"></label>
      ${a !== 'reset' ? `<label>${T('password')}<span class="pwrow"><input id="au-pass" name="password" type="${pw ? 'text' : 'password'}" minlength="8" required autocomplete="${a === 'signup' ? 'new-password' : 'current-password'}"><button type="button" class="btn sm" data-act="showpw" aria-pressed="${!!pw}">${T(pw ? 'hide_pw' : 'show_pw')}</button></span></label>` : ''}
      <button class="btn primary big">${T(a === 'signup' ? 'create_account' : a === 'reset' ? 'send_reset' : 'sign_in')}</button>
      </div><div class="authfoot"><div class="bar">${a !== 'signin' ? `<button type="button" class="lnk" data-act="auth" data-to="signin">${T('sign_in')}</button>` : ''}${a !== 'signup' ? `<button type="button" class="lnk" data-act="auth" data-to="signup">${T('create_account')}</button>` : ''}${a !== 'reset' ? `<button type="button" class="lnk" data-act="auth" data-to="reset">${T('forgot')}</button>` : ''}</div>${langSel}</div>
      ${S.mode === 'demo' ? `<div class="banner small">${T('demo_login')}</div>` : ''}${privacy}</form></main>`;
  }

  const helpBtn = () => `<button class="iconbtn" data-act="help" aria-label="${T('help')}" aria-pressed="${!!state.help}">?</button>`;
  const helpBox = k => (state.help ? `<div class="banner small">${T('help_' + k)}</div>` : '');
  // ---------- calendar ----------
  function tourChip(t) {
    const w = tourWarnings(t);
    return `<button class="chip" style="--k:${esc(tourStyle(t.title).color)}" data-act="tour" data-id="${t.id}"${isAdmin() ? ` data-drag="${t.id}"` : ''} title="${esc(w.map(x => x.tx).join('\n'))}">${emblem(t)}<b>${esc(t.start_time || '')}</b> ${esc(t.title)} <span class="num muted">${paxText(t)}</span>${w.length ? ` <span class="chk">${T('chk')}</span>` : ''}</button>`;
  }
  // Small mark under a date: my own day off, or (team view) how many people are off.
  const offCount = d => new Set(db.time_off.filter(o => o.status !== 'declined' && o.date_from <= d && o.date_to >= d).map(o => o.user_id)).size;
  function offMark(d) {
    const mine = offOn(me().id, d), n = state.mine ? 0 : offCount(d);
    if (!mine && !n) return '';
    return `<span class="offm ${mine ? 'me' : ''}" title="${esc(T('off_today'))}">${ico('sun')}${mine ? esc(T('off_mine')) : n}</span>`;
  }
  function dayBlock(d) {
    const td = today(), ho = holidayOn(d), ev = eventOn(d);
    const dts = toursOnDay(d).filter(t => (!state.mine || involves(t, me().id))).sort((x, y) => (x.start_time || '').localeCompare(y.start_time || ''));
    const offs = db.time_off.filter(o => o.status !== 'declined' && o.date_from <= d && o.date_to >= d && (!state.mine || o.user_id === me().id));
    const cxs = cancelledOnDay(d).filter(t => !state.mine || involves(t, me().id));
    return `<div class="dayhd" id="day-${d}" data-drop="${d}"><b class="${d === td ? 'tdy' : ''}">${esc(fmt(d, { weekday: 'long', day: 'numeric', month: 'long' }))}</b>${ho ? `<span class="tag t-hol">${msi('celebration')}${esc(ho.name)}</span>` : ''}${pubHolOn(d) && !ho ? `<span class="tag t-pub" title="${esc(T('ph_info'))}">${msi('flag')}${esc(T(pubHolOn(d)))}</span>` : ''}${ev ? `<span class="tag t-group">${esc(ev.name)}</span>` : ''}<span class="spacer"></span>${dts.length ? `<button class="lnk" data-act="summary" data-date="${d}">${T('day_summary')}</button>` : ''}${!isAdmin() && d > td && !offOn(me().id, d) ? `<button class="lnk" data-act="offnew" data-date="${d}">${T('ask_dayoff')}</button>` : ''}</div>
      ${dts.map(agendaCard).join('')}${cxs.map(agendaCard).join('')}${offs.map(o => `<div class="acard off ${o.type === 'sick' ? 'sick' : o.type === 'half' ? 'half' : ''}"><span class="ttl">${msi(o.type === 'sick' ? 'sick' : 'beach_access')}${T(o.type === 'sick' ? 'sick' : o.type === 'half' ? 'halfday' : 'dayoff')}${o.status === 'pending' ? ' · ' + T('pending') : ''}</span><span class="row">${avatar(o.user_id)}<span>${esc(pname(o.user_id))}</span></span></div>`).join('')}
      ${!dts.length && !offs.length && !cxs.length ? `<div class="muted small nothing" data-drop="${d}">${T('no_tours')}</div>` : ''}`;
  }
  function agendaCard(t) {
    const off = !live(t), w = off ? [] : tourWarnings(t), ppl = [t.guide_id, t.driver_id].filter(Boolean);
    return `<button class="acard ${off ? 'cancelled' : ''}" data-key="t${t.id}" style="--k:${esc(tourStyle(t.title).color)}" data-act="tour" data-id="${t.id}"${isAdmin() && !off ? ` data-drag="${t.id}"` : ''} data-drop="${t.date}"><span class="ttl">${emblem(t, true)}<span>${t.start_time ? `<span class="num st">${esc(t.start_time)}</span> ` : ''}<span class="tname">${esc(t.title)}</span></span></span><span class="kindrow"><span class="kind k-${esc(t.kind || 'private')}">${msi(t.kind === 'group' ? 'groups' : t.kind === 'transfer' ? 'airport_shuttle' : 'person')}${T('kind_' + (t.kind || 'private'))}</span><span class="num cnt">${paxText(t)}</span>${w.length ? ` <span class="chk">${T('chk')}</span>` : ''}${off ? ` <span class="tag t-danger">${T('cancelled')}</span>` : ''}${!off && staysN(tourBookings(t.id)) ? ` <span class="tag t-stay num">${T('stay_n', { n: staysN(tourBookings(t.id)) })}</span>` : ''}</span>${endOf(t) !== t.date ? `<span class="num muted small">${esc(fmtRange(t.date, endOf(t)))}</span>` : ''}${wxLine(t)}<span class="row">${ppl.length ? ppl.map(id => `<span class="p">${avatar(id)}${esc(pname(id))}</span>`).join('') : `<span class="tag t-warn">${T('unassigned')}</span>`}</span></button>`;
  }
  // ---------- Sunday evening: every guide and driver checks next week's schedule ----------
  const taskTitle = k => (k.kind === 'week_check' ? T('wk_title') : k.title);
  function weekSunday() { const d = new Date(), wd = d.getDay(); if (wd === 0 && d.getHours() >= 17) return today(); if (wd === 1) return addDays(today(), -1); return null; }
  function weekCheck() {
    if (!me() || !me().active || isAdmin() || S.offline) return; const sun = weekSunday(); if (!sun) return;
    if (db.tasks.some(k => k.kind === 'week_check' && k.due_date === sun && (k.assignees || []).includes(me().id))) return;
    S.save('tasks', { id: S.uid(), kind: 'week_check', title: 'Check your schedule for next week', notes: null, due_date: sun, assignees: [me().id], status: 'open', tour_id: null, created_by: me().id, done_by: null, done_at: null }).then(render).catch(() => {});
  }
  function weekCardHtml() {
    const k = db.tasks.find(x => x.kind === 'week_check' && x.status === 'open' && (x.assignees || []).includes(me().id)); if (!k) return '';
    const from = addDays(k.due_date, 1), to = addDays(k.due_date, 7), id = me().id;
    const ts = db.tours.filter(t => live(t) && involves(t, id) && t.date <= to && endOf(t) >= from).sort((x, y) => (x.date + (x.start_time || '')).localeCompare(y.date + (y.start_time || '')));
    const offs = db.time_off.filter(o => o.user_id === id && o.status !== 'declined' && o.date_from <= to && o.date_to >= from);
    return `<div class="card f wkcard" data-key="wk${k.id}"><b>${T('wk_title')}</b><span class="muted small num">${esc(fmtRange(from, to))}</span>
      ${ts.length ? `<div class="list">${ts.map(t => `<button class="arow" data-act="tour" data-id="${t.id}">${emblem(t)}<span><b class="num">${esc(fmt(t.date, { weekday: 'short', day: 'numeric' }))} ${esc(t.start_time || '')}</b> ${esc(t.title)}</span></button>`).join('')}</div>` : `<span class="small">${T('wk_none')}</span>`}
      ${offs.length ? `<span class="small">${T('dayoff')}: <span class="num">${offs.map(o => esc(fmtRange(o.date_from, o.date_to))).join(', ')}</span></span>` : ''}
      <form class="f" data-form="avail" data-wk="${from}" data-task="${k.id}"><b>${T('av_title')}</b><span class="muted small">${T('av_text')}</span>${weekEditor(me(), from)}
      <div class="actions"><button class="btn primary">${T('av_save')}</button></div></form></div>`;
  }
  function nextHtml() {
    const td = today(), id = me().id;
    const asks = db.change_requests.filter(q => q.swap_with === id && q.status === 'pending' && !q.agreed);
    const nt = db.tours.filter(t => live(t) && involves(t, id) && endOf(t) >= td).sort((x, y) => (x.date + (x.start_time || '')).localeCompare(y.date + (y.start_time || '')))[0];
    const off = db.time_off.filter(o => o.user_id === id && o.status !== 'declined' && o.date_to >= td).sort((x, y) => x.date_from.localeCompare(y.date_from))[0];
    if (!nt && !asks.length && isAdmin()) return '';
    const bk = nt ? tourBookings(nt.id) : [];
    return `${!isAdmin() && state.mine && state.mode === 'week' ? '' : weekCardHtml()}${asks.map(q => { const t = db.tours.find(x => x.id === q.tour_id); return t ? `<div class="card"><b>${T('swap_ask_title', { name: pname(q.user_id) })}</b><span class="row nw">${emblem(t, true)}<span class="grow-l"><span class="ttl">${esc(t.title)}</span><span class="muted small num">${esc(dateText(t))} ${esc(t.start_time || '')}</span></span></span><div class="actions"><button class="btn sm" data-act="swapagree" data-id="${q.id}" data-s="0">${T('decline')}</button><button class="btn sm primary" data-act="swapagree" data-id="${q.id}" data-s="1">${T('swap_agree')}</button></div></div>` : ''; }).join('')}
      <div class="nextrow">${nt ? `<button class="card" data-act="tour" data-id="${nt.id}"><span class="muted small">${T('next_tour')}</span><span class="row nw">${emblem(nt, true)}<span class="grow-l"><span class="ttl">${esc(nt.title)}</span></span></span><span class="num"><b>${esc(nt.date === td ? T('today') : dateText(nt))} ${esc(nt.start_time || '')}</b> <span class="muted small">· ${esc(acText(nt))}${cashDue(bk) ? ' · ' + T('cash_collect') + ' ' + cashDue(bk) + ' ' + esc(guestCur()) : ''}</span></span>${nt.pickup ? `<span class="muted small only-wide">${esc(nt.pickup)}</span>` : ''}</button>` : `<div class="card"><span class="muted small">${T('next_tour')}</span><span>${T('next_none')}</span></div>`}
      <button class="card offc" data-act="${off ? 'view' : 'offnew'}" data-v="timeoff"><span class="muted small">${T('next_off')}</span><span class="num"><b>${off ? esc(fmtRange(off.date_from, off.date_to)) : T('next_off_none')}</b></span>${off ? `<span>${offTag(off)}</span>` : `<span class="muted small">${T('request')}</span>`}</button></div>`;
  }
  // ---------- guide and driver home: only what matters, day by day ----------
  const nowHM = () => { const d = new Date(); return `${p2(d.getHours())}:${p2(d.getMinutes())}`; };
  // The tour that is on right now (from one hour before the start until the end), or null.
  function tourNow() {
    const td = today(), hm = nowHM(), id = me().id;
    return toursOnDay(td).filter(t => involves(t, id)).sort((x, y) => (x.start_time || '').localeCompare(y.start_time || '')).find(t => { if (endOf(t) !== t.date) return true; const st = t.start_time || '00:00', en = t.end_time || '23:59'; return hm >= hhmm(mins(st) - 60) && hm <= en; }) || null;
  }
  // One guest on the tour sheet, kept light for reading outdoors: name and buttons, then one plain summary line.
  // Phone, country, returning guest and VIP are on the guest's own sheet (tap the name).
  function guestRow(b, needAddr) {
    const due = b.payment && b.payment !== 'prepaid' ? `${T('pay_' + b.payment)}${b.amount_due ? ' ' + b.amount_due + ' ' + (b.currency || guestCur()) : ''}` : '';
    const lg = b.lang || ({ RUS: 'RU', GER: 'DE', FRA: 'FR' })[(String(b.guest).match(/\b(RUS|GER|FRA)\b/) || [])[1]] || '';
    const marks = (b.marks || []).map(markLabel), bits = [...(lg && !/^EN/i.test(lg) ? [langName(String(lg).toUpperCase())] : []), ...(isFree(b) ? [T('free_guest')] : []), ...marks], more = bits.length > 2 ? bits.length - 2 : 0;
    const trouble = (clientRating(b.client_id) || {}).rating === 'trouble';
    const sum = [`<span class="num">${esc(acText(b))}</span>`, due ? `<b class="due num">${esc(due)}</b>` : '', ...bits.slice(0, 2).map(esc), more ? `+${more}` : ''].filter(Boolean).join(' · ');
    return `<div class="grow"><span class="row nw"><button class="gbtn" data-act="guest" data-id="${b.id}"><span class="avatar ini">${esc(initials(cleanName(b.guest) || b.guest))}</span><span class="grow-l gtxt"><span class="gname">${esc(cleanName(b.guest) || b.guest)}</span><span class="gsum">${sum}</span></span></button>${b.attendance ? `<span class="tag ${b.attendance === 'arrived' ? 't-ok' : 't-danger'}">${T('att_' + b.attendance)}</span>` : ''}${b.phone ? `<span class="cbtns">${ib('wa', 'WhatsApp', waLink(b.phone))}${ib('call', T('call'), 'tel:' + b.phone)}</span>` : ''}</span>${needAddr && b.pickup_addr ? `<span class="gaddr">${ico('pin')}<span>${esc(b.pickup_addr)}</span></span>` : ''}${trouble ? `<span class="row">${ratingTag(b.client_id)}</span>` : ''}</div>`;
  }
  function guestRowsHtml(t) {
    const bks = tourBookings(t.id); if (!bks.length) return `<div class="empty">${guestsHidden(t) ? T('pv_hidden', { n: pv().guideDays }) : T('no_guests')}</div>`;
    const pick = bks.some(b => b.pickup_addr);
    return `<div class="glist">${bks.map(b => guestRow(b, pick)).join('')}</div>`;
  }
  function nowCardHtml(t) {
    const bks = tourBookings(t.id), other = t.guide_id === me().id ? t.driver_id : t.guide_id, op = person(other);
    return `<div class="card f nowcard" data-key="now${t.id}"><div class="row"><span class="tag t-ok">${T('now_tag')}</span><b class="num">${esc(t.start_time || '')}${t.end_time ? '–' + esc(t.end_time) : ''}</b><span class="spacer"></span><button class="lnk" data-act="tour" data-id="${t.id}">${T('open_tour')} ›</button></div>
      <div class="row nw">${emblem(t, true)}<b class="ttl grow-l">${esc(t.title)}</b></div>
      ${t.pickup ? `<div class="meet">${ico('pin')}<span class="grow-l">${esc(t.pickup)}</span><a class="btn sm" href="${esc(tourMap(t))}" target="_blank" rel="noopener">${T('map')}</a></div>` : ''}
      <div class="row"><b>${T('guests_title')} (${bks.length})</b><span class="muted small num">${esc(acText(t))}${bks.length ? ' · ' + T('att_sum', { a: bks.filter(b => b.attendance === 'arrived').length, n: bks.length, x: bks.filter(b => b.attendance === 'noshow').length }) : ''}</span></div>
      ${guestRowsHtml(t)}
      ${op ? `<div class="row nw">${avatar(other)}<span class="grow-l"><b>${esc(op.name)}</b>&nbsp;<span class="muted small">${T('role_' + (t.guide_id === other ? 'guide' : 'driver'))}</span></span>${staffBtns(op)}</div>` : ''}
      ${cashDue(bks) ? `<div><span class="tag t-warn num">${T('cash_collect')}: ${esc(cashText(bks))}</span></div>` : ''}</div>`;
  }
  function myDayHtml(d) {
    const td = today(), id = me().id, ho = holidayOn(d), ev = eventOn(d), o = offOn(id, d);
    const ts = toursOnDay(d).filter(t => involves(t, id)).sort((x, y) => (x.start_time || '').localeCompare(y.start_time || '')), cxs = cancelledOnDay(d).filter(t => involves(t, id));
    const card = t => { const off = !live(t), other = t.guide_id === id ? t.driver_id : t.guide_id, fr = tourBookings(t.id).filter(isFree).reduce((n, b) => n + (Number(b.pax) || 1), 0), vip = tourBookings(t.id).some(b => isVip(b.client_id));
      return `<button class="acard mycard ${off ? 'cancelled' : ''}" data-key="t${t.id}" style="--k:${esc(tourStyle(t.title).color)}" data-act="tour" data-id="${t.id}"><span class="ttl">${t.start_time ? `<span class="num st">${esc(t.start_time)}</span> ` : ''}<span class="tname">${esc(t.title)}</span> <span class="num cnt">(${paxText(t)})</span>${off ? ` <span class="tag t-danger">${T('cancelled')}</span>` : ''}${vip ? ` <span class="tag t-vip">${T('vip')}</span>` : ''}${!off && staysN(tourBookings(t.id)) ? ` <span class="tag t-stay num">${T('stay_n', { n: staysN(tourBookings(t.id)) })}</span>` : ''}${fr ? ` <span class="tag t-free num">${T('free_n', { n: fr })}</span>` : ''}</span>${endOf(t) !== t.date || other ? `<span class="num tm muted">${esc([endOf(t) !== t.date ? fmtRange(t.date, endOf(t)) : '', other ? pname(other) : ''].filter(Boolean).join(' · '))}</span>` : ''}${off ? '' : wxLine(t)}</button>`; };
    return `<div class="dayhd my ${d === td ? 'tdy' : ''}" id="day-${d}"><b>${d === td ? T('today') + ' · ' : ''}${esc(fmt(d, { weekday: 'long', day: 'numeric', month: 'long' }))}</b>${ho ? `<span class="tag t-hol">${esc(ho.name)}</span>` : ''}${ev ? `<span class="tag t-group">${esc(ev.name)}</span>` : ''}</div>
      ${ts.map(card).join('')}${cxs.map(card).join('')}${o ? `<div class="acard mycard off ${o.type === 'sick' ? 'sick' : ''}" style="--k:var(--private)"><span class="ttl">${msi(o.type === 'sick' ? 'sick' : 'beach_access')}${T(o.type === 'sick' ? 'sick' : o.type === 'half' ? 'halfday' : 'dayoff')}${o.status === 'pending' ? ` <span class="tag t-warn">${T('pending')}</span>` : ''}</span></div>` : ''}
      ${!ts.length && !cxs.length && !o ? `<div class="nothing2"><span class="muted">${T('nothing_planned')}</span>${d > td ? `<button class="lnk" data-act="offnew" data-date="${d}">${T('ask_dayoff')}</button>` : ''}</div>` : ''}`;
  }
  // The round "+" on phones opens a short menu: a tour (admins), a day off or a sick day.
  const PHONE = () => !!(window.matchMedia && window.matchMedia('(max-width:760px)').matches);
  function fabHtml() {
    if (state.viewAs) return '';
    return `<button class="btn primary fab only-phone" data-act="fabtoggle" aria-label="${T('add')}">+</button>`;
  }
  function addMenuHtml() {
    const item = (act, extra, icon, label) => `<button class="arow fabitem" data-act="${act}" ${extra}>${msi(icon)}<span>${label}</span></button>`, a = isAdmin();
    return `<div class="hdr"><h2>${T('add')}</h2><button class="iconbtn" data-act="close" aria-label="${T('close')}">✕</button></div><div class="fabmenu">
      ${a ? item('newtour', '', 'flag', T('tour')) : ''}${item('offnew', '', 'beach_access', T('dayoff'))}${item('offnew', 'data-type="sick"', 'sick', T('sick'))}
      ${a ? `<hr>${item('tasknew', '', 'add_task', T('task'))}<hr>${item('pnew', '', 'person_add', T('add_person'))}` : ''}</div>`;
  }
  function guideHomeHtml(days, title) {
    const td = today(), sel = state.date, id = me().id, now = days.includes(td) ? tourNow() : null;
    const asks = db.change_requests.filter(q => q.swap_with === id && q.status === 'pending' && !q.agreed);
    return `${setupCard(true)}${weekCardHtml()}${asks.length ? nextHtml() : ''}
      <div class="bar homebar"><h2>${esc(fmt(days[3], { month: 'long', year: 'numeric' }))}</h2><label class="jump" title="${T('pick_date')}">${ico('cal')}<input type="date" id="jump" data-ch="jump" value="${esc(state.date)}" aria-label="${T('pick_date')}"></label><span class="spacer"></span><div class="seg"><button data-act="nav" data-d="-1" aria-label="${T('prev')}">‹</button><button data-act="today">${T('today')}</button><button data-act="nav" data-d="1" aria-label="${T('next')}">›</button></div></div>
      <div class="list home"><div class="strip">${days.map(d => `<button data-act="day" data-date="${d}" aria-pressed="${d === sel}" class="${d === td ? 'tdy' : ''} ${offCls(offOn(id, d))} ${holidayOn(d) ? 'hol' : ''}"><span>${esc(fmt(d, { weekday: 'short' }))}</span><b class="num">${D(d).getDate()}</b><span class="dot ${toursOnDay(d).some(t => involves(t, id)) ? '' : 'none'}"></span></button>`).join('')}</div>
      ${now ? nowCardHtml(now) : ''}${days.map(myDayHtml).join('')}</div>
      <div class="bar homelinks"><button class="lnk" data-act="mode" data-m="month">${T('month')}</button><button class="lnk" data-act="mine" data-v="0">${T('home_team')}</button><button class="lnk" data-act="summary">${T('day_summary')}</button></div>`;
  }
  // Exchange rates to the pay currency (Rules), so money in USD, EUR and GEL can be added up.
  // Exchange rates. Official rates of the National Bank of Georgia, one per working day, are loaded by the admin's app
  // (api.frankfurter.dev, provider "nbg") and kept in settings "fx": { USD: { '2026-11-10': 2.71 }, EUR: {...}, upd }.
  // Money is converted with the rate of the tour date (or the last working day before it). The rates typed in Rules are used only when no official rate is known.
  const FX_CUR = ['USD', 'EUR'];
  const fxData = () => (db.settings.find(x => x.id === 'fx') || {}).value || {};
  function fxOn(cur, date) {
    const h = fxData()[cur]; if (!h) return 0; const k = memo['fxk' + cur] || (memo['fxk' + cur] = Object.keys(h).sort()); if (!k.length) return 0;
    let lo = 0, hi = k.length - 1, at = 0; while (lo <= hi) { const mid = (lo + hi) >> 1; if (k[mid] <= date) { at = mid; lo = mid + 1; } else hi = mid - 1; }
    return Number(h[k[at]]) || 0;
  }
  const manualRate = cur => { const m = String(rules().rates || 'USD 2.70, EUR 2.95').match(new RegExp(cur + '\\s*[=:]?\\s*([\\d.]+)', 'i')); return m ? Number(m[1]) : 0; };
  const rateOf = (cur, date) => {
    const base = rules().currency || 'GEL'; if (!cur || cur === base) return 1; const d = date || today();
    const gel = c => (c === 'GEL' ? 1 : fxOn(c, d)), a = gel(cur), b = gel(base);
    if (a && b) return a / b; return base === 'GEL' ? manualRate(cur) : (cur === 'GEL' && b ? 1 / b : manualRate(cur));
  };
  let fxBusy = false;
  async function fxRefresh() {
    if (fxBusy || !isAdmin() || !navigator.onLine) return; const td = today(), fx = fxData(), tdate = {}; db.tours.forEach(t => { tdate[t.id] = t.date; });
    let need = td; db.bookings.forEach(b => { const d = tdate[b.tour_id]; if (d && d < need && Number(b.price) && FX_CUR.includes(b.currency || guestCur())) need = d; });
    const keys = FX_CUR.flatMap(c => Object.keys(fx[c] || {})).sort(), first = keys[0], last = keys[keys.length - 1];
    if (fx.upd === td && first && first <= need) return;
    const from = !first || need < first ? (need < addDays(td, -30) ? need : addDays(td, -30)) : last;
    fxBusy = true;
    try {
      const out = { ...fx, upd: td };
      for (const c of FX_CUR) {
        const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 20000);
        const r = await fetch(`https://api.frankfurter.dev/v2/rates?from=${from}&to=${td}&base=${c}&quotes=GEL&providers=nbg`, { signal: ac.signal }).finally(() => clearTimeout(tm));
        if (!r.ok) throw new Error('rates ' + r.status); const rows = await r.json(), h = { ...(out[c] || {}) };
        (Array.isArray(rows) ? rows : []).forEach(x => { if (x && x.date && Number(x.rate) > 0) h[x.date] = Math.round(Number(x.rate) * 10000) / 10000; }); out[c] = h;
      }
      await S.save('settings', { id: 'fx', value: out }); memo = {}; render();
    } catch (e) { console.warn('exchange rates not loaded', e); } finally { fxBusy = false; }
  }
  // Platform commission: the price in a GetYourGuide or Viator email is what the guest paid; the platform keeps its share.
  // Back office > Rules > Platform commission, e.g. "GetYourGuide 25, Viator 20".
  const commOf = b => { const src = srcName(sourceOf(b) || b.source); if (!src) return 0; const m = String(rules().commission ?? 'GetYourGuide 25').match(new RegExp(src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*[=:]?\\s*([\\d.]+)', 'i')); return m ? Math.min(90, Number(m[1]) || 0) : 0; };
  const netOf = b => (Number(b.price) || 0) * (1 - commOf(b) / 100);
  function periodStats(from, to) {
    const ts = db.tours.filter(t => live(t) && t.date >= from && t.date <= to), ids = new Set(ts.map(t => t.id)), cur = rules().currency || 'GEL';
    let rev = 0, noPrice = 0, noRate = new Set(); const bks = db.bookings.filter(b => ids.has(b.tour_id)), tdOf = {}; ts.forEach(t => { tdOf[t.id] = t.date; });
    let comm = 0; bks.forEach(b => { const p = Number(b.price) || 0; if (!p) { noPrice++; return; } const r = rateOf(b.currency || guestCur(), tdOf[b.tour_id]); if (!r) { noRate.add(b.currency); return; } rev += p * r; comm += (p - netOf(b)) * r; });
    const pay = ts.reduce((n, t) => n + (t.guide_id ? payFor(t, 'guide') : 0) + (t.driver_id ? payFor(t, 'driver') : 0), 0), cost = ts.reduce((n, t) => n + costOf(t.id).total, 0);
    return { tours: ts.length, guests: ts.reduce((n, t) => n + (Number(t.pax) || 0), 0), bookings: bks.length, rev, comm, pay, cost, profit: rev - comm - pay - cost, noPrice, noRate: [...noRate], cur, unassigned: ts.filter(t => !t.guide_id).length };
  }
  // Phones: a slim bar above the menu with the result of the week or month on screen (like Setmore's "This week's income"); tap for the details.
  function incBarHtml(from, to) {
    const st = periodStats(from, to), money = st.rev ? `${nf(st.profit)} ${esc(st.cur)}` : '';
    return `<button class="incbar only-phone" data-act="pstats" data-from="${from}" data-to="${to}">${msi('payments')}<span class="grow-l">${T(state.mode === 'month' ? 'inc_month' : 'inc_week')} · <span class="num">${st.tours}</span> ${T('tours_n').toLowerCase()} · <span class="num">${st.guests}</span> ${T('guests').toLowerCase()}</span>${money ? `<b class="num ${st.profit < 0 ? 'neg' : ''}">${money}</b>` : ''}</button>`;
  }
  function periodStatsHtml(from, to) {
    const s = periodStats(from, to), m = v => `${nf(v)} ${esc(s.cur)}`;
    return `<details class="wstats"><summary><span class="num"><b>${s.tours}</b> ${T('tours_n').toLowerCase()} · <b>${s.guests}</b> ${T('guests').toLowerCase()}${s.rev ? ` · ${T('wf_profit')} <b class="${s.profit < 0 ? 'neg' : ''}">${m(s.profit)}</b>` : ''}</span>${s.unassigned ? `<span class="tag t-warn">${T('wf_unassigned', { n: s.unassigned })}</span>` : ''}</summary>
      <dl class="fields"><dt>${T('wf_revenue')}</dt><dd class="num">${m(s.rev)}</dd>${s.comm ? `<dt>${T('wf_comm')}</dt><dd class="num">− ${m(Math.round(s.comm))}</dd>` : ''}<dt>${T('wf_pay')}</dt><dd class="num">− ${m(s.pay)}</dd><dt>${T('wf_costs')}</dt><dd class="num">− ${m(s.cost)}</dd><dt><b>${T('wf_profit')}</b></dt><dd class="num"><b>${m(s.profit)}</b></dd></dl>
      <span class="muted small">${T('wf_note', { n: s.noPrice, b: s.bookings })}${s.noRate.length ? ' ' + T('wf_norate', { c: s.noRate.join(', ') }) : ''}</span></details>`;
  }
  function calendarHtml() {
    const wk = monday(state.date), days = [...Array(7)].map((_, i) => addDays(wk, i)), td = today();
    const people = crew().filter(p => !state.mine || p.id === me().id);
    const title = state.mode === 'week' ? (days[0].slice(0, 7) === days[6].slice(0, 7) ? `${D(days[0]).getDate()}–${fmt(days[6], { day: 'numeric', month: 'short', year: 'numeric' })}` : `${fmt(days[0], { day: 'numeric', month: 'short' })} – ${fmt(days[6], { day: 'numeric', month: 'short', year: 'numeric' })}`) : fmt(state.date, { month: 'long', year: 'numeric' });
    if (!isAdmin() && state.mine && state.mode === 'week') return guideHomeHtml(days, title) + fabHtml();
    let h = `${state.newVersion ? `<button class="banner small setupban" data-act="reload"><span>${T('nv_text')}</span><b>${T('nv_btn')} ›</b></button>` : ''}${setupCard(true)}${window.matchMedia('(max-width:760px)').matches ? installCardHtml(false) : ''}${nextHtml()}${fabHtml()}
      ${!PHONE() ? '' : `<div class="calhd"><button class="calttl" data-act="mode" data-m="${state.mode === 'month' ? 'week' : 'month'}" aria-expanded="${state.mode === 'month'}" aria-label="${T(state.mode === 'month' ? 'week' : 'month')}"><b>${esc(fmt(state.date, { month: 'long' }))}</b> <span class="yr num">${state.date.slice(0, 4)}</span>${msi(state.mode === 'month' ? 'keyboard_arrow_up' : 'keyboard_arrow_down')}</button><label class="jump" title="${T('pick_date')}">${ico('cal')}<input type="date" id="jump" data-ch="jump" value="${esc(state.date)}" aria-label="${T('pick_date')}"></label><span class="spacer"></span>
        ${monday(state.date) !== monday(td) ? `<button class="btn sm calnow" data-act="today">${T('today')}</button>` : ''}<button class="iconbtn" data-act="nav" data-d="-1" aria-label="${T('prev')}">‹</button><button class="iconbtn" data-act="nav" data-d="1" aria-label="${T('next')}">›</button>
        <button class="whochip" data-act="mine" data-v="${state.mine ? '0' : '1'}" aria-label="${T(state.mine ? 'mine' : 'team')}">${state.mine ? avatar(me().id) : `<span>${T('who_all')}</span>`}</button></div>`}
      ${PHONE() ? '' : `<div class="bar">
      <div class="seg"><button data-act="mode" data-m="week" aria-pressed="${state.mode === 'week'}">${T('week')}</button><button data-act="mode" data-m="month" aria-pressed="${state.mode === 'month'}">${T('month')}</button></div>
      <div class="seg"><button data-act="mine" data-v="0" aria-pressed="${!state.mine}">${T('team')}</button><button data-act="mine" data-v="1" aria-pressed="${!!state.mine}">${T('mine')}</button></div>
      <span class="spacer"></span><button class="btn only-wide" data-act="summary">${T('day_summary')}</button>${isAdmin() ? `<button class="btn primary only-wide" data-act="newtour">+ ${T('tour')}</button><button class="btn only-wide" data-act="offnew">+ ${T('dayoff')}</button>` : ''}<span class="only-wide">${helpBtn()}</span></div>${helpBox('calendar')}
      <div class="bar"><h2>${esc(title)}</h2><label class="jump" title="${T('pick_date')}">${ico('cal')}<input type="date" id="jump" data-ch="jump" value="${esc(state.date)}" aria-label="${T('pick_date')}"></label><span class="spacer"></span><div class="seg"><button data-act="nav" data-d="-1" aria-label="${T('prev')}">‹</button><button data-act="today">${T('today')}</button><button data-act="nav" data-d="1" aria-label="${T('next')}">›</button></div></div>`}`;
    const pFrom_To = [state.mode === 'month' ? state.date.slice(0, 8) + '01' : days[0], state.mode === 'month' ? addDays(addDays(state.date.slice(0, 8) + '01', 32).slice(0, 8) + '01', -1) : days[6]];
    const pstats = !(isAdmin() && !state.mine) ? '' : `<div class="only-wide">${periodStatsHtml(pFrom_To[0], pFrom_To[1])}</div>${incBarHtml(pFrom_To[0], pFrom_To[1])}`;
    if (state.mode === 'month') return h + monthHtml() + pstats;
    // wide: team grid
    const hd = days.map(d => { const ho = holidayOn(d), ev = eventOn(d); return `<div class="hd ${d === td ? 'today' : ''}">${esc(fmtDay(d))}${ho ? `<span class="hol">${esc(ho.name)}</span>` : ''}${ev ? `<span class="hol ev">${esc(ev.name)}</span>` : ''}</div>`; }).join('');
    const rowFor = (label, sub, id, filter) => `<div class="who">${id ? avatar(id) : ''}<div>${esc(label)}<span class="r">${esc(sub)}</span></div></div>` + days.map(d => {
      const ts = toursOnDay(d).filter(filter).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
      const o = id ? offOn(id, d) : null;
      const pdt = id && (isAdmin() || id === me().id) ? personalOn(id, d) : null;
      return `<div class="cell ${d === td ? 'today' : ''} ${o ? 'isoff' : ''}" data-drop="${d}" data-who="${id || ''}">${o ? offTag(o) : ''}${pdt ? `<span class="tag t-group">${esc(pdt.title)}</span>` : ''}${ts.map(tourChip).join('')}${isAdmin() ? `<button class="add" data-act="newtour" data-date="${d}" data-who="${id || ''}" aria-label="${T('add_tour')}">+</button>` : (id === me().id && !o && d > td ? `<button class="add" data-act="offnew" data-date="${d}" title="${T('ask_dayoff')}" aria-label="${T('ask_dayoff')}">+</button>` : '')}</div>`;
    }).join('');
    const un = days.some(d => toursOnDay(d).some(t => !t.guide_id && !t.driver_id));
    h += `<div class="gridwrap only-wide"><div class="wgrid"><div class="hd">${T('team')}</div>${hd}
      ${un && !state.mine ? rowFor(T('unassigned'), '', null, t => !t.guide_id && !t.driver_id) : ''}
      ${people.map(p => rowFor(p.name, T('role_' + p.role), p.id, t => involves(t, p.id))).join('')}</div></div>`;
    // phone: day strip + agenda
    const sel = state.date;
    const mineDay = d => toursOnDay(d).some(t => involves(t, me().id));
    h += `<div class="only-phone list"><div class="strip">${days.map(d => `<button data-act="day" data-date="${d}" data-drop="${d}" aria-pressed="${d === sel}" class="${d === td ? 'tdy' : ''} ${offCls(offOn(me().id, d))} ${holidayOn(d) ? 'hol' : ''}"><span>${esc(fmt(d, { weekday: 'short' }))}</span><b class="num">${D(d).getDate()}</b><span class="dot ${mineDay(d) ? '' : 'none'}"></span>${offMark(d)}</button>`).join('')}</div>`;
    for (const d of days) h += dayBlock(d);
    h += `</div>`;
    return h + pstats;
  }
  function monthHtml() {
    const first = state.date.slice(0, 8) + '01', start = monday(first), td = today(), mo = state.date.slice(0, 7), sel = state.date, my = me().id;
    const wd = [...Array(7)].map((_, i) => `<div class="hd">${esc(fmt(addDays('2024-01-01', i), { weekday: 'short' }))}</div>`).join('');
    let cells = '';
    for (let i = 0; i < 42; i++) {
      const d = addDays(start, i); if (i % 7 === 0 && i >= 28 && d.slice(0, 7) !== mo) break;
      const all = toursOnDay(d), ts = state.mine ? all.filter(t => involves(t, my)) : all, myOff = offOn(my, d), ho = holidayOn(d);
      cells += `<button class="${d.slice(0, 7) !== mo ? 'out' : ''} ${d === td ? 'today' : ''} ${d === sel ? 'sel' : ''} ${offCls(myOff)} ${ho ? 'hol' : ''} ${pubHolOn(d) ? 'pub' : ''}" title="${esc(pubHolOn(d) ? T(pubHolOn(d)) : '')}" data-act="pickday" data-date="${d}" data-drop="${d}" aria-pressed="${d === sel}" aria-label="${esc(fmtDay(d))}: ${ts.length} ${T('tours_n')}"><b class="num">${D(d).getDate()}</b><span class="dots">${ts.slice(0, 4).map(t => `<i style="background:${esc(tourStyle(t.title).color)}"></i>`).join('')}${ts.length > 4 ? `<span class="num">+${ts.length - 4}</span>` : ''}</span><span class="mrows">${ts.slice().sort((x, y) => (x.start_time || '').localeCompare(y.start_time || '')).slice(0, 4).map(t => `<span class="mrow${live(t) ? '' : ' cx'}" data-act="tour" data-id="${t.id}"><i style="background:${esc((person(t.guide_id) || {}).color || tourStyle(t.title).color)}"></i><span class="num">${esc(t.start_time || '')}</span> ${esc(t.title)} <span class="num muted">${paxText(t)}</span></span>`).join('')}${ts.length > 4 ? `<span class="mrow more">${T('more_n', { n: ts.length - 4 })}</span>` : ''}</span>${offMark(d)}</button>`;
    }
    const legend = `<div class="row small muted lgrow"><span class="lg"><i class="dotk"></i>${T('lg_tour')}</span><span class="lg"><i class="sq myoff"></i>${T('lg_myoff')}</span><span class="lg"><i class="sq myoff mysick"></i>${T('sick')}</span><span class="lg"><i class="sq hol"></i>${T('holidays')}</span><span class="lg"><i class="sq pub"></i>${T('ph_legend')}</span></div>`;
    return `<div class="mgrid">${wd}${cells}</div>${legend}<div class="list">${dayBlock(sel)}</div>`;
  }

  // ---------- tour modal ----------
  function openTour(id, preset) {
    const t = id ? db.tours.find(x => x.id === id) : null;
    const d = t ? { ...t } : { id: S.uid(), date: state.date, date_to: null, start_time: '10:00', end_time: '14:00', title: '', kind: 'private', capacity: 0, pax: 1, adults: 1, children: 0, language: 'EN', pickup: '', pickup_url: null, notes: '', status: 'confirmed', guide_id: null, driver_id: null, guide_pay: null, driver_pay: null, external_id: null, ...(preset || {}) };
    d.bookings = t ? tourBookings(t.id).map(b => ({ ...b, marks: [...(b.marks || [])] })) : [];
    state.modal = { type: 'tour', isNew: !t, draft: d, edit: isAdmin() && !t };
    renderModal();
    const ids = [...new Set(d.bookings.map(b => b.client_id).filter(Boolean))].filter(c => !(state.visits || {})[c]);
    if (t && ids.length) S.guestVisits(ids, me().id, t.date).then(rows => { state.visits = state.visits || {}; ids.forEach(c => { state.visits[c] = { total: 0, mine: 0 }; }); rows.forEach(r => { state.visits[r.client_id] = r; }); if (rows.length && state.modal && state.modal.type === 'tour' && !state.modal.edit) renderModal(); }).catch(() => {});
  }
  function summaryHtml(m) {
    const d = m.date, ts = toursOnDay(d).filter(t => isAdmin() || involves(t, me().id)).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
    const all = [fmt(d, { weekday: 'long', day: 'numeric', month: 'long' }), ...ts.map(tourText)].join('\n\n');
    const ppl = isAdmin() ? crew().filter(p => ts.some(t => involves(t, p.id))) : [];
    return `<div class="hdr"><h2>${T('day_summary')}: ${esc(fmtDay(d))}</h2><button class="iconbtn" data-act="close" aria-label="${T('close')}">✕</button></div>
      ${ts.length ? `<pre class="pre">${esc(all)}</pre><div class="actions"><button class="btn" data-act="copy" data-v="${esc(all)}">${T('copy')}</button><a class="btn primary" href="${esc(waLink('', all))}" target="_blank" rel="noopener">WhatsApp</a></div>
      ${ppl.length ? `<b>${T('send_each')}</b><div class="list">${ppl.map(p => { const tx = [fmt(d, { weekday: 'long', day: 'numeric', month: 'long' }), ...ts.filter(t => involves(t, p.id)).map(tourText)].join('\n\n'); return `<div class="row">${avatar(p.id)}<span style="flex:1">${esc(p.name)}</span><button class="btn sm" data-act="copy" data-v="${esc(tx)}">${T('copy')}</button>${p.phone ? `<a class="btn sm" href="${esc(waLink(p.phone, tx))}" target="_blank" rel="noopener">WhatsApp</a>` : ''}</div>`; }).join('')}</div>` : ''}` : `<div class="empty">${T('no_tours')}</div>`}`;
  }
  function guestSheetHtml(m) {
    const b = db.bookings.find(x => x.id === m.id); if (!b) return `<div class="hdr"><h2>—</h2><button class="iconbtn" data-act="close">✕</button></div>`;
    const t = db.tours.find(x => x.id === b.tour_id) || {}, cl = db.clients.find(c => c.id === b.client_id) || {}, rl = reviewLink(b), msg = T('review_msg') + ' ' + rl;
    const can = (involves(t, me().id) || isAdmin()) && t.date <= today() && live(t);
    const row = (icon, label, attrs) => `<${attrs.href ? 'a' : 'button'} class="arow" ${Object.entries(attrs).map(([k, v]) => `${k}="${esc(v)}"`).join(' ')}>${icon ? ico(icon) : '<span style="width:16px"></span>'}<span>${esc(label)}</span></${attrs.href ? 'a' : 'button'}>`;
    return `<div class="hdr"><span class="avatar big ini">${esc(initials(cleanName(b.guest) || b.guest))}</span><h2>${esc(b.guest)}</h2><button class="iconbtn" data-act="close" aria-label="${T('close')}">✕</button></div>
      <div class="muted small">${esc([acText(b), phoneFlag(b.phone), b.lang && T('guest_lang') + ' ' + b.lang, sourceOf(b), b.ref, b.notes].filter(Boolean).join(' · '))}</div>${isVip(b.client_id) ? (v => `<div class="banner small">${vipTag(b.client_id)}<span>${T('vip_text', { n: v.total, y: v.years || 1, a: v.addons || 0 })}</span></div>`)(guestStats(b.client_id)) : ''}${isFree(b) ? `<div class="banner small">${freeTag(b)}<span>${T('free_text')}</span>${tipUrl(t) ? `<button class="btn sm" data-act="tipqr" data-id="${t.id}">${T('tip_btn')}</button>` : ''}</div>` : ''}
      ${isAdmin() && Number(b.price) ? `<div class="small num">${T('bk_price')}: <b>${esc(b.price)} ${esc(b.currency || guestCur())}</b>${commOf(b) ? ` · ${T('net_after', { src: srcName(sourceOf(b) || b.source), p: commOf(b), v: Math.round(netOf(b) * 100) / 100, c: b.currency || guestCur() })}` : ''}</div>` : ''}
      ${!can && live(t) && t.date > today() && (involves(t, me().id) || isAdmin()) ? `<div class="muted small">${T('att_later', { date: fmtDay(t.date) })}</div>` : ''}
      ${can ? `<div class="att"><button class="${b.attendance === 'arrived' ? 'on ok' : ''}" data-act="attend" data-id="${b.id}" data-s="arrived" aria-pressed="${b.attendance === 'arrived'}">${T('att_arrived')}</button><button class="${b.attendance === 'noshow' ? 'on no' : ''}" data-act="attend" data-id="${b.id}" data-s="noshow" aria-pressed="${b.attendance === 'noshow'}">${T('att_noshow')}</button></div>` : ''}
      <div class="alist">${b.client_id ? row('', T('open_client') + ' ›', { 'data-act': 'client', 'data-id': b.client_id }) : ''}
        ${reviewPlaces(b).map(([name, url]) => { const tx = T('review_msg') + ' ' + url; return (b.phone ? row('wa', T('review_wa_on', { place: name }), { href: waLink(b.phone, tx), target: '_blank', rel: 'noopener' }) : '') + row('copy', T('review_copy_on', { place: name }), { 'data-act': 'copy', 'data-v': tx }); }).join('')}
        ${b.pickup_addr ? row('pin', T('guest_addr') + ': ' + b.pickup_addr, { href: mapFor(b.pickup_addr, b.pickup_url), target: '_blank', rel: 'noopener' }) : ''}
        ${b.phone ? row('wa', 'WhatsApp ' + b.phone, { href: waLink(b.phone), target: '_blank', rel: 'noopener' }) + row('call', T('call') + ' ' + b.phone, { href: 'tel:' + b.phone }) + row('copy', T('copy') + ' ' + b.phone, { 'data-act': 'copy', 'data-v': b.phone }) : ''}
        ${(b.email || cl.email) ? row('mail', b.email || cl.email, { href: 'mailto:' + (b.email || cl.email) }) : ''}
        ${canOffer() ? row('', T('offer_title') + ' ›', { 'data-act': 'offer', 'data-b': b.id }) : ''}</div>${historyHtml(b)}`;
  }
  const canOffer = () => me().role !== 'driver';
  function offerList() {
    const td = today(), days = [addDays(td, 1), addDays(td, 2)], out = [];
    for (const d of days) for (const t of toursOnDay(d)) { if (t.kind !== 'group' || t.date !== d) continue; const free = t.capacity > 0 ? t.capacity - (t.pax || 0) : null; if (free === null || free > 0) out.push({ t, free }); }
    return out.sort((x, y) => (x.t.date + (x.t.start_time || '')).localeCompare(y.t.date + (y.t.start_time || '')));
  }
  // The website page for a tour: exact name, then the name it was joined to, then the most similar catalogue name (same private/group kind).
  const catFor = title => { const c = catFind(title) || catFind(aliasOf(title)); if (c) return c; let best = null, bs = 0; catalog().forEach(x => { const sc = tnScore(x.title, aliasOf(title)); if (sc > bs) { bs = sc; best = x; } }); return bs >= 0.5 ? best : null; };
  const myPromo = () => (rules().promos || {})[me().id] || rules().offerPromo || '';
  // Our own website links get campaign tags (no names: the promo code or "team"), so GA4 on friendly.ge shows visits and bookings that came from the app.
  function gaUrl(url, medium, content) {
    try { const u = new URL(url); if (!/(^|\.)friendly\.ge$/i.test(u.hostname) || u.searchParams.has('utm_source')) return url; u.searchParams.set('utm_source', 'friendly_schedule'); u.searchParams.set('utm_medium', medium); u.searchParams.set('utm_campaign', (myPromo() || 'team').toLowerCase().replace(/[^a-z0-9_-]/g, '')); if (content) u.searchParams.set('utm_content', String(content).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)); return u.toString(); } catch (e) { return url; }
  }
  function offerText(t, free) {
    const c = catFor(t.title) || {}, r = rules(), url = gaUrl(c.url || r.siteUrl || 'https://friendly.ge/en/', 'guide_offer', aliasOf(t.title)), promo = myPromo();
    const when = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(D(t.date));
    return `If you would like to see more of Georgia with us: ${t.title}, ${when}${t.start_time ? ' at ' + t.start_time : ''}${free ? ` (${free} ${free === 1 ? 'place' : 'places'} left)` : ''}. You can book here: ${url}${promo ? ` Promo code ${promo}.` : ''}`;
  }
  function offerModalHtml(m) {
    const b = m.bid ? db.bookings.find(x => x.id === m.bid) : null, list = offerList();
    return `<div class="hdr"><h2>${T('offer_title')}</h2><button class="iconbtn" data-act="close" aria-label="${T('close')}">✕</button></div><p class="muted small">${b ? T('offer_for', { name: b.guest }) : T('offer_text')}</p>
      <div class="list">${list.map(({ t, free }) => { const tx = offerText(t, free); return `<div class="acard" style="--k:${esc(tourStyle(t.title).color)}"><span class="ttl">${esc(t.title)}</span><span class="num">${esc(t.date === addDays(today(), 1) ? T('tomorrow') : fmtDay(t.date))} · ${esc(t.start_time || '')}${free !== null ? ' · ' + T('seats_left', { n: free }) : ''}</span><span class="row">${b && b.phone ? `<a class="btn sm primary" data-act2="offersend" data-tour="${t.id}" data-b="${b.id}" href="${esc(waLink(b.phone, tx))}" target="_blank" rel="noopener">${ico('wa')}${T('offer_send')}</a>` : `<a class="btn sm primary" data-act2="offersend" data-tour="${t.id}" data-b="" href="${esc(waLink('', tx))}" target="_blank" rel="noopener">${ico('wa')}WhatsApp</a>`}<button class="btn sm" data-act="offercopy" data-tour="${t.id}" data-b="${b ? b.id : ''}" data-v="${esc(tx)}">${ico('copy')}${T('copy')}</button></span></div>`; }).join('') || `<div class="empty">${T('offer_none')}</div>`}</div>`;
  }
  function logOffer(tourId, bid) { track('offersend'); S.save('offers', { id: S.uid(), user_id: me().id, tour_id: tourId, booking_id: bid || null, at: new Date().toISOString() }).catch(() => {}); }
  function scoreHtml(d) {
    const mine = involves(d, me().id), past = d.date <= today(), rs = db.tour_ratings.filter(r => r.tour_id === d.id);
    if (!past || (!mine && !(isAdmin() && rs.length))) return '';
    const my = myScore(d.id, me().id), avg = rs.length ? Math.round(rs.reduce((a, r) => a + r.score, 0) / rs.length * 10) / 10 : null;
    return `<div class="card">${mine ? `<b>${T('score_title')}</b><div class="scores">${[...Array(11)].map((_, i) => `<button class="${my && my.score === i ? 'on' : ''}" data-act="score" data-id="${d.id}" data-s="${i}" aria-pressed="${!!(my && my.score === i)}">${i}</button>`).join('')}</div>` : ''}${isAdmin() && avg !== null ? `<div class="muted small">${T('score_avg')}: <b class="num">${avg}</b> (${rs.length})</div>` : ''}</div>`;
  }
  const ratingTag = cid => { const r = cid && clientRating(cid); return r ? `<span class="tag ${RATINGS[r.rating] || 't-muted'}">${T('rate_' + r.rating)}</span>` : ''; };
  function tourModalHtml(m) {
    const d = m.draft;
    if (!m.edit) {
      const w = tourWarnings(d), tasks = db.tasks.filter(x => x.tour_id === d.id), mine = involves(d, me().id);
      const canCheck = (mine || isAdmin()) && d.date <= today() && live(d);
      const myPay = mine ? payFor(d, d.guide_id === me().id ? 'guide' : 'driver') : 0, cur = rules().currency || 'GEL';
      const cn = catFind(d.title) || {}, warnHtml = w.map(x => `<div class="warnline ${x.lv === 'warn' ? 'soft' : ''}">! ${esc(x.tx)}</div>`).join('');
      const reqs = db.change_requests.filter(q => q.tour_id === d.id && q.status === 'pending' && (isAdmin() || q.user_id === me().id)).map(q => `<div class="warnline soft">${T('creq_pending')}: ${esc(creqText(q))}</div>`).join('');
      return `<div class="hdr">${emblem(d, true)}<h2>${esc(d.title)}</h2><button class="iconbtn" data-act="close" aria-label="${T('close')}">✕</button></div>
        <div class="when"><b>${esc(dateText(d))}</b><b class="num">${esc(d.start_time || '')}${d.end_time ? '–' + esc(d.end_time) : ''}</b>${d.status === 'cancelled' ? `<span class="tag t-danger">${T('cancelled')}</span>` : ''}</div>
        ${wxLine(d, true)}
        ${d.status === 'cancelled' && d.cancel_reason ? `<div class="warnline">${T('cancel_info', { reason: d.cancel_reason })}</div>` : ''}
        ${d.pickup ? `<div class="meet">${ico('pin')}<span class="grow-l">${esc(d.pickup)}</span><a class="btn sm" href="${esc(tourMap(d))}" target="_blank" rel="noopener" aria-label="${T('open_map')}">${T('map')}</a></div>` : ''}
        ${d.notes ? `<div class="small"><span class="muted">${T('notes')}:</span> ${esc(d.notes)}</div>` : ''}
        ${d.bookings.length ? `<div class="tsum num"><div>${esc(acText(d))}${d.bookings.some(isFree) ? ' · ' + T('free_n', { n: d.bookings.filter(isFree).reduce((n, b) => n + (Number(b.pax) || 1), 0) }) : ''}</div>${staysN(d.bookings) ? `<div>${T('stay_line', { n: staysN(d.bookings), back: Math.max(0, (d.pax || 0) - staysN(d.bookings)) })}</div>` : ''}${cashDue(d.bookings) ? `<div class="due">${T('cash_collect')}: ${esc(cashText(d.bookings))}</div>` : ''}</div>` : ''}
        ${isAdmin() ? warnHtml : ''}${isAdmin() && live(d) && (d.pax || 0) > (rules().carSeats || 6) && kmOf(d.title) > 0 ? `<div><button class="btn sm" data-act="car2" data-id="${d.id}">${ico('car')}${T('car2_btn')}</button></div>` : ''}${isAdmin() && costOf(d.id).total ? `<div class="muted small num">${T('cost_title')}: <b>${nf(costOf(d.id).total)} ${esc(rules().currency || 'GEL')}</b></div>` : ''}
        <div class="glist crew">${[['guide', d.guide_id], ['driver', d.driver_id]].filter(x => x[1]).map(([r, id]) => `<div class="grow" style="--k:${esc((person(id) || {}).color || '#66737f')}"><span class="row nw">${avatar(id)}<span class="grow-l" style="flex-direction:column;align-items:flex-start;gap:0"><b>${esc(pname(id))}</b><span class="muted small">${esc([T('role_' + r), ...titlesOf(id).slice(0, 1)].join(' · '))}</span></span>${staffBtns(person(id))}</span></div>`).join('') || `<div class="grow"><span class="tag t-warn">${T('unassigned')}</span></div>`}</div>
        <h3>${T('guests_title')} (${d.bookings.length})</h3>${canCheck && d.bookings.some(b => b.attendance) ? `<div class="muted small num">${T('att_sum', { a: d.bookings.filter(b => b.attendance === 'arrived').length, n: d.bookings.length, x: d.bookings.filter(b => b.attendance === 'noshow').length })}</div>` : ''}
        ${d.bookings.length ? `<div class="glist">${d.bookings.map(b => guestRow(b, d.bookings.some(x => x.pickup_addr))).join('')}</div>` : guestsHidden(d) ? `<div class="empty">${T('pv_hidden', { n: pv().guideDays })}</div>` : `<div class="empty">${T('no_guests')}${isAdmin() ? ` <button class="btn sm" data-act="touredit">${T('add_guests')}</button>` : ''}</div>`}
        ${mine && d.date <= today() && live(d) ? `<button class="btn exptour" data-act="expnew" data-tour="${d.id}" data-date="${d.date}">${msi('receipt_long')} ${T('ex_tour')}</button>` : ''}
        <details class="sect"><summary>${T('more')}</summary><div class="f">
          <div class="bar"><button class="btn sm" data-act="share" data-title="${esc(d.title)}" data-v="${esc(tourText(d))}">${ico('share')}${T('share')}</button><a class="btn sm" href="${esc(gcalLink(d))}" target="_blank" rel="noopener">${ico('cal')}${T('cal_short')}</a><button class="btn sm" data-act="copy" data-v="${esc(tourText(d))}">${ico('copy')}${T('copy')}</button>${tipUrl(d) && (mine || isAdmin()) ? `<button class="btn sm" data-act="tipqr" data-id="${d.id}">${T('tip_btn')}</button>` : ''}</div>
          <div class="muted small num">${esc([T('kind_' + d.kind), paxText(d), d.language, cn.duration, cn.note, endOf(d) !== d.date ? T('multiday', { n: tourDays(d).length }) : ''].filter(Boolean).join(' · '))}</div>
          ${mine && !isAdmin() ? `<div class="row small"><span class="muted">${T('my_pay')}: <b class="num">${myPay} ${esc(cur)}</b></span>${disputeTag(disputeOf(d.id, me().id))}<button class="lnk" data-act="dispute" data-id="${d.id}">${T('dp_btn')}</button></div>` : (mine && myPay ? `<div class="muted small">${T('my_pay')}: <b class="num">${myPay} ${esc(cur)}</b></div>` : '')}${isAdmin() ? `<div class="muted small num">${T('a_pay')}: ${payFor(d, 'guide')} + ${payFor(d, 'driver')} ${esc(cur)}</div>` : ''}
          ${isAdmin() ? '' : warnHtml}${reqs}
          ${scoreHtml(d)}
          ${tasks.length ? `<div class="list"><b>${T('tasks')}</b>${tasks.map(taskCard).join('')}</div>` : ''}
          <div class="actions">${canOffer() ? `<button class="btn" data-act="offer">${T('offer_title')}</button>` : ''}${isAdmin() ? `<button class="btn" data-act="tasknew" data-tour="${d.id}">+ ${T('task_for_tour')}</button>` : (mine && endOf(d) >= today() && live(d) ? `<button class="btn" data-act="creq" data-id="${d.id}">${T('suggest_change')}</button><button class="btn danger" data-act="cancelask" data-id="${d.id}">${T('report_cancel')}</button>` : '')}</div></div></details>
        ${isAdmin() ? `<div class="tacts">
          <button class="btn primary" data-act="touredit">${msi('edit')}${T('edit')}</button>
          ${live(d) ? `<button class="btn" data-act="move" data-id="${d.id}">${msi('swap_horiz')}${T('mv_btn')}</button>` : ''}
          <button class="btn" data-act="tourclone" data-id="${d.id}">${msi('content_copy')}${T('clone')}</button>
          ${live(d) ? `<button class="btn danger" data-act="cancelask" data-id="${d.id}">${msi('event_busy')}${T('cancel_tour')}</button>` : `<button class="btn" data-act="tourrestore" data-id="${d.id}">${msi('event_available')}${T('restore')}</button>`}
          <button class="btn danger" data-act="tourdelask" data-id="${d.id}">${msi('delete')}${T('del_tour')}</button></div>` : ''}`;
    }
    const titles = [...new Set([...catalog().map(c => c.title), ...db.tours.map(t => t.title)])].sort(), marks = allMarks(), r = rules().pay || {};
    return `<div class="hdr"><h2>${T(m.isNew ? 'new_tour' : 'edit_tour')}</h2><button class="iconbtn" data-act="close" aria-label="${T('close')}">✕</button></div>
      <form class="f" data-form="tour">
      <label>${T('title')}<input id="t-title" data-f="title" data-ch="cattitle" value="${esc(d.title)}" list="titles" required placeholder="${T('title_hint')}"><datalist id="titles">${titles.map(x => `<option value="${esc(x)}">`).join('')}</datalist></label>
      <div class="two"><label>${T('date')}<input id="t-date" data-f="date" type="date" value="${esc(d.date)}" required></label>
        <label>${T('start')}<input id="t-start" data-f="start_time" type="time" value="${esc(d.start_time || '')}"></label></div>
      <div class="two"><label>${T('duration_h')}<input id="t-dur" data-f="dur" type="number" min="0" max="24" step="0.25" inputmode="decimal" value="${esc(durOf(d))}"></label>
        <div class="endtxt"><span class="muted small">${T('end')}</span><b class="num" id="t-endtxt">${esc(d.end_time || '—')}</b></div></div>
      <div class="two"><label>${T('guide')}<select id="t-guide" data-f="guide_id">${peopleOpts('guide', d.guide_id)}</select></label>
        <label>${T('driver')}<select id="t-driver" data-f="driver_id">${peopleOpts('driver', d.driver_id)}</select></label></div>
      <div id="fitbox">${fitHtml(d)}</div>
      <details class="sect"><summary>${T('more_options')}</summary><div class="f">
      <div class="three"><label>${T('type')}<select id="t-kind" data-f="kind">${KINDS.map(k => opt(k, T('kind_' + k), d.kind)).join('')}</select></label>
        <label>${T('lang_tour')}<input id="t-lang" data-f="language" value="${esc(d.language || '')}"></label>
        <label>${T('capacity')}<input id="t-cap" data-f="capacity" type="number" min="0" value="${esc(d.capacity || 0)}"></label></div>
      <label>${T('date_to')}<input id="t-dateto" data-f="date_to" type="date" value="${esc(d.date_to || '')}"></label>
      <div class="two"><label>${T('guide_pay')}<input id="t-gpay" data-f="guide_pay" type="number" min="0" step="any" value="${esc(d.guide_pay ?? '')}" placeholder="${esc(r['guide_' + d.kind] || 0)}"></label>
        <label>${T('driver_pay')}<input id="t-dpay" data-f="driver_pay" type="number" min="0" step="any" value="${esc(d.driver_pay ?? '')}" placeholder="${esc(r['driver_' + d.kind] || 0)}"></label></div>
      <label>${T('pickup')}<input id="t-pickup" data-f="pickup" list="fs-addrs" value="${esc(d.pickup || '')}" placeholder="${T('addr_hint')}" autocomplete="off"></label><label>${T('map_link')}<input id="t-pickurl" data-f="pickup_url" type="url" value="${esc(d.pickup_url || '')}" placeholder="https://maps.app.goo.gl/..."></label>
      <label>${T('notes')}<textarea id="t-notes" data-f="notes">${esc(d.notes || '')}</textarea></label></div></details>
      <details class="sect"><summary>${T('cost_title')}${costOf(d.id).total ? ` · ${nf(costOf(d.id).total)} ${esc(rules().currency || 'GEL')}` : ''}</summary><div class="f"><span class="muted small">${T('cost_text')}</span><div class="two">${COSTS.map(k => `<label>${T('cost_' + k)}<input type="number" min="0" step="any" inputmode="decimal" data-cost="${k}" value="${esc((d.costs || costOf(d.id).items)[k] ?? '')}"></label>`).join('')}</div><label>${T('cost_note')}<input data-cost="note" value="${esc(d.costNote ?? costOf(d.id).note)}"></label></div></details>
      <div class="f"><b>${T('guest_list')}</b>
        ${d.bookings.map((b, i) => `<div class="card gcard"><div class="row"><input class="inp" style="flex:1" aria-label="${T('guest')}" placeholder="${T('guest_ph')}" data-bi="${i}" data-bf="guest" value="${esc(b.guest || '')}" autocomplete="off"><button type="button" class="iconbtn" data-act="bdel" data-i="${i}" aria-label="${T('remove')}">✕</button></div>
          ${needsLatin(b.guest) ? `<span class="warnline soft small">! ${T('latin_hint')}</span>` : ''}<div class="gsug" id="gsug-${i}">${suggHtml(b, i)}</div>
          <div class="four"><label>${T('adults')}<input type="number" min="0" data-bi="${i}" data-bf="adults" value="${esc(b.adults ?? 1)}"></label><label>${T('children')}<input type="number" min="0" data-bi="${i}" data-bf="children" value="${esc(b.children ?? 0)}"></label><label>${T('ref')}<input data-bi="${i}" data-bf="ref" value="${esc(b.ref || '')}" autocomplete="off"></label><label>${T('guest_lang')}<select data-bi="${i}" data-bf="lang"><option value="">—</option>${[...new Set([...GUEST_LANGS, ...(b.lang ? [String(b.lang).toUpperCase()] : [])])].map(x => `<option value="${x}" ${String(b.lang || '').toUpperCase() === x ? 'selected' : ''}>${esc(langName(x))}</option>`).join('')}</select></label></div>
          <div class="two"><label><span>${T('phone')} <span class="pflag" id="pflag-${i}">${esc(phoneFlag(normPhone(b.phone)))}</span></span><input type="tel" inputmode="tel" data-bi="${i}" data-bf="phone" value="${esc(b.phone || '')}" placeholder="+995 5…" autocomplete="off"></label><label>${T('email')}<input type="email" inputmode="email" data-bi="${i}" data-bf="email" value="${esc(b.email || '')}" autocomplete="off"></label></div>
          <div class="four five"><label>${T('payment')}<select data-bi="${i}" data-bf="payment">${opt('', '—', b.payment)}${['prepaid', 'cash', 'unpaid'].map(x => opt(x, T('pay_' + x), b.payment)).join('')}</select></label><label>${T('bk_price')}<input type="number" min="0" step="any" inputmode="decimal" data-bi="${i}" data-bf="price" value="${esc(b.price ?? '')}"></label><label>${T('amount_due')}<input type="number" min="0" step="any" inputmode="decimal" data-bi="${i}" data-bf="amount_due" value="${esc(b.amount_due ?? '')}"></label><label>${T('currency')}<select data-bi="${i}" data-bf="currency">${[...new Set([...CURRENCIES, ...(b.currency ? [b.currency] : [])])].map(x => opt(x, x, b.currency || guestCur())).join('')}</select></label><label>${T('source')}<select data-bi="${i}" data-bf="source">${opt('', sourceOf({ ref: b.ref }) ? T('auto') + ': ' + sourceOf({ ref: b.ref }) : '—', b.source)}${SOURCES.map(x => opt(x, x, b.source)).join('')}</select></label></div>
          <div class="f"><span class="muted small">${T('options')}</span>${optPicker(b, i, marks)}</div>
          ${needsAddr(b) ? `<label>${T('guest_addr')}<input data-bi="${i}" data-bf="pickup_addr" list="fs-addrs" value="${esc(b.pickup_addr || '')}" placeholder="${T('addr_hint')}" autocomplete="off"></label><span class="muted small">${T('addr_auto')}</span>` : ''}
          <input class="inp" aria-label="${T('note')}" placeholder="${T('other_marks')}" data-bi="${i}" data-bf="notes" value="${esc(b.notes || '')}"></div>`).join('')}
        <datalist id="fs-addrs">${knownAddrs().map(x => `<option value="${esc(x)}">`).join('')}</datalist>
        <div class="bar"><button type="button" class="btn sm" data-act="badd">+ ${T('guest')}</button></div>
        ${d.bookings.length ? '' : `<div class="two"><label>${T('adults')}<input id="t-adults" data-f="adults" type="number" min="0" value="${esc(d.adults ?? d.pax ?? 0)}"></label><label>${T('children')}<input id="t-children" data-f="children" type="number" min="0" value="${esc(d.children ?? 0)}"></label></div>`}</div>
      <div id="t-warn"></div>
      <div class="actions"><button type="button" class="btn" data-act="close">${T('close')}</button><button class="btn primary">${T('save')}</button></div></form>`;
  }
  // Who fits this tour: free that day, knows the tour, speaks the language, not overworked this week.
  // Work days of everyone in a month and the average per role (guides, drivers), for fair suggestions.
  function monthDays(mo) {
    const k = 'md' + mo; if (memo[k]) return memo[k]; const from = mo + '-01', to = monthEnd(mo), days = {}, sets = {};
    db.tours.forEach(t => { if (!live(t) || endOf(t) < from || t.date > to) return; [t.guide_id, t.driver_id].filter(Boolean).forEach(id => { const st = sets[id] = sets[id] || new Set(); tourDays(t).forEach(x => { if (x >= from && x <= to) st.add(x); }); }); });
    Object.keys(sets).forEach(id => { days[id] = sets[id].size; }); const avg = {};
    ['guide', 'driver'].forEach(r => { const ps = staff().filter(p => (r === 'driver' ? p.role === 'driver' : p.role === 'guide')); if (ps.length) avg[r] = ps.reduce((n, p) => n + (days[p.id] || 0), 0) / ps.length; });
    return memo[k] = { days, avg };
  }
  function fitList(d, role) {
    if (!d.date || !d.title) return [];
    const cat = catFind(d.title), lng = String(d.language || '').toUpperCase().slice(0, 2), wk = monday(d.date), wkEnd = addDays(wk, 6), wdx = (D(d.date).getDay() + 6) % 7;
    return staff().filter(p => p.role === role || (role === 'driver' && p.role === 'guide' && p.vehicle)).map(p => {
      const why = [], warn = []; let sc = 0;
      if (offOn(p.id, d.date)) return null;
      const clash = db.tours.some(t => t.id !== d.id && live(t) && involves(t, p.id) && t.date <= (d.date_to || d.date) && endOf(t) >= d.date && (!t.start_time || !d.start_time || !t.end_time || !d.end_time || (t.start_time < d.end_time && d.start_time < t.end_time)));
      if (clash) return null;
      const done = db.tours.filter(t => live(t) && involves(t, p.id) && t.title === d.title && t.date < today()).length; if (done) { sc += Math.min(done, 20) / 2; why.push(T('fit_done', { n: done })); }
      if (role === 'guide' && cat && (p.skills || []).length) { if ((p.skills || []).includes(String(cat.id))) { sc += 3; why.push(T('fit_skill')); } else { sc -= 4; warn.push(T('fit_noskill')); } }
      if (role === 'guide' && lng && lng !== 'EN') { if (String(p.languages || '').toUpperCase().includes(lng)) { sc += 4; why.push(lng); } else { sc -= 6; warn.push(T('fit_nolang', { l: lng })); } } else if (role === 'guide' && lng && String(p.languages || '').toUpperCase().includes(lng)) why.push(lng);
      const av = availOf(p, d.date), w = weekOf(p, d.date); if (w && w.length === 7 && !w[wdx]) { sc -= av ? 8 : 3; warn.push(T(av ? 'fit_notfree' : 'fit_notday')); } else if (av) { sc += 1; why.push(T('fit_free')); }
      const load = db.tours.filter(t => live(t) && involves(t, p.id) && t.date >= wk && t.date <= wkEnd && t.id !== d.id).length; sc -= load * 0.7; why.push(T('fit_week', { n: load }));
      const mo = d.date.slice(0, 7), bal = monthDays(mo); if (bal.avg[role] !== undefined) { const md = bal.days[p.id] || 0; sc -= (md - bal.avg[role]) * 0.4; why.push(T('fit_month', { n: md, avg: Math.round(bal.avg[role]) })); }
      if (role === 'driver' && /4x4|kazbegi|gareji|tusheti|truso|juta|khevsureti/i.test(d.title) && p.vehicle === 'delica') { sc += 3; why.push('Delica'); }
      return { p, sc, why, warn };
    }).filter(Boolean).sort((x, y) => y.sc - x.sc).slice(0, 3);
  }
  function fitHtml(d) {
    const g = d.guide_id ? [] : fitList(d, 'guide'), dr = d.driver_id ? [] : fitList(d, 'driver'); if (!g.length && !dr.length) return '';
    const chip = (x, f) => `<button type="button" class="sgrow" data-act="fitpick" data-f="${f}" data-id="${x.p.id}">${avatar(x.p.id)}<span class="grow-l"><b>${esc(x.p.name)}</b><span class="muted small">${esc(x.why.join(' · '))}${x.warn.length ? ' · ' : ''}<span class="warnt">${esc(x.warn.join(' · '))}</span></span></span><span class="btn sm">${T('use')}</span></button>`;
    return `<details class="sect" open><summary>${T('fit_title')}</summary><div class="f">${g.length ? `<span class="muted small">${T('guide')}</span>${g.map(x => chip(x, 'guide_id')).join('')}` : ''}${dr.length ? `<span class="muted small">${T('driver')}</span>${dr.map(x => chip(x, 'driver_id')).join('')}` : ''}<span class="muted small">${T('fit_how')}</span></div></details>`;
  }
  const draftCounts = d => { const src = d.bookings.length ? d.bookings : [d]; const a = src.reduce((x, b) => x + (Number(b.adults) || 0), 0), c = src.reduce((x, b) => x + (Number(b.children) || 0), 0); return { adults: a, children: c, pax: a + c }; };
  function refreshTourWarn() {
    const m = state.modal, el = $('#t-warn'); if (!m || m.type !== 'tour' || !el) return;
    const d = { ...m.draft, ...draftCounts(m.draft), capacity: Number(m.draft.capacity) || 0 };
    el.innerHTML = tourWarnings(d).map(x => `<div class="warnline ${x.lv === 'warn' ? 'soft' : ''}">! ${esc(x.tx)}</div>`).join('');
  }
  // ---------- guests already in the base ----------
  // A name only in Chinese, Korean, Arabic and similar letters: guides and drivers also need it in Latin letters.
  const needsLatin = n => !!n && /[^\u0000-\u024f\u0400-\u04ff\u10a0-\u10ff\s\d.,()'\-+x×]/.test(n) && !/[A-Za-z]{2,}/.test(n.replace(/\bx\s*\d+/i, ''));
  // Options as one drop-down: shows what is chosen, opens a searchable tick list.
  const optSummary = b => { const ms = b.marks || []; return ms.length ? ms.map(markLabel).join(', ') : T('ms_none'); };
  function optPicker(b, i, marks) {
    return `<details class="msel" data-msel="${i}"><summary><span class="mstxt" id="ms-${i}">${esc(optSummary(b))}</span><span class="mscount">${(b.marks || []).length || ''}</span></summary>
      <div class="mspanel">${marks.length > 6 ? `<input class="inp" type="search" placeholder="${T('search')}" data-msq="${i}" aria-label="${T('search')}">` : ''}<div class="mslist">${marks.map(mk => `<label data-mk="${esc(markLabel(mk).toLowerCase())}"><input type="checkbox" data-bi="${i}" data-bm="${esc(mk)}" ${(b.marks || []).includes(mk) ? 'checked' : ''}><span>${esc(markLabel(mk))}</span></label>`).join('')}</div>
      <div class="bar"><button type="button" class="lnk" data-act="msclear" data-i="${i}">${T('ms_clear')}</button><span class="spacer"></span><button type="button" class="btn sm primary" data-act="msdone">${T('ms_done')}</button></div></div></details>`;
  }
  function guestMatches(b) {
    const ph = digits(normPhone(b.phone)), em = (b.email || '').trim().toLowerCase(), nm = cleanName(b.guest || '').toLowerCase().trim(), ref = (b.ref || '').trim().toLowerCase(), out = new Map();
    const add = (cl, why) => { if (cl && !cl.anonymised_at && cl.id !== b.client_id && !out.has(cl.id)) out.set(cl.id, why); };
    if (ph.length >= 7) db.clients.forEach(x => { const d = digits(x.phone); if (d.length >= 7 && (d === ph || d.slice(-9) === ph.slice(-9))) add(x, 'phone'); });
    if (/@/.test(em)) db.clients.forEach(x => { if ((x.email || '').toLowerCase() === em) add(x, 'email'); });
    if (ref.length >= 4) db.bookings.forEach(x => { if (x.id !== b.id && x.client_id && (x.ref || '').toLowerCase() === ref) add(db.clients.find(y => y.id === x.client_id), 'ref'); });
    if (nm.length >= 3 && !b.client_id) db.clients.forEach(x => { if ((x.name || '').toLowerCase().includes(nm)) add(x, 'name'); });
    return [...out].slice(0, 5).map(([id, why]) => ({ cl: db.clients.find(x => x.id === id), why }));
  }
  function suggHtml(b, i) {
    const ms = guestMatches(b); if (!ms.length) return '';
    const strong = ms.some(x => x.why !== 'name'), n = id => db.bookings.filter(x => x.client_id === id).length;
    return `<div class="${strong ? 'inbase' : ''}"><span class="small">${strong ? '<b>' + T('in_base') + '</b>' : T('maybe_same')}</span>${ms.map(x => `<button type="button" class="sgrow" data-act="gpick" data-i="${i}" data-c="${x.cl.id}"><span class="grow-l"><b>${esc(x.cl.name)}</b><span class="muted small">${esc([phoneFlag(x.cl.phone).split(' ')[0] + ' ' + (x.cl.phone || ''), x.cl.email, T('bookings_n') + ': ' + n(x.cl.id), T('match_' + x.why)].filter(v => v && v.trim()).join(' · '))}</span></span><span class="btn sm">${T('use')}</span></button>`).join('')}</div>`;
  }
  function findClient(b) {
    const ph = digits(b.phone), nm = cleanName(b.guest).toLowerCase();
    return (b.client_id && db.clients.find(x => x.id === b.client_id)) || (ph.length >= 7 && db.clients.find(x => digits(x.phone) === ph)) || db.clients.find(x => (x.name || '').toLowerCase() === nm && !digits(x.phone) && ph.length < 7) || null;
  }
  // Booking history: when it was made, what changed, when the tour moved or was cancelled.
  const HFIELDS = ['guest', 'adults', 'children', 'phone', 'email', 'ref', 'payment', 'price', 'amount_due', 'currency', 'pickup_addr', 'lang', 'marks'];
  function bookHistory(prev, br, oldTour, row) {
    const now = new Date().toISOString(), by = me().id, h = prev && Array.isArray(prev.history) ? prev.history.slice() : [];
    if (!prev) h.push({ at: now, by, w: 'created' });
    else {
      const val = (o, k) => (k === 'marks' ? (o.marks || []).slice().sort().join(',') : String(o[k] ?? ''));
      const f = HFIELDS.filter(k => val(prev, k) !== val(br, k) && !(k === 'currency' && !prev.currency)); if (f.length) h.push({ at: now, by, w: 'changed', f });
      const was = prev.tour_id && prev.tour_id !== br.tour_id ? db.tours.find(x => x.id === prev.tour_id) : null; if (was) h.push({ at: now, by, w: 'moved', from: `${was.date} ${was.start_time || ''}`.trim(), to: `${row.date} ${row.start_time || ''}`.trim() });
      else if (oldTour && row && (oldTour.date !== row.date || (oldTour.start_time || '') !== (row.start_time || ''))) h.push({ at: now, by, w: 'moved', from: `${oldTour.date} ${oldTour.start_time || ''}`.trim(), to: `${row.date} ${row.start_time || ''}`.trim() });
    }
    return h.slice(-40);
  }
  async function addHistory(tourId, entry) { const at = new Date().toISOString(); for (const b of db.bookings.filter(x => x.tour_id === tourId)) await S.save('bookings', { ...b, history: [...(Array.isArray(b.history) ? b.history : []), { at, by: me().id, ...entry }].slice(-40) }); }
  function historyHtml(b) {
    const h = Array.isArray(b.history) ? b.history.slice() : []; if (!h.length && b.created_at) h.push({ at: b.created_at, w: 'created' }); if (!h.length) return '';
    const when = x => new Intl.DateTimeFormat(LOCALES[lang()], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(x));
    const dt = v => { const [d, tm] = String(v || '').split(' '); return d ? fmt(d, { day: 'numeric', month: 'short' }) + (tm ? ' ' + tm : '') : ''; };
    const FL = { price: 'bk_price', guest: 'guest', adults: 'adults', children: 'children', phone: 'phone', email: 'email', ref: 'ref', payment: 'payment', amount_due: 'amount_due', currency: 'currency', pickup_addr: 'guest_addr', lang: 'guest_lang', marks: 'options' };
    const txt = x => x.w === 'created' ? T('h_created') : x.w === 'changed' ? T('h_changed') + ': ' + (x.f || []).map(k => T(FL[k] || k).toLowerCase()).join(', ') : x.w === 'moved' ? T('h_moved', { from: dt(x.from), to: dt(x.to) }) : x.w === 'cancelled' ? T('h_cancelled') + (x.reason ? ': ' + x.reason : '') : x.w === 'restored' ? T('h_restored') : x.w === 'car2' ? T('h_car2') : x.w === 'checked' ? T('h_checked', { note: x.note || '' }) : x.w;
    return `<details class="sect"><summary>${T('bk_history')} (${h.length})</summary><ol class="hist">${h.slice().reverse().map(x => `<li><span class="num muted small">${esc(when(x.at))}</span><span>${esc(txt(x))}${x.by ? ` <span class="muted small">· ${esc(pname(x.by))}</span>` : ''}</span></li>`).join('')}</ol></details>`;
  }
  const numOrNull = v => (v === '' || v === null || v === undefined ? null : Number(v));
  async function saveTour() {
    const d = state.modal.draft, old = db.tours.find(t => t.id === d.id), cnt = draftCounts(d);
    const tloc = parseLoc(d.pickup); if (tloc.url) { d.pickup = tloc.addr; d.pickup_url = tloc.url; }
    const row = { id: d.id, date: d.date, date_to: d.date_to && d.date_to > d.date ? d.date_to : null, start_time: d.start_time || null, end_time: d.end_time || null, title: (d.title || '').trim(), kind: d.kind, capacity: Number(d.capacity) || 0, pax: cnt.pax, adults: cnt.adults, children: cnt.children, language: d.language || null, pickup: d.pickup || null, pickup_url: d.pickup_url || null, notes: d.notes || null, status: d.status, guide_id: d.guide_id || null, driver_id: d.driver_id || null, guide_pay: numOrNull(d.guide_pay), driver_pay: numOrNull(d.driver_pay), external_id: d.external_id || null };
    if (!row.title) { toast(T('need_title')); return; }
    await S.save('tours', row);
    const keep = new Set();
    for (const b of d.bookings) {
      if (!(b.guest || '').trim()) continue;
      b.phone = normPhone(b.phone); const em = cleanEmail(b.email) || null;
      let c = findClient(b) || (em && db.clients.find(x => (x.email || '').toLowerCase() === em)) || null;
      if (!c) { c = { id: S.uid(), name: cleanName(b.guest) || b.guest.trim(), phone: b.phone || null, email: em, notes: null }; await S.save('clients', c); }
      else if ((em && !c.email) || (b.phone && !c.phone)) { c = { ...c, email: c.email || em, phone: c.phone || b.phone || null }; await S.save('clients', c); }
      const loc = needsAddr(b) ? parseLoc(b.pickup_addr) : { addr: '', url: '' };
      const a = Number(b.adults) || 0, ch = Number(b.children) || 0;
      const br = { id: b.id || S.uid(), tour_id: row.id, client_id: c.id, guest: b.guest.trim(), adults: a, children: ch, pax: a + ch, phone: b.phone || null, ref: b.ref || null, notes: b.notes || null, marks: b.marks || [], source: b.source || null, payment: b.payment || null, amount_due: numOrNull(b.amount_due), attendance: b.attendance || null, pickup_addr: loc.addr || null, pickup_url: loc.url || (needsAddr(b) && loc.addr && b.pickup_url && b.pickup_addr === (db.bookings.find(x => x.id === b.id) || {}).pickup_addr ? b.pickup_url : null), email: em, lang: (b.lang || '').trim().toUpperCase().slice(0, 12) || null, currency: b.currency || guestCur(), price: numOrNull(b.price) };
      br.history = bookHistory(db.bookings.find(x => x.id === br.id), br, old, row);
      keep.add(br.id); await S.save('bookings', br);
    }
    for (const b of db.bookings.filter(b => b.tour_id === row.id && !keep.has(b.id))) await S.remove('bookings', b.id);
    if (d.costs) { const items = {}; COSTS.forEach(k => { if (Number(d.costs[k]) > 0) items[k] = Number(d.costs[k]); }); await S.save('tour_costs', { id: row.id, items, note: (d.costNote || '').trim() || null }); }
    const before = old && live(old) ? [old.guide_id, old.driver_id].filter(Boolean) : [], after = live(row) ? [row.guide_id, row.driver_id].filter(Boolean) : [];
    const np = { title: row.title, date: row.date, time: row.start_time || '' };
    await notify(after.filter(x => !before.includes(x)), 'tour_assigned', np);
    await notify(before.filter(x => !after.includes(x)), 'tour_removed', np);
    if (old && (old.date !== row.date || old.start_time !== row.start_time)) await notify(after.filter(x => before.includes(x)), 'tour_changed', np);
    logAct(`${old ? 'Changed' : 'Created'} tour: ${row.title}, ${row.date}`);
    state.modal = null;
  }

  // ---------- second car: a copy of the card for the guests who do not fit ----------
  async function secondCar(id) {
    const t = db.tours.find(x => x.id === id); if (!t) return null;
    const seats = rules().carSeats || 6, bks = tourBookings(t.id).slice(), move = []; let left = bks.reduce((n, b) => n + (Number(b.pax) || 0), 0);
    // whole bookings move, last added first, until the first car fits
    for (let i = bks.length - 1; i >= 0 && left > seats; i--) { if (bks.length - move.length <= 1) break; move.push(bks[i]); left -= Number(bks[i].pax) || 0; }
    const sum = (list, k) => list.reduce((n, b) => n + (Number(b[k]) || 0), 0), stay = bks.filter(b => !move.includes(b));
    const copy = { ...t, id: S.uid(), guide_id: null, driver_id: null, guide_pay: null, driver_pay: null, external_id: null, capacity: seats, notes: [T('car2_note'), t.notes].filter(Boolean).join(' · '), adults: sum(move, 'adults'), children: sum(move, 'children'), pax: sum(move, 'pax') };
    await S.save('tours', copy);
    for (const b of move) await S.save('bookings', { ...b, tour_id: copy.id, history: [...(Array.isArray(b.history) ? b.history : []), { at: new Date().toISOString(), by: me().id, w: 'car2' }] });
    if (bks.length) await S.save('tours', { ...t, adults: sum(stay, 'adults'), children: sum(stay, 'children'), pax: sum(stay, 'pax') });
    logAct(`Second car added: ${t.title}, ${t.date} (${move.length} bookings moved)`);
    return copy.id;
  }

  // ---------- cancelling a tour: the admin cancels, a guide or driver reports it for approval ----------
  function cancelModalHtml(m) {
    const t = db.tours.find(x => x.id === m.id) || {}, admin = isAdmin();
    return `<div class="hdr"><h2>${T(admin ? 'cancel_title' : 'report_cancel')}</h2><button class="iconbtn" data-act="close" aria-label="${T('close')}">✕</button></div>
      <p class="muted small">${esc(t.title || '')} · ${esc(t.date ? dateText(t) : '')}${admin ? '' : '. ' + T('report_cancel_text')}</p>
      <form class="f" data-form="cancel"><label>${T('cancel_reason')}<input id="cx-reason" name="reason" maxlength="200" ${admin ? '' : 'required'} autocomplete="off"></label>
      <div class="actions"><button type="button" class="btn" data-act="close">${T('keep_tour')}</button><button class="btn danger">${T(admin ? 'cancel_tour' : 'send')}</button></div></form>`;
  }
  async function setCancelled(t, on, reason) {
    const row = { ...t, status: on ? 'cancelled' : 'confirmed', cancel_reason: on ? (reason || null) : null, cancelled_at: on ? new Date().toISOString() : null };
    await S.save('tours', row);
    if (isAdmin()) await addHistory(t.id, on ? { w: 'cancelled', reason: reason || '' } : { w: 'restored' });
    await notify([t.guide_id, t.driver_id], on ? 'tour_cancelled' : 'tour_restored', { title: t.title, date: t.date, reason: reason || '' });
    logAct(`${on ? 'Cancelled' : 'Restored'} tour: ${t.title}, ${t.date}${on && reason ? ' (' + reason + ')' : ''}`);
  }
  async function cancelSubmit(reason) {
    const m = state.modal, t = db.tours.find(x => x.id === m.id); if (!t) return;
    if (isAdmin()) await setCancelled(t, true, reason);
    else {
      if (db.change_requests.some(q => q.tour_id === t.id && q.user_id === me().id && q.status === 'pending' && (q.patch || {}).status === 'cancelled')) { toast(T('creq_pending')); }
      else {
        await S.save('change_requests', { id: S.uid(), tour_id: t.id, user_id: me().id, patch: { status: 'cancelled' }, cant: false, swap_with: null, agreed: false, message: reason || null, status: 'pending', created_at: new Date().toISOString(), decided_by: null });
        await notify(admins(), 'creq_new', { name: me().name, title: t.title, date: t.date });
        logAct(`Cancellation reported for ${t.title}, ${t.date}`); toast(T('sent'));
      }
    }
    closeModal();
  }

  // ---------- change requests: guides and drivers suggest, the admin approves ----------
  function creqText(q) {
    const p = q.patch || {}, parts = [];
    if (p.guide_id === q.user_id && !q.swap_with) parts.push(T('xc_take_guide')); if (p.driver_id === q.user_id && !q.swap_with) parts.push(T('xc_take_driver'));
    if (q.swap_with) parts.push(`${T('swap_to')} ${pname(q.swap_with)} (${q.agreed ? T('swap_agreed') : T('swap_waiting')})`);
    if (q.cant) parts.push(T('creq_cant_short'));
    if (p.status === 'cancelled') parts.push(T('creq_cancel'));
    if (p.start_time) parts.push(`${T('start')} → ${p.start_time}`);
    if (p.pickup) parts.push(`${T('pickup')} → ${p.pickup}`);
    if (p.notes) parts.push(`${T('notes')} → ${p.notes}`);
    if (q.message) parts.push(`“${q.message}”`);
    return parts.join(' · ');
  }
  function creqModalHtml(m) {
    const d = m.draft, t = db.tours.find(x => x.id === d.tour_id) || {};
    return `<div class="hdr"><h2>${T('suggest_change')}</h2><button class="iconbtn" data-act="close" aria-label="${T('close')}">✕</button></div><p class="muted small">${esc(t.title || '')} · ${esc(t.date ? dateText(t) : '')}. ${T('creq_text')}</p>
      <form class="f" data-form="creq"><label>${T('start')}<input id="cq-start" data-f="start_time" type="time" value="${esc(d.start_time || '')}"></label>
      <label>${T('pickup')}<input id="cq-pickup" data-f="pickup" value="${esc(d.pickup || '')}"></label>
      <label>${T('notes')}<textarea id="cq-notes" data-f="notes">${esc(d.notes || '')}</textarea></label>
      <label>${T('swap_pick')}<select id="cq-swap" data-f="swap_with">${opt('', '—', d.swap_with)}${staff().filter(p => p.id !== me().id && p.role !== 'admin' && p.role === me().role).map(p => opt(p.id, p.name, d.swap_with)).join('')}</select></label>
      <label style="flex-direction:row;align-items:center;gap:8px;color:var(--ink)"><input type="checkbox" id="cq-cant" data-cq="cant" ${d.cant ? 'checked' : ''} style="width:20px;height:20px">${T('creq_cant')}</label>
      <label>${T('creq_msg')}<input id="cq-msg" data-f="message" value="${esc(d.message || '')}"></label>
      <div class="actions"><button type="button" class="btn" data-act="close">${T('close')}</button><button class="btn primary">${T('send')}</button></div></form>`;
  }
  async function saveCreq() {
    const d = state.modal.draft, t = db.tours.find(x => x.id === d.tour_id), patch = {};
    for (const k of ['start_time', 'pickup', 'notes']) if ((d[k] || '') !== (t[k] || '')) patch[k] = d[k] || '';
    if (!Object.keys(patch).length && !d.cant && !d.swap_with && !(d.message || '').trim()) { toast(T('creq_empty')); return; }
    await S.save('change_requests', { id: S.uid(), tour_id: t.id, user_id: me().id, patch, cant: !!d.cant && !d.swap_with, swap_with: d.swap_with || null, agreed: false, message: (d.message || '').trim() || null, status: 'pending', created_at: new Date().toISOString(), decided_by: null });
    if (d.swap_with) await notify([d.swap_with], 'swap_ask', { name: me().name, title: t.title, date: t.date });
    await notify(admins(), 'creq_new', { name: me().name, title: t.title, date: t.date });
    logAct(`Change suggested for ${t.title}, ${t.date}`); state.modal = null; toast(T('sent'));
  }
  async function decideCreq(id, ok) {
    const q = db.change_requests.find(x => x.id === id), t = db.tours.find(x => x.id === q.tour_id);
    if (ok && t && (q.patch || {}).status === 'cancelled') await setCancelled(t, true, q.message || '');
    else if (ok && t) {
      const row = { ...t, ...(q.patch || {}) };
      if (q.swap_with) { if (row.guide_id === q.user_id) row.guide_id = q.swap_with; else if (row.driver_id === q.user_id) row.driver_id = q.swap_with; }
      else if (q.cant) { if (row.guide_id === q.user_id) row.guide_id = null; if (row.driver_id === q.user_id) row.driver_id = null; }
      await S.save('tours', row);
    }
    await S.save('change_requests', { ...q, status: ok ? 'approved' : 'declined', decided_by: me().id });
    await notify([q.user_id], ok ? 'creq_approved' : 'creq_declined', { title: t ? t.title : '', date: t ? t.date : '' });
    if (ok && t && q.swap_with) await notify([q.swap_with], 'tour_assigned', { title: t.title, date: t.date, time: t.start_time || '' });
    logAct(`Change request ${ok ? 'approved' : 'declined'}: ${t ? t.title : ''}, ${pname(q.user_id)}`);
  }

  // ---------- clients ----------
  function clientModalHtml(m) {
    let c = db.clients.find(x => x.id === m.id); if (!c) return `<div class="hdr"><h2>—</h2><button class="iconbtn" data-act="close">✕</button></div>`;
    const bks = db.bookings.filter(b => b.client_id === c.id).map(b => ({ b, t: db.tours.find(t => t.id === b.tour_id) })).filter(x => x.t).sort((x, y) => y.t.date.localeCompare(x.t.date));
    const rs = db.client_ratings.filter(r => r.client_id === c.id).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    const last = bks[0] ? bks[0].b : {};
    if (c.anonymised_at) c = { ...c, name: T('guest_removed') };
    return `<div class="hdr"><span class="spacer"></span><button class="iconbtn" data-act="close" aria-label="${T('close')}">✕</button></div>
      <div class="ccard"><span class="avatar xl ini">${esc(initials(c.name))}</span><h2>${esc(c.name)}</h2>${contactBtns(c.phone, c.email)}<div class="row">${vipTag(c.id)}${ratingTag(c.id)}${bks.some(x => x.b.attendance === 'noshow') ? `<span class="tag t-danger num">${T('att_noshow')}: ${bks.filter(x => x.b.attendance === 'noshow').length}</span>` : ''}</div></div>
      <dl class="fields"><dt>${T('phone')}</dt><dd class="num">${esc(c.phone || '—')}</dd>${phoneCountry(c.phone) ? `<dt>${T('phone_country')}</dt><dd>${esc(phoneFlag(c.phone))}</dd>` : ''}<dt>${T('email')}</dt><dd>${esc(c.email || '—')}</dd>${last.lang ? `<dt>${T('guest_lang')}</dt><dd>${esc(last.lang)}</dd>` : ''}<dt>${T('ref')}</dt><dd>${esc(last.ref || '—')}</dd><dt>${T('guests_cap')}</dt><dd class="num">${esc(last.pax ? acText(last) : '—')}</dd><dt>${T('bookings_cap')}</dt><dd class="num">${bks.length}</dd></dl>
      <details class="sect"><summary>${T('rate_guest')}</summary><div class="card f"><b>${T('like_title')}</b><span class="muted small">${T('anon')}</span><div class="bar"><button class="btn sm" data-act="rate" data-id="${c.id}" data-r="like">${T('like')} · ${rs.filter(r => r.rating === 'like').length}</button><button class="btn sm" data-act="rate" data-id="${c.id}" data-r="dislike">${T('dislike')} · ${rs.filter(r => r.rating === 'dislike').length}</button></div><b>${T('rate_guest')}</b><div class="bar">${Object.keys(RATINGS).map(k => `<button class="btn sm" data-act="rate" data-id="${c.id}" data-r="${k}"><span class="tag ${RATINGS[k]}">${T('rate_' + k)}</span></button>`).join('')}</div><input class="inp" id="rate-note" placeholder="${T('note')}">
        ${rs.filter(r => RATINGS[r.rating]).map(r => `<div class="row small"><span class="tag ${RATINGS[r.rating] || 't-muted'}">${T('rate_' + r.rating)}</span><span class="muted">${esc((r.created_at || '').slice(0, 10))}</span>${r.note ? `<span>${esc(r.note)}</span>` : ''}</div>`).join('')}</div></details>
      <details class="sect" open><summary>${T('history')} (${bks.length})</summary><div class="list">${bks.length ? bks.map(({ b, t }) => `<button class="card" data-act="tour" data-id="${t.id}"><span class="row"><b class="num">${esc(dateText(t))}</b><span class="tag t-${esc(t.kind)}">${T('kind_' + t.kind)}</span>${live(t) ? '' : `<span class="tag t-danger">${T('cancelled')}</span>`}${b.attendance === 'noshow' ? `<span class="tag t-danger">${T('att_noshow')}</span>` : b.attendance === 'arrived' ? `<span class="tag t-ok">${T('att_arrived')}</span>` : ''}<span class="tag t-muted num">${esc(acText(b))}</span>${(b.marks || []).map(x => `<span class="tag ${x === 'stays' ? 't-stay' : 't-custom'}">${esc(markLabel(x))}</span>`).join('')}</span><span class="ttl">${esc(t.title)}</span><span class="muted small">${esc([pname(t.guide_id), b.ref].filter(x => x && x !== '—').join(' · '))}</span></button>`).join('') : `<div class="empty">${T('no_history')}</div>`}</div></details>
      ${isAdmin() && !c.anonymised_at ? `<details class="sect"><summary>${T('edit')}</summary><form class="f" data-form="cedit" data-id="${c.id}"><label>${T('name')}<input name="name" value="${esc(c.name || '')}" required></label><div class="two"><label>${T('phone')}<input name="phone" type="tel" value="${esc(c.phone || '')}"></label><label>${T('email')}<input name="email" type="email" value="${esc(c.email || '')}"></label></div><label>${T('notes')}<input name="notes" value="${esc(c.notes || '')}"></label><div class="actions"><button class="btn primary">${T('save')}</button></div></form></details>` : ''}
      ${isAdmin() && !c.anonymised_at ? `<details class="sect"><summary>${T('a_privacy')}</summary><div class="bar"><button class="btn sm" data-act="gexport" data-id="${c.id}">${T('pv_export')}</button><button class="btn sm danger" data-act="gerase" data-id="${c.id}">${T('pv_delete')}</button></div></details>` : ''}`;
  }

  // ---------- tour list: one tour's settings ----------
  function catModalHtml(m) {
    const d = m.draft, isNew = m.i < 0;
    return `<div class="hdr">${d.title ? emblem({ title: d.title }, true) : ''}<h2>${T(isNew ? 'cat_add' : 'cat_edit')}</h2><button class="iconbtn" data-act="close" aria-label="${T('close')}">✕</button></div>
      <form class="f" data-form="cat"><label>${T('title')}<input id="c-title" data-f="title" value="${esc(d.title || '')}" required></label>
      <div class="two"><label>${T('type')}<select id="c-kind" data-f="kind">${KINDS.map(k => opt(k, T('kind_' + k), d.kind)).join('')}</select></label><label>${T('cat_cap')}<input id="c-cap" data-f="capacity" type="number" min="0" value="${esc(d.capacity || 0)}"></label></div>
      <div class="two"><label>${T('start')}<input id="c-start" data-f="start" type="time" value="${esc(d.start || '')}"></label><label>${T('duration_h')}<input id="c-dur" data-f="dur" type="number" min="0" max="24" step="0.25" inputmode="decimal" value="${esc(d.dur ?? '')}"></label></div>
      <div class="two"><label>${T('cat_days')}<input id="c-days" data-f="days" type="number" min="1" value="${esc(d.days || 1)}"></label><label>${T('cat_rest')}<input id="c-rest" data-f="rest" type="number" min="0" step="15" value="${esc(d.rest || 0)}"></label></div>
      <label>${T('pickup')}<input id="c-pickup" data-f="pickup" value="${esc(d.pickup || '')}"></label><label>${T('map_link')}<input id="c-url" data-f="pickup_url" type="url" value="${esc(d.pickup_url || '')}" placeholder="https://maps.app.goo.gl/..."></label>
      <details class="sect"><summary>${T('cat_look')}</summary><div class="two"><label>${T('cat_color')}<input id="c-color" data-f="color" type="color" value="${esc(d.color || tourStyle(d.title || 'x').color)}"></label><label>${T('cat_code')}<input id="c-code" data-f="code" maxlength="3" value="${esc(d.code || '')}" placeholder="${esc(tourStyle(d.title || 'x').code)}"></label></div></details>
      <details class="sect"><summary>${T('cat_geo')}</summary><div class="f"><span class="muted small">${T('g_note')}</span><div class="two"><label>${T('cat_km')}<input id="c-km" data-f="km" type="number" min="0" value="${esc(d.km ?? '')}" placeholder="${esc(kmOf(d.title || ''))}"></label><label>${T('cat_walk')}<input id="c-walk" data-f="walk_km" type="number" min="0" step="0.5" value="${esc(d.walk_km ?? '')}" placeholder="${esc(walkOf(d.title || ''))}"></label></div>
        <div class="two"><label>${T('cat_lat')}<input id="c-lat" data-f="lat" type="number" step="any" value="${esc(d.lat ?? '')}" placeholder="${esc((placeOf(d.title || '') || {}).lat ?? '')}"></label><label>${T('cat_lon')}<input id="c-lon" data-f="lon" type="number" step="any" value="${esc(d.lon ?? '')}" placeholder="${esc((placeOf(d.title || '') || {}).lon ?? '')}"></label></div><span class="muted small">${T('cat_wx')}</span>
        <div class="checks">${REGIONS.map(r => `<label><input type="checkbox" data-rg="${esc(r)}" ${d.regions.includes(r) ? 'checked' : ''}>${esc(r)}</label>`).join('')}</div></div></details>
      <div class="actions">${isNew ? '' : `<button type="button" class="btn danger" data-act="catdel">${T('cat_del')}</button>`}<button type="button" class="btn" data-act="close">${T('close')}</button><button class="btn primary">${T('save')}</button></div></form>`;
  }
  async function saveCat() {
    const m = state.modal, d = m.draft, title = (d.title || '').trim(); if (!title) return;
    const items = catalog().slice(), old = m.i >= 0 ? items[m.i] : {}, dur = Number(d.dur) || 0;
    const it = { ...old, id: old.id || S.uid(), title, kind: d.kind || 'private', start: d.start || '', end: d.start && dur > 0 ? hhmm(mins(d.start) + dur * 60) : '', days: Math.max(1, Number(d.days) || 1), capacity: Number(d.capacity) || 0, rest: Number(d.rest) || 0, pickup: d.pickup || '', pickup_url: d.pickup_url || '', color: d.color || '', code: String(d.code || '').toUpperCase(), regions: d.regions };
    if (numSet(d.km)) it.km = Number(d.km) || 0; else delete it.km;
    if (numSet(d.walk_km)) it.walk_km = Number(d.walk_km) || 0; else delete it.walk_km;
    if (numSet(d.lat) && numSet(d.lon)) { it.lat = Number(d.lat); it.lon = Number(d.lon); } else { delete it.lat; delete it.lon; }
    if (m.i >= 0) items[m.i] = it; else items.push(it);
    await S.save('settings', { id: 'catalog', value: { items } }); state.modal = null; toast(T('saved'));
  }

  // ---------- badges: what a person has done, counted from their tours ----------
  const B_ICON = { star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>', moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>', mountain: '<path d="M3 20l6-11 4 7 2-3 6 7z"/>', coin: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10.2c0-1 1-1.7 2.5-1.7s2.5.7 2.5 1.7-1 1.5-2.5 1.8-2.5.8-2.5 1.8 1 1.7 2.5 1.7 2.5-.7 2.5-1.7"/>', boot: '<path d="M8 3v9l-3 3v4h14v-3l-6-3V3z"/>', bed: '<path d="M3 18V8M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="1.5"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', glass: '<path d="M7 3h10l-1 7a4 4 0 0 1-8 0z"/><path d="M12 14v6M9 21h6"/>', map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>', users: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.5a5 5 0 0 1 5 5.5"/>', bolt: '<path d="M13 2 5 14h6l-1 8 8-12h-6z"/>', paw: '<circle cx="7" cy="9" r="1.6"/><circle cx="12" cy="6.5" r="1.6"/><circle cx="17" cy="9" r="1.6"/><path d="M8 17c0-2.5 2-4.5 4-4.5s4 2 4 4.5c0 1.5-1.5 2-4 2s-4-.5-4-2z"/>', car: '<path d="M4 16v-4l2-5h12l2 5v4"/><path d="M3 16h18v2H3z"/><circle cx="7.5" cy="18" r="1.5"/><circle cx="16.5" cy="18" r="1.5"/>', globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>', heart: '<path d="M12 20s-7-4.4-7-9.5A4 4 0 0 1 12 8a4 4 0 0 1 7 2.5C19 15.6 12 20 12 20z"/>' };
  Object.assign(IC, B_ICON);
  // Titles: for each kind of tour, the guide and the driver with the most such tours in the last 12 months hold a title.
  // The ranking itself is never shown; a title simply moves when a colleague overtakes its holder.
  const THEMES = [['desert', /gareji|rainbow/i, 'sun'], ['mountain', /kazbegi|truso|juta|gudauri|khevsureti|tusheti|svaneti/i, 'mountain'], ['wine', /kakheti|wine|sighnaghi|signagi|telavi/i, 'glass'], ['city', /walking|brutal|night tour|old tbilisi|tiflis/i, 'pin'], ['south', /vardzia|borjomi|uplistsikhe|rabati/i, 'map'], ['west', /kutaisi|chiatura|katskhi|tskaltubo/i, 'map'], ['armenia', /armenia|yerevan|sevan|dilijan|haghpat/i, 'globe']];
  const titleKey = (th, role) => (th === 'mountain' ? (role === 'guide' ? 'eagle' : 'goat') : th);
  function holders() {
    if (memo.hold) return memo.hold;
    const td = today(), from = addDays(td, -365), cnt = {}, out = {};
    for (const t of db.tours) {
      if (!live(t) || t.date > td || t.date < from) continue;
      for (const [th, re] of THEMES) if (re.test(t.title)) for (const [role, id] of [['guide', t.guide_id], ['driver', t.driver_id]]) if (id) { const c = cnt[th + ':' + role] = cnt[th + ':' + role] || {}; c[id] = (c[id] || 0) + 1; }
    }
    for (const key of Object.keys(cnt)) { const [th, role] = key.split(':'), max = Math.max(...Object.values(cnt[key])); if (max < 5) continue; for (const id of Object.keys(cnt[key])) if (cnt[key][id] === max && (person(id) || {}).active !== false) (out[id] = out[id] || []).push({ th, role, n: max, key: titleKey(th, role), icon: THEMES.find(x => x[0] === th)[2] }); }
    return memo.hold = out;
  }
  const titlesOf = id => (holders()[id] || []).map(x => T('ti_' + x.key));
  function firstRuns() {
    if (memo.first) return memo.first;
    const by = {}; let start = '9999';
    for (const t of db.tours) { if (!live(t)) continue; if (t.date < start) start = t.date; (by[t.title] = by[t.title] || []).push(t); }
    const fresh = new Set(), cut = addDays(start === '9999' ? today() : start, 60);
    for (const k of Object.keys(by)) { const ts = by[k].sort((x, y) => x.date.localeCompare(y.date)); if (ts[0].date >= cut) ts.slice(0, 3).forEach(t => fresh.add(t.id)); }
    return memo.first = fresh;
  }
  const nf = n => new Intl.NumberFormat(LOCALES[lang()]).format(Math.round(n));
  function game(id) {
    if (memo['g' + id]) return memo['g' + id];
    const p = person(id) || {}, td = today(), s = personStats(id), ts = s.ts, mo = td.slice(0, 7), pm = (() => { const d = D(td); d.setDate(1); d.setMonth(d.getMonth() - 1); return iso(d).slice(0, 7); })();
    const isD = p.role === 'driver' || !!p.vehicle, isG = p.role !== 'driver', own = p.vehicle === 'own', delica = p.vehicle === 'delica';
    let km = 0, walk = 0, solo = 0, drives = 0, mountain = 0, wine = 0, late = 0, early = 0, night = 0, weekend = 0, full = 0, earned = 0;
    const per = { w: {}, m: {}, y: {}, s: {} }, hid = { newyear: 0, snow: 0, fri13: 0, sunrise: 0 }, r0 = rules(); let weekNow = 0; const thisMon = monday(td);
    let armenia = 0, khink = 0, road = 0, kakh = 0, pioneer = 0, smart = 0, nights = 0, kids = 0; const cn = id === me().id ? (state.counts || {}) : {}; const fresh = firstRuns(), mineFirst = {}, d90 = addDays(td, -90);
    const regs = new Set(), months = new Set(), starts = {}, partners = {}, cur = { tours: 0, guests: 0, km: 0 }, prev = { tours: 0, guests: 0, km: 0 };
    for (const t of ts) {
      const k = kmOf(t.title), drv = t.driver_id === id || (t.guide_id === id && !t.driver_id && own && k > 0), st = t.start_time || '', dow = D(t.date).getDay(), mm = t.date.slice(0, 7);
      if (drv) { km += k; drives++; } if (t.guide_id === id) walk += walkOf(t.title);
      if (t.guide_id === id && !t.driver_id && own && k > 0) solo++;
      if (/kazbegi|tusheti|svaneti|khevsureti|gudauri|truso|juta/i.test(t.title)) mountain++;
      if (/kakheti|wine|sighnaghi|signagi/i.test(t.title)) wine++;
      nights += Math.max(0, tourDays(t).length - 1); kids += Number(t.children) || 0;
      if (/armenia|yerevan|sevan|dilijan|haghpat/i.test(t.title)) armenia++; if (/kazbegi|gudauri|truso|juta|ananuri|pasanauri|stepantsminda/i.test(t.title)) khink++; if (/kakheti|sighnaghi|signagi|telavi/i.test(t.title)) kakh++; if (k >= 100) road++; if (/gudauri|kazbegi|truso|juta|stepantsminda/i.test(t.title)) smart++; if (fresh.has(t.id)) pioneer++;
      if (!mineFirst[t.title] || t.date < mineFirst[t.title]) mineFirst[t.title] = t.date;
      if (st && st < '07:30') early++; if (st >= '12:00') late++; if ((t.end_time || '') >= '21:00') night++;
      if (dow === 0 || dow === 6) weekend++;
      if (t.kind === 'group' && t.capacity > 0 && t.pax >= t.capacity) full++;
      earned += payFor(t, t.guide_id === id ? 'guide' : 'driver') || 0;
      regionsOf(t.title).forEach(r => regs.add(r)); months.add(t.date.slice(5, 7)); starts[t.date] = (starts[t.date] || 0) + 1;
      const other = t.guide_id === id ? t.driver_id : t.guide_id; if (other && other !== id) partners[other] = (partners[other] || 0) + 1;
      const yy = t.date.slice(0, 4), mN = Number(t.date.slice(5, 7)), dN = Number(t.date.slice(8, 10)), wk = monday(t.date); per.w[wk] = (per.w[wk] || 0) + 1; per.m[mm] = (per.m[mm] || 0) + 1; per.y[yy] = (per.y[yy] || 0) + 1; if (mN >= r0.seasonFrom && mN <= r0.seasonTo) per.s[yy] = (per.s[yy] || 0) + 1; if (wk === thisMon) weekNow++;
      if ((mN === 12 && dN === 31) || (mN === 1 && dN <= 2)) hid.newyear++; if ((mN === 12 || mN <= 2) && /kazbegi|truso|juta|gudauri|khevsureti|tusheti|svaneti/i.test(t.title)) hid.snow++; if (dN === 13 && dow === 5) hid.fri13++; if (st && st < '06:00') hid.sunrise++;
      const box = mm === mo ? cur : mm === pm ? prev : null; if (box) { box.tours++; box.guests += t.pax || 0; if (drv) box.km += k; }
    }
    const days = [...new Set(ts.flatMap(tourDays))].filter(d => d <= td).sort(); let streak = 0, run = 0, gap = 0; const yearAgo = addDays(td, -365);
    let away = 0; days.forEach((d, i) => { run = i && daysBetween(days[i - 1], d) === 1 ? run + 1 : 1; streak = Math.max(streak, run); if (i) away = Math.max(away, daysBetween(days[i - 1], d) - 1); if (i && d >= yearAgo) gap = Math.max(gap, daysBetween(days[i - 1], d) - 1); });
    const best = o => Math.max(0, ...Object.values(o));
    const offers = db.offers.filter(o => o.user_id === id).length, rep = id === me().id ? (state.repeatN || 0) : 0;
    const B = (k, track, icon, have, goal, unit) => ({ k, track, icon, raw: have, have: Math.min(have, goal), goal, done: have >= goal, unit: unit || '' });
    const n = ts.length, list = [B('welcome', 'all', 'heart', 1, 1), B('first', 'all', 'star', n, 1), B('firstoff', 'all', 'sun', db.time_off.filter(o => o.user_id === id).length, 1)];
    if (isG) list.push(B('t50', 'guide', 'guide', n, 50), B('t100', 'guide', 'guide', n, 100), B('t250', 'guide', 'guide', n, 250), B('g500', 'guide', 'users', s.guests, 500), B('g1000', 'guide', 'users', s.guests, 1000), B('explorer', 'guide', 'map', Object.keys(s.titles).length, 5), B('routes10', 'guide', 'map', Object.keys(s.titles).length, 10), B('walk42', 'guide', 'boot', walk, 42, 'km'), B('walk100', 'guide', 'boot', walk, 100, 'km'), B('polyglot', 'guide', 'globe', s.langs, 2), B('seller', 'guide', 'coin', offers, 10), B('familiar', 'guide', 'heart', rep, 5), B('reviewer', 'guide', 'check', s.scores, 20));
    if (isD) list.push(B('d100', 'driver', 'driver', drives, 100), B('km1000', 'driver', 'car', km, 1000, 'km'), B('km10000', 'driver', 'car', km, 10000, 'km'), B('earth', 'driver', 'globe', km, 40075, 'km'), B('moon', 'driver', 'moon', km, 384400, 'km'), B('goat', 'driver', 'mountain', mountain, 10));
    if (own && isG) list.push(B('solo10', 'own', 'car', solo, 10), B('solo50', 'own', 'car', solo, 50));
    if (delica) list.push(B('delica1', 'delica', 'car', km, 1000, 'km'), B('delica10', 'delica', 'car', km, 10000, 'km'), B('offroad', 'delica', 'mountain', mountain, 20));
    list.push(B('geo3', 'geo', 'map', regs.size, 3), B('geo6', 'geo', 'map', regs.size, 6), B('geoall', 'geo', 'map', regs.size, REGIONS.length));
    list.push(B('early', 'fun', 'clock', early, 10), B('late', 'fun', 'bed', late, 10), B('night', 'fun', 'moon', night, 5), B('weekend', 'fun', 'sun', weekend, 20), B('lazy', 'fun', 'bed', gap, 11), B('gold', 'fun', 'coin', earned, 10000, rules().currency || 'GEL'), B('double', 'fun', 'bolt', Object.values(starts).filter(x => x > 1).length, 5), B('iron', 'fun', 'bolt', streak, 6), B('seasons', 'fun', 'cal', months.size, 12), B('full', 'fun', 'users', full, 10), B('wine', 'fun', 'glass', wine, 20), B('bears', 'fun', 'paw', s.bears, 10), B('mountain', 'fun', 'mountain', s.multi, 1), B('rested', 'fun', 'sun', s.rested, 3), B('team', 'fun', 'check', s.tasks, 10));
    const newToMe = Object.values(mineFirst).filter(d => d >= d90).length;
    list.push(B('pioneer', 'new', 'star', pioneer, 1), B('pioneer5', 'new', 'star', pioneer, 5), B('newdest', 'new', 'map', newToMe, 3), B('armenia1', 'new', 'globe', armenia, 1), B('armenia10', 'new', 'globe', armenia, 10));
    const offs = db.time_off.filter(o => o.user_id === id && o.type !== 'sick'), notice = rules().minNoticeDays || 14;
    const planned = offs.filter(o => o.created_at && daysBetween(o.created_at.slice(0, 10), o.date_from) >= notice).length, restDays = offs.filter(o => o.status === 'approved').reduce((n, o) => n + daysBetween(o.date_from, o.date_to) + 1, 0);
    const dq = db.pay_disputes.filter(q => q.user_id === id);
    list.push(B('nights5', 'new', 'moon', nights, 5), B('nights30', 'new', 'moon', nights, 30));
    if (isG) list.push(B('kids50', 'guide', 'users', kids, 50), B('kids200', 'guide', 'users', kids, 200), B('noshow5', 'guide', 'pin', cn.noshow || 0, 5), B('diplomat', 'guide', 'heart', cn.trouble || 0, 1), B('steel', 'guide', 'bolt', cn.trouble || 0, 5));
    list.push(B('ritual', 'fun', 'check', db.tasks.filter(k => k.kind === 'week_check' && k.done_by === id).length, 10));
    list.push(B('planner', 'fun', 'cal', planned, 5), B('rest10', 'fun', 'bed', restDays, 10), B('accountant', 'fun', 'coin', dq.length, 1), B('sharpeye', 'fun', 'coin', dq.filter(q => q.status === 'accepted').length, 3));
    list.push(B('khinkali', 'fun', 'heart', khink, 20), B('smart', 'fun', 'car', smart, 25), B('churchkhela', 'fun', 'glass', kakh, 10));
    list.push(B('week5', 'now', 'bolt', best(per.w), 5), B('month20', 'now', 'cal', best(per.m), 20), B('season80', 'now', 'sun', best(per.s), 80), B('year150', 'now', 'star', best(per.y), 150));
    // tour mastery: the three tours this person has done most, each on its own ladder up to 500
    Object.entries(s.titles).sort((x, y) => y[1] - x[1]).slice(0, 3).forEach(([title, c]) => { const goal = [10, 25, 50, 100, 250, 500].find(x => x > c) || 500, b = B('m:' + title, 'master', 'star', c, goal); b.title = title; b.desc = T('bd_master', { n: c, goal }); b.done = c >= 10; b.tier = [10, 25, 50, 100, 250, 500].filter(x => x <= c).length; list.push(b); });
    (holders()[id] || []).forEach(x => { const b = B('ti:' + x.key, 'titles', x.icon, x.n, x.n); b.title = T('ti_' + x.key); b.desc = T('bd_title'); list.push(b); });
    [['newyear', 'star', hid.newyear], ['snow', 'mountain', hid.snow], ['comeback', 'bolt', away > 30 ? 1 : 0], ['hattrick', 'bolt', Object.values(starts).some(x => x >= 3) ? 1 : 0], ['fri13', 'moon', hid.fri13], ['sunrise', 'sun', hid.sunrise]].forEach(([k, icon, v]) => { const b = B(k, 'secret', icon, v, 1); b.hidden = true; list.push(b); });
    const done = list.filter(b => b.done).length, xp = n * 10 + s.guests + Math.round(km / 20) + Math.round(walk * 2) + done * 25;
    const level = Math.floor((1 + Math.sqrt(1 + 8 * xp / 100)) / 2), base = 100 * level * (level - 1) / 2, next = 100 * level * (level + 1) / 2;
    return memo['g' + id] = { list, done, xp, level, base, next, km, walk, regs, partners, cur, prev, isD, isG, rep, weekNow, yearNow: per.y[td.slice(0, 4)] || 0 };
  }
  // ---------- medals: flat vector art drawn here, so they are sharp at any size and work offline ----------
  const METAL = { bronze: ['#7d4a1e', '#b87333', '#e0a36b'], silver: ['#7c838b', '#b9bec4', '#eceef0'], gold: ['#a67c12', '#e2b340', '#f6d67a'] };   // rim, face, highlight
  const RIBBON = { guide: '#f0901e', all: '#f0901e', master: '#a8500e', driver: '#3b5bbd', delica: '#3b5bbd', own: '#3b5bbd', geo: '#2f6b48', fun: '#6243bd', new: '#0f766e', now: '#0f766e', titles: '#20251f', secret: '#20251f' };
  const mPoly = (n, r1, r2, rot) => [...Array(n * 2)].map((_, i) => { const a = Math.PI * i / n + (rot || 0), r = i % 2 ? r2 : r1; return (48 + r * Math.sin(a)).toFixed(1) + ',' + (62 - r * Math.cos(a)).toFixed(1); }).join(' ');
  const M_SHAPE = { seal: mPoly(16, 37, 33.5), burst: mPoly(12, 38, 31), hex: mPoly(3, 38, 38), shield: null };
  const mShapeOf = t => (t === 'geo' || t === 'titles' ? 'shield' : t === 'driver' || t === 'delica' || t === 'own' ? 'hex' : t === 'fun' || t === 'secret' || t === 'now' || t === 'new' ? 'burst' : 'seal');
  // Bronze, silver or gold: the place of a badge on its own ladder (50 / 100 / 250 tours), or how far a tour mastery has gone.
  function tierOf(b, list) {
    if (b.track === 'titles' || b.track === 'secret') return 'gold';
    if (b.track === 'master') { const n = Array.isArray(b.tier) ? b.tier.length : Number(b.tier) || [10, 25, 50, 100, 250, 500].filter(x => x <= b.raw).length; return n >= 4 ? 'gold' : n >= 2 ? 'silver' : 'bronze'; }
    const pre = String(b.k).replace(/\d+$/, ''), sib = (list || []).filter(x => x.track === b.track && String(x.k).replace(/\d+$/, '') === pre && /\d$/.test(x.k)).sort((x, y) => x.goal - y.goal);
    if (sib.length > 1) { const i = sib.findIndex(x => x.k === b.k); return i <= 0 ? 'bronze' : i === sib.length - 1 ? 'gold' : 'silver'; }
    return ['welcome', 'first', 'firstoff'].includes(b.k) ? 'bronze' : 'silver';
  }
  function medalInner(b, tier, hex) {
    const secret = b.hidden && !b.done, done = !!b.done, shape = mShapeOf(secret ? 'secret' : b.track), [rim, face, hi] = METAL[tier] || METAL.bronze;
    const c = hex ? { rim: '#d9d9d0', face: '#f1efe8', ink: '#70766d', acc: '#f0901e' } : { rim: 'var(--line)', face: 'var(--surface2)', ink: 'var(--muted)', acc: 'var(--accent)' };
    const body = (fill, stroke) => (shape === 'shield' ? `<path d="M48 24 80 34v26c0 20-14 32-32 40-18-8-32-20-32-40V34z" fill="${fill}" stroke="${stroke}" stroke-width="3" stroke-linejoin="round"/>` : `<polygon points="${M_SHAPE[shape]}" fill="${fill}" stroke="${stroke}" stroke-width="3" stroke-linejoin="round"/>`);
    const rib = done ? RIBBON[b.track] || '#f0901e' : c.rim, p = Math.max(0, Math.min(100, Math.round((b.have || 0) / (b.goal || 1) * 100)));
    const icon = secret ? `<text x="48" y="72" text-anchor="middle" font-size="30" font-weight="700" fill="${c.ink}" font-family="-apple-system,Segoe UI,Roboto,sans-serif">?</text>` : `<g transform="translate(34 48) scale(1.17)" fill="none" stroke="${done ? '#20251f' : c.ink}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${IC[b.icon] || IC.star}</g>`;
    return `<path d="M30 2h14l8 30H38z" fill="${rib}"/><path d="M66 2H52l-8 30h14z" fill="${rib}" opacity="${done ? .78 : 1}"/>
      ${done ? body(face, rim) : body(c.face, c.rim)}
      <circle cx="48" cy="62" r="24" fill="${done ? hi : hex ? '#ffffff' : 'var(--surface)'}" stroke="${done ? rim : c.rim}" stroke-width="2"/>
      ${done ? `<path d="M29 54a21 21 0 0 1 17-13" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>` : !secret && p ? `<circle cx="48" cy="62" r="24" fill="none" stroke="${c.acc}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${(p * 1.508).toFixed(1)} 151" transform="rotate(-90 48 62)"/>` : ''}
      ${icon}`;
  }
  const medalArt = b => `<span class="art">${`<svg viewBox="0 0 96 104" aria-hidden="true"><defs><clipPath id="mc-${esc(String(b.k).replace(/[^a-z0-9]/gi, ''))}"><circle cx="48" cy="62" r="38"/></clipPath></defs>${medalInner(b, tierOf(b, (game(me().id) || {}).list))}${b.done ? `<g clip-path="url(#mc-${esc(String(b.k).replace(/[^a-z0-9]/gi, ''))})"><rect class="shine" x="-30" y="20" width="16" height="90" fill="#fff" opacity=".55" transform="rotate(20 48 62)"/></g>` : ''}</svg>`}</span>`;
  const bName = b => b.title || T('b_' + b.k), bDesc = b => b.desc || T('bd_' + b.k), bSecret = b => b.hidden && !b.done;
  const medal = b => (bSecret(b) ? `<button class="mdl secret" data-act="badge" data-k="${esc(b.k)}" style="--p:0" aria-label="${T('b_secret')}">${medalArt(b)}<span class="mt">${T('b_secret')}</span><span class="muted small">&nbsp;</span></button>`
    : `<button class="mdl ${b.done ? 'done' : ''}" data-t="${b.track}" data-act="badge" data-k="${esc(b.k)}" style="--p:${Math.round(b.have / b.goal * 100)}" aria-label="${esc(bName(b))}">${medalArt(b)}<span class="mt">${esc(bName(b))}</span><span class="muted small num">${b.track === 'titles' ? nf(b.raw) + ' ' + T('tours_n') : b.track === 'master' ? '×' + nf(b.raw) : b.done ? T('b_done') : nf(b.have) + ' / ' + nf(b.goal)}</span></button>`);
  function badgeModalHtml(m) {
    const g = game(me().id), b = g.list.find(x => x.k === m.k); if (!b) return '';
    const head = `<div class="hdr"><span class="spacer"></span><button class="iconbtn" data-act="close" aria-label="${T('close')}">✕</button></div>`;
    if (bSecret(b)) return `${head}<div class="ccard"><span class="mdl big secret" style="--p:0">${medalArt(b)}</span><h2>${T('b_secret')}</h2><p class="muted">${T('bd_secret')}</p></div>`;
    return `${head}<div class="ccard"><span class="mdl big ${b.done ? 'done' : ''}" data-t="${b.track}" style="--p:${Math.round(b.have / b.goal * 100)}">${medalArt(b)}</span><h2>${esc(bName(b))}</h2><p class="muted">${esc(bDesc(b))}</p>
        ${b.track === 'titles' ? '' : `<b class="num">${nf(b.raw)} / ${nf(b.goal)} ${esc(b.unit)}</b><span class="meter" style="width:100%"><i style="width:${Math.round(b.have / b.goal * 100)}%"></i></span>`}${b.done && b.track !== 'master' ? `<span class="tag t-ok">${T('b_done')}</span>` : ''}${b.done && badgeAt(b.k) ? `<span class="muted small num">${T('b_on', { date: fmt(badgeAt(b.k), { day: 'numeric', month: 'long', year: 'numeric' }) })}</span>` : ''}</div>
      ${b.done ? `<div class="actions"><button class="btn" data-act="badgesave" data-k="${esc(b.k)}">${T('b_save')}</button><button class="btn primary" data-act="badgeshare" data-k="${esc(b.k)}">${ico('share')}${T('share')}</button></div>` : ''}`;
  }
  // ---------- a newly earned badge gets a full-screen moment ----------
  const seenKey = () => 'fs-badges-' + me().id;
  let celeTimer = null;
  function checkBadges() {
    clearTimeout(celeTimer);
    celeTimer = setTimeout(() => {
      if (!me() || !me().active || state.modal || window.__noCelebrate) return;
      const list = game(me().id).list, done = list.filter(b => b.done).map(b => b.k); let local = null;
      try { local = JSON.parse(S.ls.get(seenKey()) || 'null'); } catch (e) { local = null; }
      // Seen badges live on the account, so the welcome badge shows once per person, not once per phone.
      const acct = Array.isArray(me().badges_seen) ? me().badges_seen : null;
      let seen = acct || local ? [...new Set([...(acct || []), ...(local || [])])] : done.filter(k => k !== 'welcome');
      const fresh = done.filter(k => !seen.includes(k)); if (!fresh.length) { if (!acct && local) saveSeen(seen); return; }
      seen = [...seen, ...fresh]; S.ls.set(seenKey(), JSON.stringify(seen)); saveSeen(seen, fresh); track('badge');
      // Only the welcome badge and region titles get the full screen; other badges arrive as a small note.
      const big = fresh.find(k => k === 'welcome' || (list.find(b => b.k === k) || {}).track === 'titles');
      if (big) { state.modal = { type: 'celebrate', k: big, more: fresh.length - 1 }; renderModal(); fx.sheet(); }
      else badgeNote(fresh.map(k => list.find(b => b.k === k)).filter(Boolean));
    }, 900);
  }
  const badgeAt = k => ((me().display || {}).badgeAt || {})[k] || '';
  function saveSeen(seen, fresh) { if (S.mode === 'demo' && !me()) return; const d = (me().display && typeof me().display === 'object') ? me().display : {}, at = { ...(d.badgeAt || {}) }; (fresh || []).forEach(k => { if (!at[k]) at[k] = today(); }); S.save('profiles', { ...stripEmail(me()), badges_seen: seen, display: { ...d, badgeAt: at } }).catch(() => { /* kept on this phone until next time */ }); }
  function badgeNote(bs) {
    if (!bs.length) return; const old = document.querySelector('.bnote'); if (old) old.remove();
    const el = document.createElement('div'); el.className = 'bnote'; el.setAttribute('role', 'status');
    el.innerHTML = `<span class="mdl done" data-t="${esc(bs[0].track)}" style="--p:100">${medalArt(bs[0])}</span><span class="grow-l"><b>${esc(bs.length > 1 ? T('bn_many', { n: bs.length }) : T('bn_one'))}</b><span class="small">${esc(bs.map(bName).join(', '))}</span></span><button class="btn sm" data-act="bnview">${T('bn_view')}</button>`;
    document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('in')); setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 400); }, 7000);
  }
  function celebrateHtml(m) {
    const b = game(me().id).list.find(x => x.k === m.k); if (!b) return '';
    const cols = ['#f0901e', '#2f6b48', '#3b5bbd', '#20251f', '#e2b340', '#6243bd'], rib = RIBBON[b.track] || '#f0901e';
    const bits = [...Array(28)].map((_, i) => `<i style="left:${(i * 37) % 100}%;background:${cols[i % cols.length]};animation-delay:${(i % 9) * 0.12}s;animation-duration:${2.2 + (i % 5) * 0.35}s"></i>`).join('');
    // A gift box first: the person opens it with a tap, then the lid flies off and the medal comes out.
    const box = `<svg class="gbox" viewBox="0 0 200 190" aria-hidden="true"><g class="gbase"><rect x="30" y="86" width="140" height="94" rx="10" fill="#e9e3d2" stroke="#20251f" stroke-width="4"/><rect x="88" y="86" width="24" height="94" fill="${rib}" stroke="#20251f" stroke-width="4"/></g>
      <g class="glid"><rect x="20" y="56" width="160" height="36" rx="8" fill="#f1efe8" stroke="#20251f" stroke-width="4"/><rect x="88" y="56" width="24" height="36" fill="${rib}" stroke="#20251f" stroke-width="4"/><path d="M100 56c-26-34-58-18-40-2 10 8 26 6 40 2zm0 0c26-34 58-18 40-2-10 8-26 6-40 2z" fill="${rib}" stroke="#20251f" stroke-width="4" stroke-linejoin="round"/></g></svg>`;
    if (!m.opened) return `<div class="celebrate"><span class="muted">${T(b.track === 'titles' ? 'ce_title' : 'ce_new')}</span><button class="gboxbtn shake" data-act="celeopen" aria-label="${T('ce_open')}">${box}</button><h2>${T('ce_box')}</h2><div class="actions"><button class="btn primary big" data-act="celeopen">${T('ce_open')}</button></div></div>`;
    return `<div class="celebrate opened"><div class="confetti" aria-hidden="true">${bits}</div><span class="muted">${T(b.track === 'titles' ? 'ce_title' : 'ce_new')}</span>
      <div class="gstage"><span class="grays" aria-hidden="true"></span><span class="mdl big done pop" data-t="${b.track}" style="--p:100">${medalArt(b)}</span><span class="gboxbtn gone" aria-hidden="true">${box}</span></div><h2>${esc(bName(b))}</h2><p class="muted">${esc(bDesc(b))}</p><span class="muted small num">${T('b_on', { date: fmt(badgeAt(b.k) || today(), { day: 'numeric', month: 'long', year: 'numeric' }) })}</span>
      <div class="actions"><button class="btn" data-act="badgeshare" data-k="${esc(b.k)}">${ico('share')}${T('share')}</button><button class="btn primary big" data-act="celeok">${T('ce_ok')}</button></div></div>`;
  }

  // A square picture of an earned badge, drawn in the browser, to save or to send to colleagues, guests and friends.
  const xml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function wrapText(s, max) { const out = []; let line = ''; for (const w of String(s).split(/\s+/)) { if ((line + ' ' + w).trim().length > max && line) { out.push(line); line = w; } else line = (line + ' ' + w).trim(); } if (line) out.push(line); return out.slice(0, 4); }
  function badgeSvg(b) {
    const p = me(), colors = { titles: ['#20251f', '#f0901e'], fun: ['#20251f', '#ffffff'], geo: ['#2f6b48', '#ffffff'], driver: ['#3b5bbd', '#ffffff'], delica: ['#3b5bbd', '#ffffff'], own: ['#3b5bbd', '#ffffff'] }[b.track] || ['#f0901e', '#20251f'];
    const title = wrapText(bName(b), 22), desc = wrapText(bDesc(b), 44), font = 'font-family="-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif"';
    const count = b.track === 'titles' ? `${nf(b.raw)} ${T('tours_n')}` : b.track === 'master' ? `×${nf(b.raw)}` : b.unit ? `${nf(b.raw)} ${b.unit}` : '';
    let y = 660;
    const tl = title.map(l => { const s = `<text x="540" y="${y}" text-anchor="middle" font-size="68" font-weight="700" fill="#20251f" ${font}>${xml(l)}</text>`; y += 80; return s; }).join(''); y += 4;
    const dl = desc.map(l => { const s = `<text x="540" y="${y}" text-anchor="middle" font-size="34" fill="#55594f" ${font}>${xml(l)}</text>`; y += 46; return s; }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080"><rect width="1080" height="1080" fill="#f7f5ef"/><rect x="36" y="36" width="1008" height="1008" rx="56" fill="#ffffff" stroke="#d9d9d0" stroke-width="3"/>
      <g transform="translate(300 70) scale(5)">${medalInner({ ...b, done: true }, tierOf(b, (game(p.id) || {}).list), true)}</g>
      ${tl}${dl}${count ? `<text x="540" y="${y + 34}" text-anchor="middle" font-size="40" font-weight="700" fill="#20251f" ${font}>${xml(count)}</text>` : ''}
      <circle cx="96" cy="984" r="12" fill="#f0901e"/><text x="122" y="996" font-size="34" font-weight="700" fill="#20251f" ${font}>Friendly.ge</text>
      ${/^data:image\//.test(p.avatar || '') ? `<defs><clipPath id="av"><circle cx="948" cy="972" r="44"/></clipPath></defs><image href="${xml(p.avatar)}" x="904" y="928" width="88" height="88" preserveAspectRatio="xMidYMid slice" clip-path="url(#av)"/><circle cx="948" cy="972" r="44" fill="none" stroke="${colors[0]}" stroke-width="5"/><text x="884" y="984" text-anchor="end" font-size="34" fill="#55594f" ${font}>${xml(p.name || '')}</text>` : `<circle cx="948" cy="972" r="44" fill="${xml(p.color || '#66737f')}"/><text x="948" y="986" text-anchor="middle" font-size="38" font-weight="700" fill="#ffffff" ${font}>${xml(initials(p.name || '?'))}</text><text x="884" y="984" text-anchor="end" font-size="34" fill="#55594f" ${font}>${xml(p.name || '')}</text>`}</svg>`;
  }
  function badgePng(b) {
    return new Promise((res, rej) => { const img = new Image(), url = URL.createObjectURL(new Blob([badgeSvg(b)], { type: 'image/svg+xml;charset=utf-8' }));
      img.onload = () => { try { const c = document.createElement('canvas'); c.width = c.height = 1080; c.getContext('2d').drawImage(img, 0, 0); URL.revokeObjectURL(url); c.toBlob(bl => (bl ? res(bl) : rej(new Error('image'))), 'image/png'); } catch (e) { rej(e); } };
      img.onerror = () => rej(new Error('image')); img.src = url; });
  }
  async function badgeOut(k, share) {
    const b = game(me().id).list.find(x => x.k === k); if (!b) return;
    const text = T('b_share_text', { badge: bName(b) }), name = 'friendly-' + String(b.k).replace(/[^\w]+/g, '-').toLowerCase() + '.png';
    let blob = null; try { blob = await badgePng(b); } catch (e) { console.error(e); }
    const file = blob ? new File([blob], name, { type: 'image/png' }) : null;
    if (share) {
      try { if (file && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; } if (navigator.share) { await navigator.share({ text }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
      if (!blob) { window.open(waLink('', text), '_blank', 'noopener'); return; }
    }
    if (!blob) { toast(T('err_save')); return; }
    const el = document.createElement('a'); el.href = URL.createObjectURL(blob); el.download = name; document.body.appendChild(el); el.click(); el.remove(); toast(T('b_saved'));
  }


  // ---------- tips: the guide's Keepz link as a QR code guests can scan ----------
  // The QR library is fetched only the first time a QR code is shown, so it does not slow down opening the app.
  let qrLoading = null;
  function qrSvg(text) {
    if (!window.qrcode) {
      if (!qrLoading) qrLoading = new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = 'vendor/qrcode.js'; sc.onload = res; sc.onerror = rej; document.head.appendChild(sc); }).then(() => { render(); if (state.modal) renderModal(); }).catch(() => { qrLoading = null; });
      return '<div class="qr qrwait" aria-busy="true"></div>';
    }
    try { const q = window.qrcode(0, 'M'); q.addData(text); q.make(); const n = q.getModuleCount(); let p = '';
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) p += `M${c + 2} ${r + 2}h1v1h-1z`;
      return `<svg class="qr" viewBox="0 0 ${n + 4} ${n + 4}" role="img" aria-label="QR"><rect width="100%" height="100%" fill="#fff"/><path d="${p}" fill="#000"/></svg>`;
    } catch (e) { return ''; }
  }
  function shareModalHtml(m) {
    const tx = m.text || '', e = encodeURIComponent;
    return `<div class="hdr"><h2>${T('share')}</h2><button class="iconbtn" data-act="close" aria-label="${T('close')}">✕</button></div>
      <pre class="pre" id="sh-text">${esc(tx)}</pre>
      <div class="shgrid"><a class="btn primary" href="${esc(waLink('', tx))}" target="_blank" rel="noopener">WhatsApp</a><a class="btn" href="https://t.me/share/url?url=${e(tx)}" target="_blank" rel="noopener">Telegram</a><a class="btn" href="mailto:?subject=${e(m.title || '')}&body=${e(tx)}">${T('email')}</a><button class="btn" data-act="copy" data-v="${esc(tx)}">${ico('copy')}${T('copy')}</button></div>`;
  }
  // ---------- move a tour to another day or time (button, or drag and drop for the admin) ----------
  function openMove(t, o) { state.modal = { type: 'move', id: t.id, date: o.date || t.date, start: o.start !== undefined ? o.start : (t.start_time || ''), who: o.who || null, back: state.modal }; renderModal(); }
  function moveRow(m) {
    const t = db.tours.find(x => x.id === m.id); if (!t || !/^\d{4}-\d\d-\d\d$/.test(m.date || '')) return null;
    const delta = Math.round((D(m.date) - D(t.date)) / 864e5), dur = t.start_time && t.end_time && t.end_time > t.start_time ? mins(t.end_time) - mins(t.start_time) : 0;
    return { t, row: { ...t, date: m.date, date_to: t.date_to && t.date_to > t.date ? addDays(t.date_to, delta) : null, start_time: m.start || null, end_time: m.start && dur ? hhmm(mins(m.start) + dur) : (m.start ? t.end_time : null), ...(m.who || {}) } };
  }
  const moveWarnHtml = m => { const x = moveRow(m); if (!x) return ''; const same = x.row.date === x.t.date && (x.row.start_time || '') === (x.t.start_time || '') && !m.who; return (same ? `<div class="muted small">${T('mv_same')}</div>` : '') + tourWarnings({ ...x.row, bookings: tourBookings(x.t.id) }).map(w => `<div class="warnline ${w.lv === 'warn' ? 'soft' : ''}">! ${esc(w.tx)}</div>`).join(''); };
  function moveModalHtml(m) {
    const t = db.tours.find(x => x.id === m.id) || {}, who = m.who || {};
    const sw = k => (who[k] && who[k] !== t[k] ? `<div class="small"><span class="muted">${T(k === 'guide_id' ? 'guide' : 'driver')}:</span> ${esc(t[k] ? pname(t[k]) : T('unassigned'))} → <b>${esc(pname(who[k]))}</b></div>` : '');
    return `<div class="hdr"><h2>${T('mv_title')}</h2><button class="iconbtn" data-act="close" aria-label="${T('close')}">✕</button></div>
      <p class="muted small">${esc(t.title || '')} · <span class="num">${esc(t.date ? dateText(t) : '')} ${esc(t.start_time || '')}</span></p>
      <form class="f" data-form="move"><div class="two"><label>${T('mv_date')}<input id="mv-date" name="date" type="date" data-mv="date" required value="${esc(m.date)}"></label><label>${T('start')}<input id="mv-start" name="start" type="time" data-mv="start" value="${esc(m.start || '')}"></label></div>
      ${sw('guide_id')}${sw('driver_id')}<div id="mv-warn" class="f">${moveWarnHtml(m)}</div>
      <p class="muted small">${T('mv_note')}</p>
      <div class="actions"><button type="button" class="btn" data-act="close">${T('close')}</button><button class="btn primary">${T('mv_do')}</button></div></form>`;
  }
  async function moveSubmit() {
    const m = state.modal, x = moveRow(m); if (!x) return; const { t, row } = x;
    if (row.date === t.date && (row.start_time || '') === (t.start_time || '') && row.guide_id === t.guide_id && row.driver_id === t.driver_id) { closeModal(); return; }
    await S.save('tours', row);
    if (row.date !== t.date || (row.start_time || '') !== (t.start_time || '')) await addHistory(t.id, { w: 'moved', from: `${t.date} ${t.start_time || ''}`.trim(), to: `${row.date} ${row.start_time || ''}`.trim() });
    const before = [t.guide_id, t.driver_id].filter(Boolean), after = [row.guide_id, row.driver_id].filter(Boolean), np = { title: row.title, date: row.date, time: row.start_time || '' };
    if (live(row)) { await notify(after.filter(p => !before.includes(p)), 'tour_assigned', np); await notify(before.filter(p => !after.includes(p)), 'tour_removed', { title: t.title, date: t.date, time: t.start_time || '' }); if (row.date !== t.date || row.start_time !== t.start_time) await notify(after.filter(p => before.includes(p)), 'tour_changed', np); }
    logAct(`Moved tour: ${t.title}, ${t.date} ${t.start_time || ''} → ${row.date} ${row.start_time || ''}`);
    state.date = row.date; closeModal(); toast(T('mv_done', { date: fmtDay(row.date), time: row.start_time || '' }));
  }
  function tipModalHtml(m) {
    const url = tipUrl(), who = '';
    return `<div class="hdr"><h2>${T('tip_title')}</h2><button class="iconbtn" data-act="close" aria-label="${T('close')}">✕</button></div>
      <div class="ccard">${qrSvg(url)}<p class="muted small">${T('tip_text')}${who ? ' · ' + esc(who) : ''}</p><a class="lnk" href="${esc(url)}" target="_blank" rel="noopener">${esc(url.replace(/^https?:\/\//, ''))}</a></div>
      <div class="actions"><button class="btn" data-act="copy" data-v="${esc(url)}">${ico('copy')}${T('copy')}</button><button class="btn" data-act="share" data-title="${T('tip_title')}" data-v="${esc(T('tip_msg') + ' ' + url)}">${ico('share')}${T('share')}</button></div>`;
  }

  // ---------- team: add, edit, remove people ----------
  const appUrl = () => location.origin + location.pathname;
  const inviteText = i => T('invite_msg', { name: i.name || '', url: appUrl(), email: i.email });
  function personModalHtml(m) {
    const d = m.draft, self = d.id === me().id, old = !m.isNew;
    return `<div class="hdr"><h2>${T(old ? 'person_edit' : 'add_person')}</h2><button class="iconbtn" data-act="close" aria-label="${T('close')}">✕</button></div>
      <form class="f" data-form="person"><label>${T('name')}<input id="pe-name" data-f="name" value="${esc(d.name || '')}" required autocomplete="off"></label>
      <label>${T('role')}<select id="pe-role" data-f="role" ${self ? 'disabled' : ''}>${['guide', 'driver', 'admin'].map(x => opt(x, T('role_' + x), d.role)).join('')}</select></label>
      ${!old && S.mode !== 'demo' ? `<label>${T('email_login')}<input id="pe-email" data-f="email" type="email" value="${esc(d.email || '')}" required autocomplete="off" inputmode="email"></label><span class="muted small">${T('invite_text')}</span>` : ''}
      <div class="two"><label>${T('phone')}<input id="pe-phone" data-f="phone" type="tel" value="${esc(d.phone || '')}" placeholder="+995…" autocomplete="off"></label><label>${T('languages')}<input id="pe-langs" data-f="languages" value="${esc(d.languages || '')}" placeholder="EN, RU" autocomplete="off"></label></div>${d.role !== 'driver' ? `<label>${T('promo_own')}<input id="pe-promo" data-f="promo" value="${esc(d.promo ?? ((rules().promos || {})[d.id] || ''))}" placeholder="ANNA10" autocomplete="off"><span class="muted small">${T('promo_own_hint')}</span></label>` : ''}
      <label>Telegram<input id="pe-tg" data-f="telegram" value="${esc(d.telegram ? '@' + d.telegram : '')}" placeholder="@username" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
      <label>${T('colour')}<input id="pe-color" data-f="color" type="color" value="${esc(d.color || '#66737f')}" style="max-width:90px"></label>
      ${old && d.email ? `<div class="muted small">${T('email')}: ${esc(d.email)}</div>` : ''}
      <label>${T('vehicle')}<select id="pe-veh" data-f="vehicle">${opt('', T('veh_none'), d.vehicle || '')}${opt('own', T('veh_own'), d.vehicle)}${opt('delica', T('veh_delica'), d.vehicle)}</select></label>
      <details class="sect"><summary>${T('ws_person')}</summary><div class="f">${weekEditor(d)}</div></details>
      ${d.role === 'guide' || d.role === 'admin' ? `<details class="sect"><summary>${T('skills_title')} (${(d.skills || []).length || T('skills_all')})</summary><div class="f"><span class="muted small">${T('skills_text')}</span><div class="checks col">${catalog().filter(c => c.id).map(c => `<label><input type="checkbox" data-sk="${esc(String(c.id))}" ${(d.skills || []).includes(String(c.id)) ? 'checked' : ''}>${esc(c.title)}</label>`).join('')}</div></div></details>` : ''}
      <div class="actions">${old && !self ? `<button type="button" class="btn danger" data-act="pdelete" data-id="${d.id}">${T('delete_person')}</button><button type="button" class="btn" data-act="pactive" data-id="${d.id}">${T(d.active === false ? 'activate' : 'deactivate')}</button>` : ''}<button class="btn primary">${T('save')}</button></div></form>`;
  }
  async function savePerson(week) {
    const m = state.modal, d = m.draft, name = (d.name || '').trim(); if (!name) return;
    if ((d.telegram || '').trim() && !tgUser(d.telegram)) { toast(T('tg_bad')); return; }
    const f = { name, role: d.role || 'guide', phone: (d.phone || '').trim() || null, languages: (d.languages || '').trim() || null, telegram: tgUser(d.telegram) || null, color: d.color || '#66737f' };
    const extra = { skills: d.skills || [], vehicle: d.vehicle || null };
    if (d.promo !== undefined && d.id) { const pr = { ...(rules().promos || {}) }, code = String(d.promo || '').trim().toUpperCase(); if (code) pr[d.id] = code; else delete pr[d.id]; await S.save('settings', { id: 'rules', value: { ...rules(), promos: pr } }); }
    if (!m.isNew) { const p = person(d.id); await S.save('profiles', { ...stripEmail(p), ...f, ...extra, ...week, role: d.id === me().id ? p.role : f.role }); logAct(`Edited person: ${name}`); state.modal = null; toast(T('saved')); return; }
    if (S.mode === 'demo') { await S.save('profiles', { id: S.uid(), ...f, ...extra, ...week, lang: 'en', active: true }); logAct(`Added person: ${name}`); state.modal = null; toast(T('saved')); return; }
    const email = (d.email || '').trim().toLowerCase();
    if (db.invites.some(i => i.email === email)) { toast(T('err_exists')); return; }
    const inv = { id: S.uid(), email, ...f, ...extra, ...week, created_by: me().id, created_at: new Date().toISOString() };
    await S.save('invites', inv); logAct(`Invited ${name} (${f.role})`);
    state.modal = { type: 'invite', id: inv.id };
  }
  function inviteModalHtml(m) {
    const i = db.invites.find(x => x.id === m.id); if (!i) return `<div class="hdr"><h2>—</h2><button class="iconbtn" data-act="close">✕</button></div>`;
    return `<div class="hdr"><h2>${T('invite_ready')}</h2><button class="iconbtn" data-act="close" aria-label="${T('close')}">✕</button></div><p class="muted small">${T('invite_text')}</p>
      <div class="card small">${esc(inviteText(i))}</div>
      <div class="actions">${i.phone ? `<a class="btn" href="${esc(waLink(i.phone, inviteText(i)))}" target="_blank" rel="noopener">${ico('wa')}WhatsApp</a>` : ''}<button class="btn primary" data-act="copy" data-v="${esc(inviteText(i))}">${ico('copy')}${T('invite_copy')}</button></div>`;
  }
  // ---------- privacy: old guest details are removed, one guest can be exported or erased ----------
  async function privacyAuto() {
    if (!isAdmin() || !pv().auto || S.offline) return;
    const day = today(); if (S.ls.get('fs-purge-day') === day) return; S.ls.set('fs-purge-day', day);
    try { const n = await S.purgeGuests(pv().keepMonths); if (n) logAct(`Privacy clean-up: contact details of ${n} old guests removed`); } catch (e) { console.error(e); }
  }
  function exportGuest(id) {
    const c = db.clients.find(x => x.id === id); if (!c) return;
    const out = { exported: new Date().toISOString(), guest: c, bookings: db.bookings.filter(b => b.client_id === id).map(b => { const t = db.tours.find(x => x.id === b.tour_id) || {}; return { tour: t.title, date: t.date, guests: b.pax, adults: b.adults, children: b.children, phone: b.phone, reference: b.ref, source: b.source, payment: b.payment, marks: b.marks, notes: b.notes, attendance: b.attendance }; }), marks: db.client_ratings.filter(r => r.client_id === id).map(r => ({ mark: r.rating, note: r.note, date: (r.created_at || '').slice(0, 10) })) };
    const el = document.createElement('a'); el.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' })); el.download = `guest-${(c.name || 'data').replace(/[^\w]+/g, '-').toLowerCase()}.json`; document.body.appendChild(el); el.click(); el.remove();
    logAct(`Exported guest data: ${c.name}`);
  }

  // ---------- planning: season and suggested days off ----------
  function seasonByMonth() {
    const td = today(), per = {}, years = new Set();
    db.tours.forEach(t => { if (live(t) && t.date < td) { const y = t.date.slice(0, 4), m = Number(t.date.slice(5, 7)); years.add(y + '-' + m); per[m] = (per[m] || 0) + 1; } });
    const out = []; for (let m = 1; m <= 12; m++) { const n = [...years].filter(k => k.endsWith('-' + m)).length; out.push({ m, avg: n ? per[m] / n : 0, has: n > 0 }); }
    const known = out.filter(x => x.has), mean = known.length ? known.reduce((s, x) => s + x.avg, 0) / known.length : 0;
    out.forEach(x => { x.peak = x.has && mean > 0 && x.avg >= mean * 1.15; x.low = x.has && mean > 0 && x.avg <= mean * 0.8; });
    return { months: out, max: Math.max(1, ...out.map(x => x.avg)) };
  }
  function suggestDaysOff(weeks) {
    const k = 'sug' + weeks; if (memo[k]) return memo[k];
    const people = crew().filter(p => p.role !== 'admin'), res = {}, taken = {}, td = today();
    const hist = [0, 0, 0, 0, 0, 0, 0]; db.tours.forEach(t => { if (live(t) && t.date < td) hist[(D(t.date).getDay() + 6) % 7]++; });
    const hmax = Math.max(1, ...hist), start = addDays(monday(td), 7);
    db.time_off.forEach(o => { if (o.status !== 'declined') for (let d = o.date_from, i = 0; d <= o.date_to && i < 60; d = addDays(d, 1), i++) taken[d] = (taken[d] || 0) + 1; });
    for (let w = 0; w < weeks; w++) {
      const days = [...Array(7)].map((_, i) => addDays(start, w * 7 + i));
      const order = people.map((p, i) => people[(i + w) % people.length]);
      for (const p of order) {
        // a day off already asked for or approved in this week counts as this week's rest; sick days do not
        const offs = db.time_off.filter(o => o.user_id === p.id && o.status !== 'declined' && o.type !== 'sick' && o.date_from <= days[6] && o.date_to >= days[0]);
        if (offs.length) { offs.forEach(o => (res[p.id] = res[p.id] || []).push({ d: o.date_from < days[0] ? days[0] : o.date_from, to: o.date_to, st: o.status })); continue; }
        const cand = days.filter(d => !workDays(p.id).has(d) && !holidayOn(d) && !offOn(p.id, d));
        if (!cand.length) { (res[p.id] = res[p.id] || []).push({ d: days[0], st: 'full' }); continue; }
        const score = d => toursOnDay(d).length * 2 + (hist[(D(d).getDay() + 6) % 7] / hmax) * 2 + (taken[d] || 0) * 5 + (peakOn(d) ? 8 : 0);
        const best = cand.slice().sort((a, b) => score(a) - score(b))[0];
        (res[p.id] = res[p.id] || []).push({ d: best, st: 'sug' }); taken[best] = (taken[best] || 0) + 1;
      }
    }
    return memo[k] = res;
  }

  // ---------- time off ----------
  function dayCount(o, year) {
    const a = o.date_from < `${year}-01-01` ? `${year}-01-01` : o.date_from, b = o.date_to > `${year}-12-31` ? `${year}-12-31` : o.date_to;
    if (a > b) return 0; const n = daysBetween(a, b) + 1; return o.type === 'half' ? n * 0.5 : n;
  }
  function totals(id, year) {
    const offs = db.time_off.filter(o => o.user_id === id);
    const sum = f => offs.filter(f).reduce((s, o) => s + dayCount(o, year), 0);
    return { off: sum(o => o.status === 'approved' && o.type !== 'sick'), sick: sum(o => o.status !== 'declined' && o.type === 'sick'), pending: sum(o => o.status === 'pending') };
  }
  function offRow(o, admin) {
    const w = o.status === 'pending' ? offWarnings(o) : [];
    return `<div class="card"><div class="row">${avatar(o.user_id)}<b>${esc(pname(o.user_id))}</b>${offTag({ ...o, status: 'x' })}<span class="tag ${o.status === 'approved' ? 't-ok' : o.status === 'declined' ? 't-danger' : 't-warn'}">${T(o.status)}</span><span class="num">${esc(fmtRange(o.date_from, o.date_to))}</span><span class="muted num">${daysBetween(o.date_from, o.date_to) + 1} ${T('days')}</span></div>
      ${o.note ? `<div class="muted small">${esc(o.note)}</div>` : ''}${w.map(x => `<div class="warnline soft">! ${esc(x)}</div>`).join('')}
      <div class="actions">${admin && o.status === 'pending' ? `<button class="btn sm danger" data-act="offdecide" data-id="${o.id}" data-s="declined">${T('decline')}</button><button class="btn sm primary" data-act="offdecide" data-id="${o.id}" data-s="approved">${T('approve')}</button>` : ''}${(admin || (o.user_id === me().id && o.status === 'pending')) ? `<button class="btn sm" data-act="offdel" data-id="${o.id}">${T('remove')}</button>` : ''}</div></div>`;
  }
  function timeoffHtml() {
    const y = state.year, my = totals(me().id, y), td = today();
    const mine = db.time_off.filter(o => o.user_id === me().id).sort((a, b) => b.date_from.localeCompare(a.date_from));
    const pending = db.time_off.filter(o => o.status === 'pending').sort((a, b) => a.date_from.localeCompare(b.date_from));
    const upcoming = db.time_off.filter(o => o.status === 'approved' && o.date_to >= td && o.user_id !== me().id).sort((a, b) => a.date_from.localeCompare(b.date_from)).slice(0, 12);
    const hol = db.holidays.filter(h => h.date_to >= td).sort((a, b) => a.date_from.localeCompare(b.date_from)).slice(0, 6);
    let h = `<div class="bar"><h2>${T('nav_timeoff')}</h2><span class="spacer"></span><button class="btn primary" data-act="offnew">+ ${T('request')}</button>${helpBtn()}</div>${helpBox('timeoff')}
      <div class="stats"><div class="stat"><b>${my.off}</b>${T('days_off_year', { y })}</div><div class="stat"><b>${my.sick}</b>${T('sick_days')}</div><div class="stat"><b>${my.pending}</b>${T('pending')}</div></div>`;
    const sug = (suggestDaysOff(4)[me().id] || []).filter(x => x.st === 'sug').map(x => x.d);
    if (!isAdmin() && sug.length) h += `<div class="card"><b>${T('sug_title')}</b><span class="muted small">${T('sug_text')}</span><div class="bar">${sug.map(d => `<button class="btn sm" data-act="offnew" data-date="${d}">${esc(fmtDay(d))}</button>`).join('')}</div></div>`;
    if (isAdmin()) h += `<h3>${T('to_approve')} (${pending.length})</h3><div class="list">${pending.length ? pending.map(o => offRow(o, true)).join('') : `<div class="empty">${T('nothing_pending')}</div>`}</div>`;
    h += `<div class="cols"><div class="list"><h3>${T('my_requests')}</h3>${mine.length ? mine.map(o => offRow(o, isAdmin())).join('') : `<div class="empty">${T('no_requests')}</div>`}</div>
      <div class="list"><h3>${T('team_off')}</h3>${upcoming.length ? upcoming.map(o => `<div class="card lrow">${avatar(o.user_id)}<span class="lmain"><b>${esc(pname(o.user_id))}</b>${offTag(o)}</span><span class="num ldate">${esc(fmtRange(o.date_from, o.date_to))}</span></div>`).join('') : `<div class="empty">${T('nobody_off')}</div>`}
      <h3>${T('holidays')}</h3>${hol.length ? hol.map(x => `<div class="card lrow nohead"><span class="lmain"><span class="tag ${x.kind === 'event' ? 't-group' : 't-hol'}">${esc(x.name)}</span></span><span class="num ldate">${esc(fmtRange(x.date_from, x.date_to))}</span>${x.notes ? `<div class="muted small">${esc(x.notes)}</div>` : ''}</div>`).join('') : `<div class="empty">${T('no_holidays')}</div>`}</div></div>`;
    return h;
  }
  function offModalHtml(m) {
    const d = m.draft;
    return `<div class="hdr"><h2>${T('request')}</h2><button class="iconbtn" data-act="close" aria-label="${T('close')}">✕</button></div><form class="f" data-form="off">
      ${isAdmin() ? `<label>${T('person')}<select id="o-user" data-f="user_id">${staff().map(p => opt(p.id, p.name, d.user_id)).join('')}</select></label>` : ''}
      <label>${T('type')}<select id="o-type" data-f="type">${opt('dayoff', T('dayoff'), d.type)}${opt('half', T('halfday'), d.type)}${opt('sick', T('sick'), d.type)}</select></label>
      <div class="two"><label>${T('from')}<input id="o-from" data-f="date_from" type="date" value="${esc(d.date_from)}" required></label><label>${T('to')}<input id="o-to" data-f="date_to" type="date" value="${esc(d.date_to)}" required></label></div>
      <label>${T('note')}<input id="o-note" data-f="note" value="${esc(d.note || '')}"></label><div id="o-warn"></div>
      <div class="actions"><button type="button" class="btn" data-act="close">${T('close')}</button><button class="btn primary">${T('send')}</button></div></form>`;
  }
  function refreshOffWarn() {
    const m = state.modal, el = $('#o-warn'); if (!m || m.type !== 'off' || !el) return;
    const d = m.draft; if (!d.date_from || !d.date_to || d.date_to < d.date_from) { el.innerHTML = ''; return; }
    el.innerHTML = offWarnings({ ...d, created_at: new Date().toISOString() }).map(x => `<div class="warnline soft">! ${esc(x)}</div>`).join('');
  }
  async function saveOff() {
    const d = state.modal.draft;
    if (!d.date_from || !d.date_to || d.date_to < d.date_from) { toast(T('bad_dates')); return; }
    const byAdmin = isAdmin(), status = byAdmin || d.type === 'sick' ? 'approved' : 'pending';
    const row = { id: S.uid(), user_id: byAdmin ? (d.user_id || me().id) : me().id, date_from: d.date_from, date_to: d.date_to, type: d.type, status, note: d.note || null, created_at: new Date().toISOString(), decided_by: byAdmin ? me().id : null };
    await S.save('time_off', row);
    logAct(`${T('request')}: ${pname(row.user_id)}, ${row.type}, ${row.date_from} to ${row.date_to}`);
    const np = { name: pname(row.user_id), from: row.date_from, to: row.date_to };
    if (!byAdmin) await notify(admins(), d.type === 'sick' ? 'sick_reported' : 'off_requested', np);
    else await notify([row.user_id], 'off_approved', np);
    state.modal = null;
  }

  // ---------- tasks ----------
  function taskCard(k) {
    const mineTask = (k.assignees || []).includes(me().id), can = mineTask || isAdmin(), tour = k.tour_id ? db.tours.find(t => t.id === k.tour_id) : null;
    const late = k.status === 'open' && k.due_date && k.due_date < today();
    return `<div class="card"><div class="row"><input type="checkbox" id="tk-${k.id}" data-ch="taskdone" data-id="${k.id}" ${k.status === 'done' ? 'checked' : ''} ${can ? '' : 'disabled'} style="width:20px;height:20px" aria-label="${T('done')}"><label for="tk-${k.id}" class="ttl" style="flex:1;min-width:0;${k.status === 'done' ? 'text-decoration:line-through;opacity:.7' : ''}">${esc(taskTitle(k))}</label>${isAdmin() ? `<button class="btn sm" data-act="taskedit" data-id="${k.id}">${T('edit')}</button>` : ''}</div>
      <div class="row"><span class="pair">${(k.assignees || []).map(id => `<span class="p">${avatar(id)}${esc(pname(id))}</span>`).join('<span class="plus">+</span>') || `<span class="tag t-warn">${T('unassigned')}</span>`}</span>${k.due_date ? `<span class="tag ${late ? 't-danger' : 't-muted'} num">${esc(fmtDay(k.due_date))}</span>` : ''}${tour ? `<button class="btn sm" data-act="tour" data-id="${tour.id}">${esc(tour.title)}</button>` : ''}</div>
      ${k.notes ? `<div class="muted small">${esc(k.notes)}</div>` : ''}${k.status === 'done' && k.done_by ? `<div class="muted small">${T('done_by', { name: pname(k.done_by) })}</div>` : ''}</div>`;
  }
  // Getting started: what each person does once. Shown in Tasks and as a reminder on the calendar, ticked by itself when done.
  const botOn = () => /^https:\/\/t\.me\//.test(rules().botUrl || '');
  function setupSteps(p = me()) {
    if (!p || S.mode !== 'supabase' && !window.__fsSetupDemo) return [];
    const st = [{ k: 'details', done: !!(p.phone && String(p.languages || '').trim()) }, { k: 'photo', done: !!p.avatar }];
    if (p.role === 'guide') st.push({ k: 'tours', done: !!((p.display || {}).toursOk) });
    // Telegram: with the bot set up, the step is linking the bot (tours, changes and free-tour offers arrive there); otherwise the username.
    st.push({ k: 'tg', done: !!(p.display || {}).tgSkip || (botOn() ? !!p.telegram_id : !!p.telegram) });   // not everyone uses Telegram: the step can be skipped
    return st;
  }
  function setupCard(compact) {
    const st = setupSteps(), left = st.filter(x => !x.done).length; if (!st.length || !left) return '';
    if (compact) return `<button class="banner small setupban" data-act="gosetup"><span>${T('su_banner', { n: st.length - left, all: st.length })}</span><b>${T('su_finish')} ›</b></button>`;
    return `<div class="card f setupcard"><b>${T('su_title')}</b><span class="muted">${T('su_text')}</span>${st.map(x => `<button class="surow ${x.done ? 'done' : ''}" data-act="gosetup" data-k="${x.k}"><span class="sudot">${x.done ? '✓' : ''}</span><span class="grow-l">${T('su_' + x.k)}</span>${x.done ? '' : '<b>›</b>'}</button>${x.k === 'tg' && !x.done ? `<button class="lnk suskip" data-act="tgskip">${T('su_tg_skip')}</button>` : ''}`).join('')}</div>`;
  }
  function myToursHtml(m) {
    const ids = new Set(m.skills || []), all = !ids.size, list = catalog().filter(c => c.id), sel = state.myTours || new Set(all ? list.map(c => String(c.id)) : [...ids]);
    return `<div class="card f" id="me-tours"><b>${T('mt_title')}</b><span class="muted">${T(all ? 'mt_text_all' : 'mt_text')}</span>${(m.display || {}).toursOk ? `<span class="tag t-ok">${T('mt_ok', { date: fmtDay(m.display.toursOk) })}</span>` : ''}
      <div class="mslist mt">${list.map(c => `<label><input type="checkbox" data-ch="mytour" data-v="${c.id}" ${sel.has(String(c.id)) ? 'checked' : ''}><span>${esc(c.title)}</span></label>`).join('')}</div>
      <div class="actions"><button class="btn primary" data-act="mytoursok">${T(state.myTours ? 'mt_send' : 'mt_right')}</button></div></div>`;
  }
  // Tour exchange: upcoming tours that still need a guide (for guides) or a driver (for drivers). "I can do it" asks the office; pressed by mistake = take it back.
  // The language the guests asked for (from the tour and its bookings), so a guide knows before saying "I can do it".
  const tourLangs = t => [...new Set([t.language, ...tourBookings(t.id).map(b => b.lang)].map(x => String(x || '').trim().toUpperCase()).filter(Boolean))];
  const langTags = t => { const l = tourLangs(t); return l.length ? ` <span class="tag t-muted ltag" title="${T('lang_tour')}">${msi('language')}${esc(l.join(' · '))}</span>` : ''; };
  // Delica drivers are offered only the off-road rides the Delica is for.
  const RIDE_4X4 = /4\s*[x×х]\s*4|4\s*wd|delica/i;   // by the tour name only: not every Kazbegi tour is a 4x4 ride (owner, 11 Nov)
  function openTours() {
    const m = me(); if (!m || isAdmin()) return []; const role = m.role === 'driver' ? 'driver' : 'guide', td = today(), to = addDays(td, 30);
    return db.tours.filter(t => live(t) && t.date >= td && t.date <= to && !involves(t, m.id) && (role === 'guide' ? !t.guide_id : (!t.driver_id && kmOf(t.title) > 0 && (m.vehicle !== 'delica' || RIDE_4X4.test(t.title)))) && !offOn(m.id, t.date))
      .sort((x, y) => (x.date + (x.start_time || '')).localeCompare(y.date + (y.start_time || ''))).map(t => ({ t, role, mine: db.change_requests.find(q => q.tour_id === t.id && q.user_id === m.id && q.status === 'pending') }));
  }
  // Admins: confirmed tours in the next 30 days that still have no guide, or no driver where one is needed.
  function unstaffed() { if (!isAdmin()) return []; const td = today(), to = addDays(td, 30); return db.tours.filter(t => live(t) && t.date >= td && t.date <= to && (!t.guide_id || (!t.driver_id && kmOf(t.title) > 0))).sort((x, y) => (x.date + (x.start_time || '')).localeCompare(y.date + (y.start_time || ''))); }
  const tasksBadge = () => db.tasks.filter(k => k.status === 'open' && (k.assignees || []).includes(me().id)).length;
  function unstaffedHtml() {
    const list = unstaffed(); if (!list.length) return '';
    return `<div class="card f xcard"><b>${T('us_title', { n: list.length })}</b><span class="muted">${T('us_text')}</span>${list.slice(0, 15).map(t => `<div class="xrow"><button class="grow-l arow" data-act="tour" data-id="${t.id}">${emblem(t)}<span><b class="num">${esc(fmt(t.date, { weekday: 'short', day: 'numeric', month: 'short' }))} ${esc(t.start_time || '')}</b> ${esc(aliasOf(t.title))}${langTags(t)}</span></button><span class="tag t-warn">${T(!t.guide_id && !t.driver_id && kmOf(t.title) > 0 ? 'us_both' : !t.guide_id ? 'us_guide' : 'us_driver')}</span></div>`).join('')}${list.length > 15 ? `<span class="muted small">+ ${list.length - 15}</span>` : ''}</div>`;
  }
  function exchangeHtml() {
    const list = openTours(); if (!list.length) return '';
    return `<div class="card f xcard"><b>${T('xc_title', { n: list.length })}</b><span class="muted">${T('xc_text')}</span>${list.slice(0, 12).map(({ t, role, mine }) => `<div class="xrow"><button class="grow-l arow" data-act="tour" data-id="${t.id}">${emblem(t)}<span><b class="num">${esc(fmt(t.date, { weekday: 'short', day: 'numeric', month: 'short' }))} ${esc(t.start_time || '')}</b> ${esc(aliasOf(t.title))}${langTags(t)}</span></button>${mine ? `<span class="xasked"><span class="tag t-off">${T('xc_asked')}</span><button class="lnk" data-act="xcback" data-id="${mine.id}">${T('xc_back')}</button></span>` : `<button class="btn sm primary" data-act="xctake" data-id="${t.id}" data-role="${role}">${T('xc_can')}</button>`}</div>`).join('')}</div>`;
  }
  function tasksHtml() {
    const f = state.taskFilter, admin = isAdmin();
    const list = db.tasks.filter(k => (admin && !state.mine) || (k.assignees || []).includes(me().id)).filter(k => f === 'all' || k.status === f).sort((a, b) => (a.due_date || '9').localeCompare(b.due_date || '9'));
    // Two sections: real tasks, and tours that still need someone. They are different jobs, so they do not share a list or a number.
    const nOpen = admin ? unstaffed().length : openTours().length, sec = state.taskSec === 'tours' && nOpen ? 'tours' : 'tasks', nTasks = tasksBadge();
    const head = `<div class="bar thead"><h2>${T('tasks')}</h2><span class="spacer"></span>${admin ? `<button class="btn primary only-wide" data-act="tasknew">+ ${T('task')}</button>` : ''}${helpBtn()}</div>${helpBox('tasks')}
      ${nOpen ? `<div class="seg tsec"><button data-act="tasksec" data-v="tasks" aria-pressed="${sec === 'tasks'}">${T('tasks')}${nTasks ? ` <span class="segn num">${nTasks}</span>` : ''}</button><button data-act="tasksec" data-v="tours" aria-pressed="${sec === 'tours'}">${T(admin ? 'ts_tours' : 'ts_take')} <span class="segn num">${nOpen}</span></button></div>` : ''}`;
    if (sec === 'tours') return head + exchangeHtml() + unstaffedHtml();
    return head + `<div class="bar tfilt"><div class="seg">${['open', 'done', 'all'].map(x => `<button data-act="taskfilter" data-v="${x}" aria-pressed="${f === x}">${T('f_' + x)}</button>`).join('')}</div>
      ${admin ? `<div class="seg"><button data-act="mine" data-v="0" aria-pressed="${!state.mine}">${T('team')}</button><button data-act="mine" data-v="1" aria-pressed="${!!state.mine}">${T('mine')}</button></div>` : ''}</div>
      ${admin && !state.viewAs ? `<button class="btn primary fab xfab only-phone" data-act="tasknew">${msi('add_task')}${T('task_new')}</button>` : ''}
      ${nOpen ? `<button class="banner small setupban" data-act="tasksec" data-v="tours"><span>${admin ? T('us_title', { n: nOpen }) : T('xc_banner', { n: nOpen })}</span><b>${T('xc_see')} ›</b></button>` : ''}${setupCard()}<div class="list">${list.length ? list.map(taskCard).join('') : setupSteps().some(x => !x.done) ? '' : `<div class="empty">${T('no_tasks')}</div>`}</div>`;
  }
  function taskModalHtml(m) {
    const d = m.draft;
    return `<div class="hdr"><h2>${T(m.isNew ? 'new_task' : 'edit_task')}</h2><button class="iconbtn" data-act="close" aria-label="${T('close')}">✕</button></div><form class="f" data-form="task">
      <label>${T('title')}<input id="k-title" data-f="title" value="${esc(d.title)}" required></label>
      <label>${T('due')}<input id="k-due" data-f="due_date" type="date" value="${esc(d.due_date || '')}"></label>
      <div class="f"><b>${T('assignees')}</b><span class="muted small">${T('pair_hint')}</span><div class="checks">${staff().map(p => `<label><input type="checkbox" id="ka-${p.id}" data-as="${p.id}" ${d.assignees.includes(p.id) ? 'checked' : ''}>${esc(p.name)} <span class="muted small">${T('role_' + p.role)}</span></label>`).join('')}</div></div>
      <label>${T('notes')}<textarea id="k-notes" data-f="notes">${esc(d.notes || '')}</textarea></label>
      <div class="actions">${!m.isNew ? `<button type="button" class="btn danger" data-act="taskdel">${T('remove')}</button>` : ''}<button type="button" class="btn" data-act="close">${T('close')}</button><button class="btn primary">${T('save')}</button></div></form>`;
  }
  async function saveTask() {
    const m = state.modal, d = m.draft, old = db.tasks.find(k => k.id === d.id);
    if (!(d.title || '').trim()) { toast(T('need_title')); return; }
    const row = { id: d.id, title: d.title.trim(), notes: d.notes || null, due_date: d.due_date || null, assignees: d.assignees, status: d.status || 'open', tour_id: d.tour_id || null, created_by: d.created_by || me().id, done_by: d.done_by || null, done_at: d.done_at || null };
    await S.save('tasks', row);
    await notify(row.assignees.filter(x => !old || !(old.assignees || []).includes(x)), 'task_assigned', { title: row.title, date: row.due_date || '' });
    state.modal = null;
  }

  // ---------- back office ----------
  const payTitles = () => Object.entries(db.tours.reduce((a, t) => (a[t.title] = (a[t.title] || 0) + 1, a), {})).sort((a, b) => b[1] - a[1]).slice(0, 40).map(x => x[0]);
  function report(year) {
    return crew().map(p => {
      const days = [...workDays(p.id)].filter(d => d.startsWith(String(year))).sort(), t = totals(p.id, year);
      let best = 0, cur = 0, prev = null; const weeks = {};
      for (const d of days) { cur = prev && addDays(prev, 1) === d ? cur + 1 : 1; best = Math.max(best, cur); prev = d; const w = monday(d); weeks[w] = (weeks[w] || 0) + 1; }
      return { p, days: days.length, off: t.off, sick: t.sick, best, heavy: Object.values(weeks).filter(n => n >= 6).length };
    });
  }
  // Same guest saved twice (same phone, same email, or same name where one has no phone): offer to join them.
  function dupGroups() {
    const par = {}, f = x => (par[x] === x ? x : (par[x] = f(par[x]))), u = (x, y) => { par[f(x)] = f(y); }, by = {};
    const cs = db.clients.filter(c => !c.anonymised_at); cs.forEach(c => { par[c.id] = c.id; });
    cs.forEach(c => { const d = digits(c.phone).slice(-9), e = (c.email || '').toLowerCase(), n = (c.name || '').toLowerCase().trim(); if (d.length >= 7) (by['p' + d] = by['p' + d] || []).push(c); if (e) (by['e' + e] = by['e' + e] || []).push(c); if (n.length > 3) (by['n' + n] = by['n' + n] || []).push(c); });
    Object.entries(by).forEach(([k, l]) => { if (l.length < 2) return; if (k[0] === 'n' && new Set(l.map(c => digits(c.phone).slice(-9)).filter(Boolean)).size > 1) return; l.slice(1).forEach(c => u(c.id, l[0].id)); });
    const g = {}; cs.forEach(c => { (g[f(c.id)] = g[f(c.id)] || []).push(c); });
    return Object.values(g).filter(l => l.length > 1);
  }
  function dupHtml(cnt) {
    const gs = dupGroups(); if (!gs.length) return '';
    return `<details class="sect"><summary>${T('dup_title')} (${gs.length})</summary><p class="muted small">${T('dup_text')}</p><div class="list">${gs.slice(0, 30).map(l => { const ids = l.map(c => c.id).join(','), ask = state.mergeAsk === ids; return `<div class="card f"><div class="list">${l.map(c => `<div class="row small"><b>${esc(c.name)}</b><span class="muted num">${esc([c.phone, c.email, T('bookings_n') + ': ' + (cnt[c.id] || 0)].filter(Boolean).join(' · '))}</span></div>`).join('')}</div><div class="bar">${ask ? `<span class="small">${T('dup_sure')}</span><button class="btn sm" data-act="mergeno">${T('close')}</button><button class="btn sm primary" data-act="mergedo" data-ids="${ids}">${T('dup_merge')}</button>` : `<button class="btn sm" data-act="mergeask" data-ids="${ids}">${T('dup_merge')}</button>`}</div></div>`; }).join('')}</div></details>`;
  }
  const lastBackup = () => ((db.settings.find(x => x.id === 'backup') || {}).value || {}).at || '';
  const backupDue = () => { const l = lastBackup(); return !l || daysBetween(l.slice(0, 10), today()) >= 7; };
  async function readRestore(file) { const d = JSON.parse(await file.text()); if (!d || !Array.isArray(d.tours) || !Array.isArray(d.profiles)) throw new Error(T('rs_bad')); state.restore = { exported: d.exported, data: d }; }
  async function runRestore() {
    const d = state.restore.data; let n = 0;
    // Only adds back and overwrites rows from the file; nothing that is in the app now is deleted. People: only existing accounts are updated.
    for (const t of S.TABLES) { if (!Array.isArray(d[t]) || !d[t].length) continue; let rows = d[t]; if (t === 'profiles') rows = rows.filter(p => db.profiles.some(x => x.id === p.id)).map(stripEmail); await S.saveMany(t, rows); n += rows.length; }
    logAct(`Restored backup from ${d.exported || '?'} (${n} rows)`); state.restore = null; toast(T('rs_done', { n }));
  }
  // One tour written in different ways ("Kazbegi 4WD", "Kazbegi 4x4", "Gareji 4x4 PRIVATE") counts as one tour in statistics.
  const tourKey = t => String(t || '').toLowerCase().replace(/[×х]/g, 'x').replace(/\b4\s*(wd|x\s*4|by4)\b/g, '4x4').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  // Names the admin joined in Back office > Tour statistics > Join tour names: { key of a name: the name it counts as }.
  const tourAlias = () => rules().tourAlias || {};
  const aliasOf = t => tourAlias()[tourKey(t)] || t;
  const statKey = t => tourKey(aliasOf(t));
  // Similar names: same place words (also with a typo or in Russian letters), and both private or both not.
  const CYR = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
  const TN_STOP = /^(tour|tours|from|tbilisi|to|day|days|one|trip|small|group|private|guided|half|full|georgia|the|and|of|in|a|an|eng|en|ru|4x4|by|with|ancient|capital|real|life|excursion|walking)$/;
  const tnCore = t => tourKey(t).replace(/[а-яё]/g, c => CYR[c] ?? c).replace(/[^a-z0-9 ]+/g, ' ').split(' ').filter(w => w && !TN_STOP.test(w));
  const tnPriv = t => (/private|приват|индив/i.test(t) ? 1 : 0);
  const editDist = (a, b) => { if (Math.abs(a.length - b.length) > 2) return 9; let prev = [...Array(b.length + 1).keys()]; for (let i = 1; i <= a.length; i++) { const cur = [i]; for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; } return prev[b.length]; };
  const sameWord = (x, y) => x === y || (x.length >= 5 && y.length >= 5 && editDist(x, y) <= (Math.min(x.length, y.length) >= 7 ? 2 : 1));
  const tnScore = (a, b) => { const A = tnCore(a), B = tnCore(b); if (!A.length || !B.length || tnPriv(a) !== tnPriv(b)) return 0; let n = 0; A.forEach(w => { if (B.some(v => sameWord(w, v))) n++; }); return n / Math.max(A.length, B.length); };
  // Every tour name in the loaded data, joined names as one unit: [{ key, main, names: {title: n}, n }]
  function tnUnits() {
    const u = {}; db.tours.forEach(t => { const k = statKey(t.title), x = u[k] = u[k] || { key: k, names: {}, n: 0 }; x.names[t.title] = (x.names[t.title] || 0) + 1; x.n++; });
    return Object.values(u).map(x => ({ ...x, main: tourAlias()[Object.keys(x.names).map(tourKey).find(k => tourAlias()[k])] || Object.entries(x.names).sort((p, q) => q[1] - p[1])[0][0] })).sort((p, q) => q.n - p.n);
  }
  function tnSuggest(units) {
    const mains = [], groups = new Map();
    units.forEach(u => { let best = null, bs = 0; mains.forEach(m => { const sc = tnScore(m.main, u.main); if (sc > bs) { bs = sc; best = m; } }); if (best && bs >= 0.5) groups.get(best).push({ u, strong: bs >= 0.67 }); else { mains.push(u); groups.set(u, []); } });
    return [...groups].filter(([, l]) => l.length).map(([m, l]) => ({ m, l }));
  }
  function tnamesHtml() {
    const units = tnUnits(), sug = tnSuggest(units), joined = units.filter(u => Object.keys(u.names).length > 1 && Object.keys(u.names).some(n => tourAlias()[tourKey(n)]));
    const tick = (u, on) => `<label class="tnrow"><input type="checkbox" value="${esc(u.main)}" data-n="${u.n}" ${on ? 'checked' : ''}><span>${esc(u.main)}</span><span class="muted num">${T('tn_tours', { n: u.n })}</span></label>`;
    return `<div class="hdr"><h2>${T('tn_title')}</h2><button class="iconbtn" data-act="close" aria-label="${T('close')}">✕</button></div>
      <p class="muted">${T('tn_text')}</p>
      ${sug.length ? `<h3>${T('tn_maybe')}</h3>${sug.map(g => `<div class="card tncard">${tick(g.m, true)}${g.l.map(x => tick(x.u, x.strong)).join('')}<div class="bar"><span class="spacer"></span><button class="btn primary" data-act="tnjoin">${T('tn_join')}</button></div></div>`).join('')}` : `<p class="muted">${T('tn_none')}</p>`}
      ${joined.length ? `<h3>${T('tn_joined')}</h3>${joined.map(u => `<div class="card"><b>${esc(u.main)}</b><span class="muted">${esc(Object.keys(u.names).filter(n => n !== u.main).join(', '))}</span><div class="bar"><span class="spacer"></span><button class="btn" data-act="tnsplit" data-v="${esc(u.main)}">${T('tn_split')}</button></div></div>`).join('')}` : ''}
      <h3>${T('tn_all')}</h3><div class="card tncard">${units.map(u => tick(u, false)).join('')}<div class="bar tnsticky"><span class="spacer"></span><button class="btn primary" data-act="tnjoin">${T('tn_join_ticked')}</button></div></div>`;
  }
  async function tnSave(al) { await S.save('settings', { id: 'rules', value: { ...rules(), tourAlias: al } }); }
  // "viator", "Viator" and "VIATOR" are one booking source.
  const SRC_NAMES = { viator: 'Viator', getyourguide: 'GetYourGuide', gyg: 'GetYourGuide', klook: 'Klook', 'trip.com': 'Trip.com', tripcom: 'Trip.com', airbnb: 'Airbnb', freetour: 'FreeTour', website: 'Website', direct: 'Direct', trekksoft: 'Website', civitatis: 'Civitatis', tourradar: 'TourRadar' };
  const srcName = v => { const t = String(v || '').trim(); if (!t) return ''; const k = t.toLowerCase().replace(/\s+/g, ''); return SRC_NAMES[k] || t.charAt(0).toUpperCase() + t.slice(1); };
  function tourStats(y) {
    const ts = db.tours.filter(t => live(t) && t.date.slice(0, 4) === String(y)), prev = db.tours.filter(t => live(t) && t.date.slice(0, 4) === String(y - 1));
    const by = {}, wd = [0, 0, 0, 0, 0, 0, 0], wdT = [{}, {}, {}, {}, {}, {}, {}], mon = Array(12).fill(0), monP = Array(12).fill(0), src = {}, kinds = {}, lang = {};
    const names = {}; ts.forEach(t => { const k = statKey(t.title); (names[k] = names[k] || {})[t.title] = (names[k][t.title] || 0) + 1; }); ts.forEach(t => { const k = statKey(t.title), w = (D(t.date).getDay() + 6) % 7, g = Number(t.pax) || 0; const r = by[k] = by[k] || { key: k, title: Object.keys(names[k]).map(n => tourAlias()[tourKey(n)]).find(Boolean) || Object.entries(names[k]).sort((p, q) => q[1] - p[1])[0][0], spell: Object.keys(names[k]), n: 0, guests: 0, cx: 0, ns: 0, last: '' }; r.n++; r.guests += g; if (t.date > r.last) r.last = t.date; wd[w] += g; wdT[w][k] = (wdT[w][k] || 0) + 1; mon[Number(t.date.slice(5, 7)) - 1] += g; kinds[t.kind] = (kinds[t.kind] || 0) + g; if (t.language) lang[t.language] = (lang[t.language] || 0) + 1; });
    prev.forEach(t => { monP[Number(t.date.slice(5, 7)) - 1] += Number(t.pax) || 0; });
    const cxT = db.tours.filter(t => !live(t) && t.date.slice(0, 4) === String(y)), why = {}; let cxG = 0;
    cxT.forEach(t => { const k = statKey(t.title); if (by[k]) by[k].cx++; cxG += Number(t.pax) || 0; const w = (t.cancel_reason || '').trim() || T('ts_no_reason'); why[w] = (why[w] || 0) + 1; });
    const td = today(), tk = {}; ts.forEach(t => { tk[t.id] = t; }); let nsN = 0, nsAll = 0; const nsSrc = {};
    db.bookings.forEach(b => { const t = tk[b.tour_id]; if (!t || t.date >= td) return; nsAll++; const s = srcName(sourceOf(b) || b.source) || T('ts_unknown'); nsSrc[s] = nsSrc[s] || [0, 0]; nsSrc[s][1]++; if (b.attendance === 'noshow') { nsN++; nsSrc[s][0]++; const k = statKey(t.title); if (by[k]) by[k].ns++; } });
    const ids = new Set(ts.map(t => t.id)); db.bookings.forEach(b => { if (ids.has(b.tour_id)) { const s = srcName(sourceOf(b) || b.source) || T('ts_unknown'); src[s] = (src[s] || 0) + (Number(b.pax) || 0); } });
    const top = Object.values(by).sort((p, q) => q.guests - p.guests);
    const days = [...Array(7)].map((_, w) => ({ w, guests: wd[w], top: Object.entries(wdT[w]).sort((p, q) => q[1] - p[1]).map(([k, n]) => [by[k] ? by[k].title : k, n])[0] }));
    const total = mon.reduce((s, x) => s + x, 0), totalP = monP.reduce((s, x) => s + x, 0);
    return { top, days, mon, monP, total, totalP, tours: ts.length, toursP: prev.length, src, kinds, lang, cx: cxT.length, cxG, why, nsN, nsAll, nsSrc };
  }
  // The year in a few lines: best guests, busiest days, most profitable tour, busiest and best paid people. Money is after platform commission, in the main currency.
  function yearHighlights(y) {
    const Y = String(y), ts = db.tours.filter(t => live(t) && t.date.slice(0, 4) === Y), tk = {}; ts.forEach(t => { tk[t.id] = t; });
    const net = b => (Number(b.price) ? netOf(b) * (rateOf(b.currency || guestCur(), (tk[b.tour_id] || {}).date) || 0) : 0), bks = db.bookings.filter(b => tk[b.tour_id]);
    const top = (o, f) => Object.entries(o).sort((p, q) => f(q[1]) - f(p[1]))[0];
    const cl = {}; bks.forEach(b => { if (!b.client_id) return; const c = cl[b.client_id] = cl[b.client_id] || { n: 0, m: 0 }; c.n++; c.m += net(b); });
    const loyal = top(cl, c => c.n * 1e9 + c.m), spend = top(cl, c => c.m), cname = id => esc((db.clients.find(c => c.id === id) || {}).name || T('guest'));
    const day = {}, wk = {}; ts.forEach(t => { const g = Number(t.pax) || 0; day[t.date] = (day[t.date] || 0) + g; const w = monday(t.date); wk[w] = (wk[w] || 0) + g; });
    const bDay = top(day, v => v), bWk = top(wk, v => v), big = bks.slice().sort((p, q) => (Number(q.pax) || 0) - (Number(p.pax) || 0))[0];
    const tour = {}; ts.forEach(t => { const k = statKey(t.title), x = tour[k] = tour[k] || { title: aliasOf(t.title), rev: 0, cost: 0 }; x.cost += payFor(t, 'guide') * (t.guide_id ? 1 : 0) + payFor(t, 'driver') * (t.driver_id ? 1 : 0) + costOf(t.id).total; });
    bks.forEach(b => { const x = tour[statKey(tk[b.tour_id].title)]; if (x) x.rev += net(b); });
    const prof = top(tour, x => x.rev - x.cost), ppl = {};
    ts.forEach(t => [['guide', t.guide_id], ['driver', t.driver_id]].forEach(([r, id]) => { if (!id) return; const x = ppl[id] = ppl[id] || { days: new Set(), pay: 0, rev: 0 }; tourDays(t).forEach(d => x.days.add(d)); x.pay += payFor(t, r); }));
    bks.forEach(b => { const t = tk[b.tour_id], x = t.guide_id && ppl[t.guide_id]; if (x) x.rev += net(b); });
    const pick = (role, f) => top(Object.fromEntries(Object.entries(ppl).filter(([id]) => (person(id) || {}).role === role || (role === 'guide' && (person(id) || {}).role === 'admin'))), f);
    const cur = esc(rules().currency || 'GEL'), m = v => `${nf(Math.round(v))} ${cur}`, line = (k, v) => (v ? `<div class="yhrow"><span class="muted">${T(k)}</span><b>${v}</b></div>` : '');
    const busyG = pick('guide', x => x.days.size), busyD = pick('driver', x => x.days.size), richG = pick('guide', x => x.pay), richD = pick('driver', x => x.pay), profG = pick('guide', x => x.rev);
    const who = (e, f) => (e ? `${esc(pname(e[0]))} · ${f(e[1])}` : '');
    const html = [line('yh_loyal', loyal && loyal[1].n > 1 ? `${cname(loyal[0])} · ${T('yh_times', { n: loyal[1].n })}` : ''), line('yh_spend', spend && spend[1].m > 0 ? `${cname(spend[0])} · ${m(spend[1].m)}` : ''),
      line('yh_day', bDay ? `${esc(fmtDay(bDay[0]))} · ${T('yh_guests', { n: bDay[1] })}` : ''), line('yh_week', bWk ? `${esc(fmtRange(bWk[0], addDays(bWk[0], 6)))} · ${T('yh_guests', { n: bWk[1] })}` : ''),
      line('yh_group', big && Number(big.pax) > 1 ? `${esc(big.guest)} · ${T('yh_guests', { n: big.pax })} · ${esc(aliasOf(tk[big.tour_id].title))}` : ''), line('yh_tour', prof && prof[1].rev > 0 ? `${esc(prof[1].title)} · ${m(prof[1].rev - prof[1].cost)}` : ''),
      line('yh_prof_guide', profG && profG[1].rev > 0 ? who(profG, x => m(x.rev)) : ''), line('yh_busy_guide', who(busyG, x => T('yh_days', { n: x.days.size }))), line('yh_busy_driver', who(busyD, x => T('yh_days', { n: x.days.size }))),
      line('yh_rich_guide', richG && richG[1].pay > 0 ? who(richG, x => m(x.pay)) : ''), line('yh_rich_driver', richD && richD[1].pay > 0 ? who(richD, x => m(x.pay)) : '')].join('');
    return html ? `<div class="card f"><b>${T('yh_title', { y })}</b><div class="yh">${html}</div><span class="muted small">${T('yh_note')}</span></div>` : '';
  }
  function statsTabHtml(y) {
    const s = tourStats(y), wn = w => fmt(addDays('2024-01-01', w), { weekday: 'long' }), mx = Math.max(1, ...s.mon, ...s.monP), wmx = Math.max(1, ...s.days.map(d => d.guests));
    const pct = (a, b) => (b ? `${a >= b ? '+' : '−'}${Math.round(Math.abs(a - b) / b * 100)}%` : '—'), busiest = s.days.slice().sort((p, q) => q.guests - p.guests)[0];
    const trendUp = s.top.filter(r => { const p = db.tours.filter(t => live(t) && statKey(t.title) === r.key && t.date.slice(0, 4) === String(y - 1)).reduce((n, t) => n + (Number(t.pax) || 0), 0); r.prev = p; return true; });
    const share = o => { const tot = Object.values(o).reduce((a, b) => a + b, 0) || 1; return Object.entries(o).sort((p, q) => q[1] - p[1]).map(([k, v]) => `<div class="row small"><span style="min-width:110px">${esc(k)}</span><span class="meter" style="flex:1"><i style="width:${Math.round(v / tot * 100)}%"></i></span><span class="num">${Math.round(v / tot * 100)}%</span></div>`).join(''); };
    return `<div class="bar"><div class="seg"><button data-act="year" data-d="-1">‹</button><button disabled>${y}</button><button data-act="year" data-d="1">›</button></div><span class="muted small">${T('ts_loaded', { date: S.loadedFrom ? fmtDay(S.loadedFrom) : '—' })}</span></div>
      <div class="stats"><div class="stat"><b>${nf(s.tours)}</b>${T('tours_n')} <span class="muted small num">${s.toursP ? pct(s.tours, s.toursP) : ''}</span></div><div class="stat"><b>${nf(s.total)}</b>${T('guests')} <span class="muted small num">${s.totalP ? pct(s.total, s.totalP) : ''}</span></div><div class="stat"><b>${s.tours ? (s.total / s.tours).toFixed(1) : '—'}</b>${T('ts_avg')}</div><div class="stat"><b>${busiest && busiest.guests ? esc(wn(busiest.w)) : '—'}</b>${T('ts_busiest')}</div></div>
      ${isAdmin() ? yearHighlights(y) : ''}
      <div class="card f"><b>${T('ts_months', { y, p: y - 1 })}</b><div class="bars two">${s.mon.map((v, m) => `<div class="barcol" title="${v} / ${s.monP[m]}"><span class="num bv">${v ? (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v) : ''}</span><span class="pair"><i class="prev" style="height:${Math.round(s.monP[m] / mx * 100)}%"></i><i style="height:${Math.round(v / mx * 100)}%"></i></span><span class="bm">${esc(fmt(`2024-${p2(m + 1)}-01`, { month: 'short' }).slice(0, 3))}</span></div>`).join('')}</div><div class="row small"><span class="lg"><i class="sq" style="background:var(--accent)"></i>${y}</span><span class="lg"><i class="sq" style="background:var(--line)"></i>${y - 1}</span></div></div>
      <div class="card f"><b>${T('ts_week')}</b>${s.days.map(d => `<div class="row small"><span style="min-width:110px">${esc(wn(d.w))}</span><span class="meter" style="flex:1"><i style="width:${Math.round(d.guests / wmx * 100)}%"></i></span><span class="num" style="min-width:40px;text-align:right">${d.guests}</span><span class="muted wkmost" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.top ? esc(T('ts_mostly', { t: d.top[0] })) : ''}</span></div>`).join('')}</div>
      <div class="card f"><div class="bar"><b>${T('ts_top')}</b><span class="spacer"></span>${isAdmin() ? `<button class="btn sm" data-act="tnames">${T('tn_btn')}</button>` : ''}</div><div class="tablewrap"><table><tr><th>${T('tour')}</th><th class="n">${T('tours_n')}</th><th class="n">${T('guests')}</th><th class="n">${T('ts_avg_s')}</th><th class="n">${y - 1}</th><th class="n">${T('ts_trend')}</th><th class="n">${T('ts_noshow')}</th><th class="n">${T('cancelled')}</th></tr>${trendUp.map(r => `<tr><td>${esc(r.title)}${r.spell.length > 1 ? `<div class="muted small">${T('ts_spell')}: ${esc(r.spell.filter(x => x !== r.title).join(', '))}</div>` : ''}</td><td class="n">${r.n}</td><td class="n">${r.guests}</td><td class="n">${(r.guests / r.n).toFixed(1)}</td><td class="n">${r.prev || '—'}</td><td class="n ${r.prev && r.guests < r.prev ? 'down' : r.prev ? 'up' : ''}">${pct(r.guests, r.prev)}</td><td class="n">${r.ns || ''}</td><td class="n">${r.cx || ''}</td></tr>`).join('') || `<tr><td colspan="8" class="muted">${T('no_tours')}</td></tr>`}</table></div></div>
      <div class="card f"><b>${T('ts_ns_title')}</b>
        <div class="stats"><div class="stat"><b>${nf(s.nsN)}</b>${T('ts_noshow')} <span class="muted small num">${s.nsAll ? Math.round(s.nsN / s.nsAll * 100) + '%' : '—'} ${T('ts_of_bookings', { n: nf(s.nsAll) })}</span></div><div class="stat"><b>${nf(s.cx)}</b>${T('ts_cx_tours')}</div><div class="stat"><b>${nf(s.cxG)}</b>${T('ts_cx_guests')}</div></div>
        ${Object.keys(s.nsSrc).length ? `<b class="small">${T('ts_ns_src')}</b>${Object.entries(s.nsSrc).sort((p, q) => q[1][0] - p[1][0] || q[1][1] - p[1][1]).map(([k, [n, all]]) => `<div class="row small"><span style="min-width:110px">${esc(k)}</span><span class="meter" style="flex:1"><i style="width:${all ? Math.round(n / all * 100) : 0}%"></i></span><span class="num" style="min-width:76px;text-align:right">${n} / ${all}</span></div>`).join('')}` : ''}
        ${Object.keys(s.why).length ? `<b class="small">${T('ts_cx_why')}</b>${share(s.why)}` : ''}</div>
      <div class="cols"><div class="card f"><b>${T('ts_sources')}</b>${share(s.src) || `<span class="muted small">—</span>`}</div><div class="card f"><b>${T('ts_kinds')}</b>${share(Object.fromEntries(Object.entries(s.kinds).map(([k, v]) => [T('kind_' + k), v]))) || '—'}<b>${T('ts_langs')}</b>${share(s.lang) || '—'}</div></div>`;
  }
  // Who can work which days next week (set on Sunday evening), how many filled it in, and a reminder for the others.
  function availHtml(wk) {
    const ppl = crew().filter(p => p.role !== 'admin'), days = [0, 1, 2, 3, 4, 5, 6].map(i => addDays(wk, i)), set = ppl.filter(p => availOf(p, wk)), miss = ppl.filter(p => !availOf(p, wk));
    const cell = (p, d, i) => { const o = offOn(p.id, d); if (o) return `<td class="avc off">${T(o.type === 'sick' ? 'sick' : 'dayoff')}</td>`; const x = weekOf(p, wk)[i], busy = toursOnDay(d).some(t => involves(t, p.id)); return `<td class="avc ${x ? 'on' : 'no'} ${availOf(p, wk) ? '' : 'usual'}">${x ? esc(x[0] && x[1] ? `${x[0].slice(0, 5)}–${x[1].slice(0, 5)}` : T('av_any')) : '—'}${busy ? ' ●' : ''}</td>`; };
    return `<div class="bar"><div class="seg"><button data-act="availwk" data-d="-7">‹</button><button disabled>${esc(fmtRange(wk, addDays(wk, 6)))}</button><button data-act="availwk" data-d="7">›</button></div></div>
      <div class="tsum"><b>${T('av_filled', { n: set.length, all: ppl.length })}</b>${miss.length ? `<span>${T('av_missing')}: ${miss.map(p => esc(p.name)).join(', ')}</span><div><button class="btn sm" data-act="availremind" data-wk="${wk}">${T('av_remind')}</button></div>` : ''}</div>
      <p class="muted small">${T('av_legend')}</p>
      <div class="tablewrap"><table class="avt"><tr><th>${T('name')}</th>${days.map(d => `<th class="n">${esc(fmt(d, { weekday: 'short', day: 'numeric' }))}</th>`).join('')}</tr>${ppl.map(p => `<tr><td><span class="row nw">${avatar(p.id)}${esc(p.name)}</span></td>${days.map((d, i) => cell(p, d, i)).join('')}</tr>`).join('')}</table></div>`;
  }
  // Work balance: who works how much this month, so tours, rest and pay stay fair between guides and between drivers.
  const selfDrive = (t, p) => t.guide_id === p.id && (t.driver_id === p.id || (!t.driver_id && !!p.vehicle && kmOf(t.title) > 0));
  function balanceRows(mo) {
    const from = mo + '-01', to = monthEnd(mo), td = today();
    return crew().filter(p => p.role !== 'admin').map(p => {
      const ts = db.tours.filter(t => live(t) && involves(t, p.id) && endOf(t) >= from && t.date <= to), days = new Set();
      ts.forEach(t => tourDays(t).forEach(d => { if (d >= from && d <= to) days.add(d); }));
      let streak = 0; days.forEach(d => { streak = Math.max(streak, streakAt(p.id, d)); });
      let off = 0; db.time_off.forEach(o => { if (o.user_id !== p.id || o.status !== 'approved' || o.type === 'sick' || o.date_to < from || o.date_from > to) return; off += daysBetween(o.date_from > from ? o.date_from : from, o.date_to < to ? o.date_to : to) + 1; });
      return { p, role: p.role === 'driver' ? 'driver' : 'guide', days: days.size, tours: ts.length, self: ts.filter(t => selfDrive(t, p)).length, streak, off, pay: payData(p.id, from, to).total, ahead: [...days].filter(d => d >= td).length };
    });
  }
  function balanceHtml(mo) {
    const rows = balanceRows(mo), r = rules(), cur = esc(r.currency || 'GEL'), pctOf = (v, a) => (a ? Math.round((v - a) / a * 100) : 0);
    const part = role => {
      const rs = rows.filter(x => x.role === role); if (!rs.length) return '';
      const avg = k => rs.reduce((n, x) => n + x[k], 0) / rs.length, aDays = avg('days'), aPay = avg('pay');
      const flag = x => { const dp = pctOf(x.days, aDays), pp = pctOf(x.pay, aPay); return dp >= 25 || pp >= 25 || x.streak > r.maxStreak ? 'over' : (aDays && dp <= -25) ? 'under' : ''; };
      const next = rs.slice().sort((x, y) => x.days - y.days || x.pay - y.pay).slice(0, 2).map(x => x.p.name);
      return `<div class="card f"><div class="bar"><b>${T(role === 'driver' ? 'bl_drivers' : 'bl_guides')}</b><span class="spacer"></span><span class="muted small num">${T('bl_avg', { d: aDays.toFixed(1), p: nf(Math.round(aPay)), c: cur })}</span></div>
        <div class="tablewrap"><table><tr><th>${T('name')}</th><th class="n">${T('bl_days')}</th><th class="n">${T('tours_n')}</th>${role === 'guide' ? `<th class="n">${T('bl_self')}</th>` : ''}<th class="n">${T('bl_streak')}</th><th class="n">${T('bl_off')}</th><th class="n">${T('bl_pay')}</th><th class="n">${T('bl_vs')}</th></tr>
        ${rs.sort((x, y) => y.days - x.days || y.pay - x.pay).map(x => { const f = flag(x), pp = pctOf(x.pay, aPay); return `<tr class="bl-${f}"><td><span class="row nw">${avatar(x.p.id)}<span>${esc(x.p.name)}</span></span>${f ? `<div class="small blnote">${T(f === 'over' ? 'bl_less' : 'bl_more')}</div>` : ''}</td><td class="n">${x.days}</td><td class="n">${x.tours}</td>${role === 'guide' ? `<td class="n">${x.self || ''}</td>` : ''}<td class="n ${x.streak > r.maxStreak ? 'down' : ''}">${x.streak || ''}</td><td class="n">${x.off || ''}</td><td class="n">${nf(Math.round(x.pay))}</td><td class="n">${aPay ? (pp > 0 ? '+' : '') + pp + '%' : '—'}</td></tr>`; }).join('')}</table></div>
        <div class="tsum">${T('bl_next', { names: next.join(', ') })}</div></div>`;
    };
    return `<div class="bar"><div class="seg"><button data-act="balm" data-d="-1">‹</button><button disabled>${esc(fmt(mo + '-01', { month: 'long', year: 'numeric' }))}</button><button data-act="balm" data-d="1">›</button></div></div>
      <p class="muted">${T('bl_text', { n: r.maxStreak })}</p>${part('guide')}${part('driver')}`;
  }
  // Achievements of the whole team, for the admin.
  function achvTabHtml() {
    const rows = crew().filter(p => p.role !== 'admin').map(p => { const g = game(p.id), done = g.list.filter(b => b.done); return { p, g, done, titles: g.list.filter(b => b.track === 'titles' && b.done) }; }).sort((x, y) => y.g.xp - x.g.xp);
    const cnt = {}; rows.forEach(r => r.done.forEach(b => { cnt[b.k] = cnt[b.k] || { b, n: 0 }; cnt[b.k].n++; }));
    const common = Object.values(cnt).sort((x, y) => y.n - x.n);
    return `<p class="muted small">${T('ac_text')}</p><div class="tablewrap"><table><tr><th>${T('name')}</th><th>${T('role')}</th><th class="n">${T('level')}</th><th class="n">XP</th><th class="n">${T('badges')}</th><th>${T('ac_titles')}</th><th>${T('ac_next')}</th></tr>${rows.map(r => { const nx = r.g.list.filter(b => !b.done && !b.hidden && b.have > 0 && b.track !== 'master').sort((x, y) => y.have / y.goal - x.have / x.goal)[0]; return `<tr><td><span class="row nw">${avatar(r.p.id)}<span>${esc(r.p.name)}</span></span></td><td>${T('role_' + r.p.role)}</td><td class="n">${r.g.level}</td><td class="n">${nf(r.g.xp)}</td><td class="n">${r.done.length}/${r.g.list.length}</td><td class="wrapcell small">${esc(r.titles.map(bName).join(' · '))}</td><td style="white-space:normal" class="small">${nx ? `${esc(bName(nx))} <span class="muted num">${nf(nx.have)}/${nf(nx.goal)}</span>` : ''}</td></tr>`; }).join('')}</table></div>
      <div class="card f"><b>${T('ac_common')}</b>${common.slice(0, 12).map(x => `<div class="row small"><span style="flex:1">${esc(bName(x.b))}</span><span class="num">${x.n}/${rows.length}</span></div>`).join('') || `<span class="muted small">—</span>`}${common.length ? `<span class="muted small">${T('ac_rare')}: ${esc(common.slice(-5).map(x => bName(x.b)).join(', '))}</span>` : ''}</div>`;
  }
  function adminHtml() {
    const tab = state.adminTab, r = rules(), y = state.year;
    const groups = [['g_daily', ['requests', 'tours', 'email', 'clients']], ['g_team', ['team', 'avail', 'balance', 'pay', 'plan', 'holidays']], ['g_numbers', ['stats', 'reports', 'achv', 'usage']], ['g_setup', ['catalog', 'rules', 'import', 'backup', 'privacy', 'log', 'problems']]], tabs = groups.flatMap(x => x[1]);
    if (!tab) return `<div class="bar"><h2>${T('nav_admin')}</h2><span class="spacer"></span>${helpBtn()}</div>${helpBox('admin')}${S.mode === 'supabase' || window.__fsLookAsDemo ? `<div class="card f vapick"><b>${T('va_title')}</b><span class="muted small">${T('va_text')}</span><div class="bar"><select class="inp" id="va-who">${crew().filter(p => p.id !== S.me.id).map(p => opt(p.id, `${p.name} · ${T('role_' + p.role)}`, '')).join('')}</select><button class="btn primary" data-act="vastart">${T('va_go')}</button></div></div>` : ''}${backupDue() ? `<div class="banner small"><span>${lastBackup() ? T('bk_due', { date: fmtDay(lastBackup().slice(0, 10)) }) : T('bk_never')}</span><button class="btn sm primary" data-act="backup">${T('bk_download')}</button></div>` : ''}${groups.map(([gk, gt]) => `<h3>${T(gk)}</h3><div class="tiles">${gt.map(x => `<button class="card" data-act="admintab" data-v="${x}"><span class="ttl">${T('a_' + x)}${x === 'requests' && db.change_requests.some(q => q.status === 'pending') ? ` <span class="badge">${db.change_requests.filter(q => q.status === 'pending').length}</span>` : ''}${x === 'pay' && db.pay_disputes.some(q => q.status === 'open') ? ` <span class="badge">${db.pay_disputes.filter(q => q.status === 'open').length}</span>` : ''}</span><span class="muted small">${T('ad_' + x)}</span></button>`).join('')}</div>`).join('')}`;
    let h = `<div class="bar"><button class="btn sm" data-act="admintab" data-v="">‹ ${T('nav_admin')}</button><h2>${T('a_' + tab)}</h2><span class="spacer"></span>${helpBtn()}</div>${helpBox('admin')}`;
    if (tab === 'stats') return h + statsTabHtml(y);
    if (tab === 'achv') return h + achvTabHtml();
    if (tab === 'balance') return h + balanceHtml(state.balMonth || today().slice(0, 7));
    if (tab === 'avail') return h + availHtml(state.availWk || addDays(monday(today()), 7));
    if (tab === 'problems') {
      if (!state.errs) { S.fetchErrors().then(r => { state.errs = r; render(); }).catch(e => { state.errs = []; toast(T('err_save') + ': ' + e.message); render(); }); return h + `<p class="muted">${T('loading')}</p>`; }
      const kinds = { error: T('pr_error'), save: T('pr_save'), offline: T('pr_offline'), report: T('pr_report') };
      const when = x => new Intl.DateTimeFormat(LOCALES[lang()], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(x));
      // Filter by person and hide plain connection gaps, so real problems from guides' phones are easy to spot.
      const who = [...new Set(state.errs.map(x => x.user_id).filter(Boolean))], wk = Date.now() - 7 * 864e5;
      const errsAll = state.errs, shown = errsAll.filter(x => (!state.errWho || x.user_id === state.errWho) && (!state.errNoOff || x.kind !== 'offline'));
      const week = errsAll.filter(x => new Date(x.at).getTime() > wk && x.kind !== 'offline');
      const filt = `<div class="bar"><select class="inp" id="err-who" data-ch="errwho" style="max-width:240px"><option value="">${T('pr_all')} (${errsAll.length})</option>${who.map(id => `<option value="${id}" ${state.errWho === id ? 'selected' : ''}>${esc(pname(id))} (${errsAll.filter(x => x.user_id === id).length})</option>`).join('')}</select><label class="pdy small"><input type="checkbox" id="err-nooff" data-ch="errnooff" ${state.errNoOff ? 'checked' : ''}>${T('pr_nooff')}</label></div><p class="small">${T('pr_week', { n: week.length, p: new Set(week.map(x => x.user_id)).size })}</p>`;
      state.errs = shown;
      try {
      return h + `<p class="muted small">${T('pr_text')}</p><details class="sect"><summary>${T('ec_title')}</summary><dl class="fields">${ERR_CODES.map(k => `<dt>${k}</dt><dd>${esc(T('ec_' + k))}</dd>`).join('')}</dl></details><div class="bar"><button class="btn sm" data-act="errreload">${T('refresh')}</button>${state.errs.length ? `<button class="btn sm" data-act="errclear">${T('pr_clear')}</button>` : ''}</div>${filt}
        <div class="list">${state.errs.map(x => `<details class="card f"><summary class="row nw"><span class="tag ${x.kind === 'offline' ? 't-muted' : x.kind === 'report' ? 't-group' : 't-warn'}">${esc(kinds[x.kind] || x.kind)}</span><span class="grow-l small">${esc(x.message)}</span><span class="muted small num">${esc(when(x.at))}</span></summary>
          <div class="muted small">${esc([x.user_id ? pname(x.user_id) : '', x.page, x.device, x.version && 'v' + x.version].filter(Boolean).join(' · '))}</div>${x.detail ? `<pre class="pre small">${esc(x.detail)}</pre>` : ''}</details>`).join('') || `<div class="empty">${T('pr_none')}</div>`}</div>`;
      } finally { state.errs = errsAll; }
    }
    const cur = r.currency || 'GEL';
    if (tab === 'tours') {
      const mo = state.listMonth || today().slice(0, 7), q = (state.q || '').toLowerCase();
      const list = db.tours.filter(t => t.date.slice(0, 7) <= mo && endOf(t).slice(0, 7) >= mo).filter(t => !q || [t.title, pname(t.guide_id), pname(t.driver_id), ...tourBookings(t.id).map(b => b.guest + ' ' + (b.ref || ''))].join(' ').toLowerCase().includes(q)).sort((a, b) => (a.date + (a.start_time || '')).localeCompare(b.date + (b.start_time || '')));
      const sum = k => list.filter(live).reduce((x, t) => x + (Number(t[k]) || 0), 0);
      h += `<div class="bar"><input class="inp" type="month" id="lm" data-ch="listmonth" value="${esc(mo)}" style="max-width:170px" aria-label="${T('month')}"><input class="inp" id="lq" data-ch="q" value="${esc(state.q || '')}" placeholder="${T('search')}" style="max-width:240px"><span class="spacer"></span><button class="btn" data-act="csv">${T('export_csv')}</button><button class="btn primary" data-act="newtour">+ ${T('tour')}</button></div>
        <div class="stats"><div class="stat"><b>${list.filter(live).length}</b>${T('tours_n')}</div><div class="stat"><b>${sum('adults')}</b>${T('adults')}</div><div class="stat"><b>${sum('children')}</b>${T('children')}</div></div>
        <div class="tablewrap"><table><tr><th>${T('date')}</th><th>${T('start')}</th><th>${T('title')}</th><th>${T('type')}</th><th>${T('guide')}</th><th>${T('driver')}</th><th class="n">${T('adults')}</th><th class="n">${T('children')}</th><th></th></tr>
        ${list.map(t => `<tr${live(t) ? '' : ' style="opacity:.55"'}><td class="num">${esc(dateText(t))}</td><td class="num">${esc(t.start_time || '')}</td><td><button class="btn sm" data-act="tour" data-id="${t.id}">${esc(t.title)}</button></td><td>${T('kind_' + t.kind)}</td><td>${esc(pname(t.guide_id))}</td><td>${esc(pname(t.driver_id))}</td><td class="n">${t.adults ?? t.pax ?? 0}</td><td class="n">${t.children || 0}</td><td>${live(t) ? (tourWarnings(t).length ? `<span class="tag t-warn">!</span>` : '') : `<span class="tag t-danger">${T('cancelled')}</span>`}</td></tr>`).join('') || `<tr><td colspan="9" class="muted">${T('no_tours')}</td></tr>`}</table></div>${list.some(t => costOf(t.id).total) ? `<p class="small">${T('cost_month')}: <b class="num">${nf(list.reduce((n, t) => n + costOf(t.id).total, 0))} ${esc(cur)}</b> <span class="muted">(${COSTS.map(k => [k, list.reduce((n, t) => n + (Number(costOf(t.id).items[k]) || 0), 0)]).filter(x => x[1]).map(x => T('cost_' + x[0]) + ' ' + nf(x[1])).join(' · ')})</span></p>` : ''}`;
    }
    if (tab === 'clients') {
      if (state.gcOpen) h += guestCheckHtml();
      const q = (state.q || '').toLowerCase(), cnt = {}; db.bookings.forEach(b => { if (b.client_id) cnt[b.client_id] = (cnt[b.client_id] || 0) + 1; });
      const refs = {}; db.bookings.forEach(b => { if (b.client_id && b.ref) refs[b.client_id] = (refs[b.client_id] || '') + ' ' + b.ref; });
      const list = db.clients.filter(c => (!q || ((c.name || '') + ' ' + (c.phone || '') + ' ' + digits(c.phone) + ' ' + (c.email || '') + (refs[c.id] || '')).toLowerCase().includes(q)) && (!state.vipOnly || isVip(c.id))).sort((a, b) => (cnt[b.id] || 0) - (cnt[a.id] || 0) || (a.name || '').localeCompare(b.name || '')).slice(0, 100);
      h += `<div class="bar"><input class="inp" id="cq" data-ch="q" value="${esc(state.q || '')}" placeholder="${T('search')}" style="max-width:280px"><button class="btn sm" data-act="gcopen" aria-pressed="${!!state.gcOpen}">${T('gc_btn')}</button><button class="btn sm" data-act="viponly" aria-pressed="${!!state.vipOnly}">${T('vip_only')}</button><span class="muted small num">${db.clients.length} ${T('clients_n')}</span></div><p class="muted small">${T('vip_rule')}</p>${dupHtml(cnt)}
        <div class="tablewrap"><table><tr><th>${T('name')}</th><th>${T('phone')}</th><th>${T('phone_country')}</th><th class="n">${T('bookings_n')}</th><th>${T('rating')}</th></tr>${list.map(c => `<tr><td><button class="btn sm" data-act="client" data-id="${c.id}">${esc(c.name)}</button> ${vipTag(c.id)}</td><td class="num">${esc(c.phone || '')}</td><td>${esc(phoneCountry(c.phone))}</td><td class="n">${cnt[c.id] || 0}</td><td>${ratingTag(c.id)}</td></tr>`).join('') || `<tr><td colspan="5" class="muted">${T('no_clients')}</td></tr>`}</table></div>`;
    }
    if (tab === 'plan') {
      const se = seasonByMonth(), sug = suggestDaysOff(4);
      h += `<div class="card"><b>${T('season_title')}</b><span class="muted small">${T('season_text')}</span><div class="bars">${se.months.map(x => `<div class="barcol"><span class="num small">${x.has ? Math.round(x.avg) : ''}</span><i class="${x.peak ? 'peak' : x.low ? 'low' : ''}" style="height:${Math.round(x.avg / se.max * 100)}%"></i><span class="small">${esc(fmt(`2024-${p2(x.m)}-01`, { month: 'short' }))}</span></div>`).join('')}</div><div class="row small"><span class="tag t-custom">${T('peak')}</span><span class="tag t-ok">${T('quiet')}</span></div></div>
        <div class="card"><b>${T('sug_title')}</b><span class="muted small">${T('sug_admin')}</span><details class="sect"><summary>${T('sug_how')}</summary><ul class="small"><li>${T('sug_r1')}</li><li>${T('sug_r2')}</li><li>${T('sug_r3')}</li><li>${T('sug_r4')}</li><li>${T('sug_r5')}</li></ul><b class="small">${T('peaks_title')}</b><ul class="small">${peaks().map(p => `<li class="num">${esc(fmtDay(p.from))} – ${esc(fmtDay(p.to))}: ${esc(p.name)}</li>`).join('')}</ul></details>
        <div class="sugrow sughd"><span></span>${[0, 1, 2, 3].map(w => `<span class="muted small num">${esc(fmtRange(addDays(monday(today()), 7 * (w + 1)), addDays(monday(today()), 7 * (w + 1) + 6)))}</span>`).join('')}</div>
        <div class="suglist">${crew().filter(p => p.role !== 'admin').map(p => { const items = sug[p.id] || [], wk = [0, 1, 2, 3].map(w => { const a = addDays(monday(today()), 7 * (w + 1)), b = addDays(a, 6); return items.filter(x => x.d >= a && x.d <= b); });
          return `<div class="sugrow"><span class="row nw sugwho">${avatar(p.id)}<b>${esc(p.name)}</b></span>${wk.map(xs => `<span class="sugcell">${xs.map(x => x.st === 'sug' ? `<button class="sugc" data-act="offnew" data-date="${x.d}" data-who="${p.id}">${esc(fmt(x.d, { weekday: 'short', day: 'numeric', month: 'short' }))}</button>` : x.st === 'full' ? `<span class="sugc none">${T('sug_full')}</span>` : `<span class="sugc ${x.st === 'approved' ? 'ok' : 'wait'}"><span class="small">${T(x.st === 'approved' ? 'sug_has' : 'sug_asked')}</span>${esc(x.to && x.to !== x.d ? fmtRange(x.d, x.to) : fmt(x.d, { weekday: 'short', day: 'numeric', month: 'short' }))}</span>`).join('') || `<span class="sugc none">—</span>`}</span>`).join('')}</div>`; }).join('')}</div></div>`;
    }
    if (tab === 'pay') {
      const prg = payRange(), mo = prg.month || today().slice(0, 7), pr = r.pay || {}, open = db.pay_disputes.filter(q => q.status === 'open');
      const f = (k, label) => `<label>${label}<input id="pay-${k}" name="${k}" type="number" min="0" step="any" value="${esc(pr[k] ?? 0)}"></label>`;
      const srt = state.paySort || 'sum', rf = state.payRole || '';
      const rows = crew().filter(p => !rf || p.role === rf).map(p => { const ts = db.tours.filter(t => live(t) && involves(t, p.id) && t.date >= prg.from && t.date <= prg.to); const days = new Set(); ts.forEach(t => tourDays(t).forEach(d => days.add(d))); return { p, n: ts.length, days: days.size, sum: payData(p.id, prg.from, prg.to).total }; }).sort((x, y) => srt === 'name' ? x.p.name.localeCompare(y.p.name) : srt === 'n' ? y.n - x.n : srt === 'days' ? y.days - x.days : y.sum - x.sum);
      state.payRows = rows.map(x => [x.p.name, T('role_' + x.p.role), x.n, x.days, Math.round(x.sum * 100) / 100]); state.payFile = `salary-${prg.from}-${prg.to}.csv`;
      h += `${open.length ? `<h3>${T('dp_open')} (${open.length})</h3><div class="list">${open.map(q => { const t = db.tours.find(x => x.id === q.tour_id) || {}; return `<div class="card f" data-key="dq${q.id}"><div class="row">${avatar(q.user_id)}<b>${esc(pname(q.user_id))}</b>${t.id ? `<button class="btn sm" data-act="tour" data-id="${t.id}">${esc(t.title)} · ${esc(dateText(t))}</button>` : ''}</div><div class="small">${T('dp_counted')}: <b class="num">${nf(myPayOn(t, q.user_id))}</b>${q.expected != null ? ` · ${T('dp_expected')}: <b class="num">${nf(q.expected)}</b>` : ''} ${esc(cur)}</div><div class="small">“${esc(q.message || '')}”</div><div class="two"><label>${T('dp_newpay')}<input id="dp-amt-${q.id}" type="number" min="0" step="any" value="${esc(q.expected ?? '')}"></label><label>${T('dp_reply')}<input id="dp-re-${q.id}"></label></div><div class="actions"><button class="btn sm danger" data-act="dpdecide" data-id="${q.id}" data-s="0">${T('decline')}</button><button class="btn sm primary" data-act="dpdecide" data-id="${q.id}" data-s="1">${T('dp_accept')}</button></div></div>`; }).join('')}</div>` : ''}${rangeBar().replace('id="mm"', 'id="pm"')}
        <div class="bar"><div class="seg">${[['', T('all')], ['guide', T('role_guide')], ['driver', T('role_driver')]].map(([k, l]) => `<button data-act="payrole" data-v="${k}" aria-pressed="${rf === k}">${l}</button>`).join('')}</div><button class="btn sm" data-act="paycsv">${ico('copy')}${T('pay_csv')}</button></div><span class="muted small">${T('pay_sort_hint')}</span>
        <div class="tablewrap"><table><tr>${[['name', T('name')], ['', T('role')], ['n', T('tours_n')], ['days', T('rp_days')], ['sum', T('pay_total') + ' (' + esc(cur) + ')']].map(([k, l], ix) => `<th class="${ix > 1 ? 'n' : ''}">${k ? `<button class="lnk thsort${srt === k ? ' on' : ''}" data-act="paysort" data-v="${k}">${l}${srt === k ? ' ▾' : ''}</button>` : l}</th>`).join('')}</tr>${rows.map(x => `<tr><td><button class="btn sm" data-act="${prg.month ? 'statement' : 'prange'}" data-id="${x.p.id}" data-m="${mo}">${esc(x.p.name)}</button></td><td>${T('role_' + x.p.role)}</td><td class="n">${x.n}</td><td class="n">${x.days}</td><td class="n"><b>${Math.round(x.sum * 100) / 100}</b></td></tr>`).join('')}<tr><td colspan="4"><b>${T('total')}</b></td><td class="n"><b>${Math.round(rows.reduce((a, x) => a + x.sum, 0) * 100) / 100}</b></td></tr></table></div>
        <form class="f card" data-form="pay" style="max-width:640px"><b>${T('pay_rates')}</b><span class="muted small">${T('pay_text')}</span><div class="three">${f('guide_private', T('role_guide') + ' · ' + T('kind_private'))}${f('guide_group', T('role_guide') + ' · ' + T('kind_group'))}${f('guide_custom', T('role_guide') + ' · ' + T('kind_custom'))}${f('driver_private', T('role_driver') + ' · ' + T('kind_private'))}${f('driver_group', T('role_driver') + ' · ' + T('kind_group'))}${f('driver_custom', T('role_driver') + ' · ' + T('kind_custom'))}</div><label>${T('currency')}<input id="pay-cur" name="currency" value="${esc(cur)}" style="max-width:120px"></label><label>${T('pay_note')}<textarea id="pay-note" name="payNote">${esc(r.payNote || '')}</textarea></label><div class="actions"><button class="btn primary">${T('save')}</button></div></form>
        <form class="f card" data-form="paytable"><b>${T('pt_title')}</b><span class="muted small">${T('pt_text')}</span><div class="tablewrap"><table><tr><th>${T('tour')}</th><th>${T('pt_gb')}</th><th>${T('pt_gg')}</th><th>${T('pt_db')}</th><th>${T('pt_dg')}</th></tr>${payTitles().map((ti, i) => { const v = (r.payTable || {})[ti] || {}; const inp = k => `<td><input class="inp" type="number" min="0" step="any" name="${i}_${k}" aria-label="${k}" value="${esc(v[k] ?? '')}" style="width:90px"></td>`; return `<tr><td style="white-space:normal;min-width:180px">${esc(ti)}</td>${inp('guide_base')}${inp('guide_guest')}${inp('driver_base')}${inp('driver_guest')}</tr>`; }).join('')}</table></div><div class="actions"><button class="btn primary">${T('save')}</button></div></form>`;
    }
    if (tab === 'team') {
      const all = db.profiles.slice().sort((a, b) => (a.active === false) - (b.active === false) || (roleRank[a.role] - roleRank[b.role]) || a.name.localeCompare(b.name));
      const cur = all.filter(p => !p.left_at), gone = all.filter(p => p.left_at), waiting = cur.filter(p => p.active === false).length;
      const two = (x, y) => `<span class="grow-l" style="flex-direction:column;align-items:flex-start;gap:0;min-width:0"><b>${x}</b><span class="muted small">${y}</span></span>`;
      const prow = p => `<div class="card prow" data-key="p${p.id}"><span class="row nw">${avatar(p.id)}${two(esc(p.name), esc([T('role_' + p.role), p.languages, p.phone, tgUser(p.telegram) && '@' + tgUser(p.telegram)].filter(Boolean).join(' · ')))}${p.id === me().id ? `<span class="tag t-ok">${T('you')}</span>` : ''}${p.active === false && !p.left_at ? `<button class="btn sm primary" data-act="pactive" data-id="${p.id}">${T('activate')}</button>` : ''}${p.left_at ? '' : `<button class="btn sm" data-act="pedit" data-id="${p.id}">${T('edit')}</button>`}</span></div>`;
      const irow = i => `<div class="card prow" data-key="i${i.id}"><span class="row nw"><span class="avatar ini">${esc(initials(i.name || i.email))}</span>${two(esc(i.name || i.email), esc([T('role_' + i.role), i.email].join(' · ')))}<span class="tag t-warn">${T('invited')}</span></span><span class="bar">${i.phone ? `<a class="btn sm" href="${esc(waLink(i.phone, inviteText(i)))}" target="_blank" rel="noopener">${ico('wa')}WhatsApp</a>` : ''}<button class="btn sm" data-act="copy" data-v="${esc(inviteText(i))}">${ico('copy')}${T('invite_copy')}</button><button class="btn sm" data-act="invdel" data-id="${i.id}">${T('remove')}</button></span></div>`;
      h += `<div class="bar"><button class="btn primary" data-act="pnew">+ ${T('add_person')}</button></div><details class="sect"><summary>${T('bulk_title')}</summary><form class="f" data-form="bulkteam"><span class="muted small">${T('bulk_text')}</span><textarea id="bulk-list" name="list" rows="6" placeholder="${T('bulk_hint')}" required></textarea><div class="actions"><button class="btn primary">${T('bulk_add')}</button></div></form></details><p class="muted small">${T(S.mode === 'demo' ? 'team_note_demo' : 'team_note2')}</p>
        ${waiting ? `<div class="banner">${T('waiting_approval', { n: waiting })}</div>` : ''}
        ${db.invites.length ? `<h3>${T('invited')} (${db.invites.length})</h3><div class="list">${db.invites.map(irow).join('')}</div>` : ''}
        <h3>${T('a_team')} (${cur.length})</h3><div class="list">${cur.map(prow).join('')}</div>
        ${gone.length ? `<details class="sect"><summary>${T('former_team')} (${gone.length})</summary><div class="list">${gone.map(prow).join('')}</div></details>` : ''}`;
    }
    if (tab === 'privacy') {
      const p = pv();
      h += `<form class="f" data-form="privacy" style="max-width:560px"><label>${T('pv_guide_days')}<input id="pv-days" name="guideDays" type="number" min="1" max="365" value="${esc(p.guideDays)}" style="max-width:120px"></label>
        <label>${T('pv_keep_months')}<input id="pv-months" name="keepMonths" type="number" min="3" max="120" value="${esc(p.keepMonths)}" style="max-width:120px"></label>
        <label style="flex-direction:row;align-items:center;gap:8px;color:var(--ink)"><input type="checkbox" id="pv-auto" name="auto" ${p.auto ? 'checked' : ''} style="width:20px;height:20px">${T('pv_auto')}</label>
        <div class="actions"><button class="btn primary">${T('save')}</button></div></form>
        <div class="card f" style="max-width:560px"><b>${T('pv_clean')}</b><span class="muted small">${state.staleN == null ? '…' : T('pv_due', { n: state.staleN, m: p.keepMonths })}</span><span class="muted small">${T('pv_note')}</span>
          <div class="bar"><button class="btn" data-act="pvcount">${T('pv_check')}</button>${state.staleN ? `<button class="btn danger" data-act="pvrun">${T('pv_run')}</button>` : ''}</div></div>
        <p class="muted small" style="max-width:560px">${T('pv_law')}</p>`;
    }
    if (tab === 'email') {
      const mm = state.mail;
      h += pasteHtml() + `<details class="sect"><summary>${T('mail_title')}</summary><form class="f card" data-form="mail"><b>${T('mail_title')}</b><span class="muted small">${T('mail_text')}</span><textarea id="mail-text" name="text" style="min-height:160px" required></textarea><div class="actions"><button class="btn primary">${T('mail_read')}</button></div></form></details>`;
      if (mm) h += `<div class="card"><b>${esc(mm.title)}</b><div class="row"><span class="tag t-${mm.kind}">${T('kind_' + mm.kind)}</span><b class="num">${esc(fmtDay(mm.date))} ${esc(mm.start)}</b><span class="tag t-muted">${esc(acText(mm))}</span><span class="tag t-muted">${esc(mm.source)}</span><span class="tag ${mm.payment === 'prepaid' ? 't-ok' : 't-warn'}">${T('pay_' + mm.payment)}${mm.due ? ' ' + esc(mm.cur + ' ' + mm.due) : ''}</span></div>
        <div class="small">${esc(mm.guest)} · ${esc(mm.phone || '')} · ${esc(mm.email || '')} · ${esc(mm.ref)}</div>
        <div class="muted small">${mm.dup ? T('mail_dup') : mm.tour ? T('mail_join', { title: mm.tour.title }) : T('mail_new')}</div>
        <div class="actions"><button class="btn primary" data-act="mailgo" ${mm.dup ? 'disabled' : ''}>${T('mail_add')}</button></div></div>`;
    }
    if (tab === 'requests') {
      const qs = db.change_requests.slice().sort((x, y) => (x.status === 'pending' ? 0 : 1) - (y.status === 'pending' ? 0 : 1) || (y.created_at || '').localeCompare(x.created_at || '')).slice(0, 60);
      h += `<div class="list">${qs.map(q => { const t = db.tours.find(x => x.id === q.tour_id); return `<div class="card"><div class="row">${avatar(q.user_id)}<b>${esc(pname(q.user_id))}</b><span class="tag ${q.status === 'approved' ? 't-ok' : q.status === 'declined' ? 't-danger' : 't-warn'}">${T(q.status)}</span>${t ? `<button class="btn sm" data-act="tour" data-id="${t.id}">${esc(t.title)} · ${esc(dateText(t))}</button>` : ''}</div><div class="small">${esc(creqText(q))}</div>${q.status === 'pending' ? `<div class="actions"><button class="btn sm danger" data-act="creqdecide" data-id="${q.id}" data-s="0">${T('decline')}</button><button class="btn sm primary" data-act="creqdecide" data-id="${q.id}" data-s="1">${T('approve')}</button></div>` : ''}</div>`; }).join('') || `<div class="empty">${T('creq_none')}</div>`}</div>`;
    }
    if (tab === 'usage') {
      const since = addDays(today(), -30), rows = db.usage.filter(u => u.day >= since), by = {};
      rows.forEach(u => { const x = by[u.action] = by[u.action] || { n: 0, people: new Set() }; x.n += u.n || 1; x.people.add(u.user_id); });
      const list = Object.keys(TRACKED).map(k => ({ k, n: (by[k] || {}).n || 0, people: by[k] ? by[k].people.size : 0 })).sort((x, y) => y.n - x.n), max = Math.max(1, ...list.map(x => x.n));
      const per = crew().map(p => ({ p, days: new Set(rows.filter(u => u.user_id === p.id).map(u => u.day)).size, taps: rows.filter(u => u.user_id === p.id).reduce((s2, u) => s2 + (u.n || 1), 0), offers: db.offers.filter(o => o.user_id === p.id && (o.at || '').slice(0, 10) >= since).length }));
      h += `<p class="muted small">${T('usage_text')}</p><div class="cols"><div class="card"><b>${T('usage_used')}</b>${list.filter(x => x.n).map(x => `<div class="row"><span style="flex:1;min-width:0">${esc(TRACKED[x.k])}</span><span class="meter"><i style="width:${Math.round(x.n / max * 100)}%"></i></span><b class="num">${x.n}</b><span class="muted small num">${x.people} ${T('usage_people')}</span></div>`).join('') || `<span class="muted small">${T('usage_none')}</span>`}</div>
        <div class="list"><div class="card"><b>${T('usage_unused')}</b><div class="row">${list.filter(x => !x.n).map(x => `<span class="tag t-muted">${esc(TRACKED[x.k])}</span>`).join('') || `<span class="muted small">—</span>`}</div></div>
        <div class="tablewrap"><table><tr><th>${T('name')}</th><th class="n">${T('usage_days')}</th><th class="n">${T('usage_taps')}</th><th class="n">${T('offers_sent')}</th></tr>${per.map(x => `<tr><td>${esc(x.p.name)}</td><td class="n">${x.days}</td><td class="n">${x.taps}</td><td class="n">${x.p.role === 'driver' ? '—' : x.offers}</td></tr>`).join('')}</table></div></div></div>`;
    }
    if (tab === 'catalog') {
      const cs = catalog();
      h += `<p class="muted small">${T('cat_text')}</p><div class="bar"><button class="btn primary" data-act="catedit" data-i="-1">+ ${T('cat_add')}</button></div>
        <div class="list">${cs.map((c, i) => `<button class="card crow" data-act="catedit" data-i="${i}"><span class="row nw">${emblem({ title: c.title }, true)}<span class="grow-l" style="flex-direction:column;align-items:flex-start;gap:0;min-width:0"><b>${esc(c.title)}</b><span class="muted small num">${esc([T('kind_' + (KINDS.includes(c.kind) ? c.kind : 'private')), c.start, c.start && c.end ? durOf({ start_time: c.start, end_time: c.end }) + ' ' + T('h_short') : (c.days > 1 ? c.days + ' ' + T('days') : ''), c.capacity ? T('cat_seats', { n: c.capacity }) : '', kmOf(c.title) ? kmOf(c.title) + ' km' : ''].filter(Boolean).join(' · '))}</span></span></span></button>`).join('')}</div>`;
    }
    if (tab === 'log') {
      const ls = db.log.slice().sort((a, b) => (b.at || '').localeCompare(a.at || '')).slice(0, 200);
      h += `<div class="tablewrap"><table><tr><th>${T('when')}</th><th>${T('person')}</th><th>${T('what')}</th></tr>${ls.map(x => `<tr><td class="num">${esc((x.at || '').slice(0, 16).replace('T', ' '))}</td><td>${esc(pname(x.user_id))}</td><td style="white-space:normal">${esc(x.summary)}</td></tr>`).join('') || `<tr><td colspan="3" class="muted">${T('log_empty')}</td></tr>`}</table></div>`;
    }
    if (tab === 'holidays') {
      const hs = db.holidays.slice().sort((a, b) => a.date_from.localeCompare(b.date_from));
      h += `<form class="bar" data-form="holiday"><select class="inp" id="h-kind" name="kind" style="max-width:170px" aria-label="${T('type')}">${opt('holiday', T('k_holiday'), 'holiday')}${opt('event', T('k_event'), '')}</select><input class="inp" id="h-name" name="name" placeholder="${T('name')}" required style="max-width:220px"><input class="inp" id="h-from" name="from" type="date" required style="max-width:170px"><input class="inp" id="h-to" name="to" type="date" required style="max-width:170px"><button class="btn primary">+ ${T('add')}</button></form>
        <div class="bar"><button class="btn" data-act="holpreset" data-y="${y}">${T('hol_preset', { y })}</button><button class="btn" data-act="holpreset" data-y="${y + 1}">${T('hol_preset', { y: y + 1 })}</button></div><p class="muted small">${T('hol_note')}</p>
        <div class="list">${hs.length ? hs.map(x => `<div class="card"><div class="row"><span class="tag ${x.kind === 'event' ? 't-group' : 't-hol'}">${esc(x.name)}</span><span class="num">${esc(fmtRange(x.date_from, x.date_to))}</span><span class="spacer"></span><button class="btn sm" data-act="holdel" data-id="${x.id}">${T('remove')}</button></div></div>`).join('') : `<div class="empty">${T('no_holidays')}</div>`}</div>`;
    }
    if (tab === 'rules') {
      const f = (k, label) => `<label>${label}<input id="r-${k}" name="${k}" type="number" min="0" value="${esc(r[k])}"></label>`;
      h += `<form class="f" data-form="rules" style="max-width:560px">${f('maxStreak', T('r_streak'))}${f('carSeats', T('r_car'))}<div class="two">${f('seasonFrom', T('r_season_from'))}${f('seasonTo', T('r_season_to'))}</div>${f('maxSeasonBlock', T('r_block'))}${f('minNoticeDays', T('r_notice'))}${['reviewGoogle', 'reviewTripadvisor', 'reviewTrustindex', 'reviewGyg', 'reviewViator'].map(k => `<label>${T('r_' + k)}<input id="r-${k}" name="${k}" type="url" value="${esc(r[k] || '')}"></label>`).join('')}<label>${T('r_tipUrl')}<input id="r-tipUrl" name="tipUrl" type="url" value="${esc(r.tipUrl || '')}" placeholder="https://"></label><label>${T('r_botUrl')}<input id="r-botUrl" name="botUrl" type="url" value="${esc(r.botUrl || '')}" placeholder="https://t.me/..."></label><label>${T('r_offerPromo')}<input id="r-offerPromo" name="offerPromo" value="${esc(r.offerPromo || '')}"></label><label>${T('r_guestcur')}<input id="r-guestCurrency" name="guestCurrency" value="${esc(r.guestCurrency || 'USD')}" style="max-width:120px"></label><div class="tsum">${fxData().upd ? T('r_fx_now', { date: fmtDay(fxData().upd), v: FX_CUR.map(c => `${c} ${fxOn(c, today()) || '—'}`).join(' · ') }) : T('r_fx_none')}</div><label>${T('r_rates_fb')}<input name="rates" value="${esc(rules().rates || 'USD 2.70, EUR 2.95')}"></label><span class="muted small">${T('r_rates_hint', { c: rules().currency || 'GEL' })}</span><label>${T('r_comm')}<input name="commission" value="${esc(rules().commission ?? 'GetYourGuide 25')}"></label><span class="muted small">${T('r_comm_hint')}</span><label class="row" style="gap:8px"><input type="checkbox" name="pubHol" style="width:auto" ${rules().pubHol === false ? '' : 'checked'}>${T('ph_switch')}</label><label>${T('r_marks')}<input id="r-customMarks" name="customMarks" value="${esc(r.customMarks || '')}"></label><label class="row" style="gap:8px"><input type="checkbox" name="mtOn" style="width:auto" ${maint().on && !CFG.maintenance ? 'checked' : ''}>${T('mt_switch')}</label><label>${T('mt_msg')}<input name="mtText" value="${esc((maint().text) || '')}" placeholder="${T('mt_text')}"></label><label>${T('peaks_title')}<textarea id="r-peaks" name="peaks" rows="6" spellcheck="false">${esc(r.peaks ?? DEFAULT_PEAKS)}</textarea></label><span class="muted small">${T('peaks_text')}</span><div class="actions"><button class="btn primary">${T('save')}</button></div></form>`;
    }
    if (tab === 'reports') {
      const rows = report(y);
      h += `<div class="bar"><div class="seg"><button data-act="year" data-d="-1">‹</button><button disabled>${y}</button><button data-act="year" data-d="1">›</button></div></div>
        <div class="tablewrap"><table><tr><th>${T('name')}</th><th>${T('role')}</th><th class="n">${T('rp_days')}</th><th class="n">${T('rp_off')}</th><th class="n">${T('rp_sick')}</th><th class="n">${T('rp_streak')}</th><th class="n">${T('rp_heavy')}</th></tr>
        ${rows.map(x => `<tr><td>${esc(x.p.name)}</td><td>${T('role_' + x.p.role)}</td><td class="n">${x.days}</td><td class="n">${x.off}</td><td class="n">${x.sick}</td><td class="n">${x.best > r.maxStreak ? `<span class="tag t-warn">${x.best}</span>` : x.best}</td><td class="n">${x.heavy}</td></tr>`).join('')}</table></div><p class="muted small">${T('rp_note')}</p>`;
    }
    if (tab === 'import') {
      const im = state.imp;
      h += contactsImpHtml() + `<div class="card"><b>${T('imp_title')}</b><p class="muted small">${T('imp_text')}</p><input class="inp" type="file" id="imp-file" accept=".xlsx,.xls,.csv" data-ch="impfile"></div>`;
      if (im) h += `<div class="card"><b>${T('imp_found', { tours: im.tours.length, guests: im.bookings.length, offs: im.offs.length, skipped: im.skipped })}</b>${im.cancelled ? `<span class="muted small">${T('imp_cancelled', { n: im.cancelled })}</span>` : ''}${(() => { const m = {}; im.bookings.forEach(b => (b.marks || []).forEach(k => { m[k] = (m[k] || 0) + 1; })); const src = {}; im.bookings.forEach(b => { if (b.source) src[b.source] = (src[b.source] || 0) + 1; }); return Object.keys(m).length || Object.keys(src).length ? `<span class="muted small">${T('imp_found_extra')}: ${[...Object.entries(src).map(([k, v]) => `${k} ${v}`), ...Object.entries(m).map(([k, v]) => `${markLabel(k)} ${v}`)].join(' · ')}</span>` : ''; })()}
        <div class="f">${im.members.map((n, i) => `<label>${esc(n)}<select id="im-${i}" data-ch="impmap" data-name="${esc(n)}">${opt('', T('imp_skip'), im.map[n])}${S.mode === 'demo' ? opt('new', T('imp_create'), im.map[n]) : ''}${staff().map(p => opt(p.id, p.name, im.map[n])).join('')}</select></label>`).join('')}</div>
        <div class="actions"><button class="btn primary" data-act="impgo">${T('imp_go')}</button></div></div>`;
    }
    if (tab === 'backup') {
      const rs = state.restore;
      h += `<div class="card f"><b>${T('bk_safe_title')}</b><ul class="small"><li>${T('bk_safe1')}</li><li>${T('bk_safe2')}</li><li>${T('bk_safe3')}</li><li>${T('bk_safe4')}</li></ul></div>`;
      h += `<div class="card f"><b>${T('rs_title')}</b><span class="muted small">${T('rs_text')}</span><input class="inp" type="file" accept=".json,application/json" data-ch="restorefile">${rs ? `<b>${T('rs_found', { date: rs.exported ? fmtDay(rs.exported.slice(0, 10)) : '?', tours: (rs.data.tours || []).length, bookings: (rs.data.bookings || []).length, clients: (rs.data.clients || []).length })}</b><div class="bar"><button class="btn" data-act="rsno">${T('close')}</button><button class="btn primary" data-act="rsgo">${T('rs_go')}</button></div>` : ''}</div>`;
      h += `<div class="card"><b>${T('bk_title')}</b><p class="muted small">${T('bk_text')}</p><p class="small">${lastBackup() ? T('bk_last', { date: fmtDay(lastBackup().slice(0, 10)) }) : T('bk_never')}</p><div class="bar"><button class="btn primary" data-act="backup">${T('bk_download')}</button>${S.mode === 'demo' ? `<button class="btn danger" data-act="demoreset">${T('demo_reset')}</button>` : ''}</div></div>`;
    }
    return h;
  }

  // ---------- booking email (TrekkSoft order notification) ----------
  const MONTHS_FULL = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  function parseOrderEmail(text) {
    const g = (re, i = 1) => { const m = text.match(re); return m ? String(m[i]).trim() : ''; };
    const bm = text.match(/^\s*(\d+)\s*x\s*(.+?)\s*\((\d{1,2})\s+([A-Za-z]+),?\s+(\d{4}),?\s+(\d{1,2}:\d{2})\)\s*$/m);
    const ref = g(/#\s*(\d{6,})/);
    if (!bm || !ref || MONTHS_FULL.indexOf(bm[4].toLowerCase()) < 0) throw new Error(T('mail_bad'));
    const date = `${bm[5]}-${p2(MONTHS_FULL.indexOf(bm[4].toLowerCase()) + 1)}-${p2(bm[3])}`, start = bm[6].padStart(5, '0'), title = bm[2].trim();
    const rest = text.slice(text.indexOf(bm[0]) + bm[0].length); let adults = 0, children = 0;
    for (const m of rest.matchAll(/^\s*(\d+)\s*x\s+(.+)$/gm)) { if (/child|kid|infant/i.test(m[2])) children += Number(m[1]); else adults += Number(m[1]); }
    if (!adults && !children) adults = Number(bm[1]) || 1;
    const first = g(/^\s*First name:\s*(.+)$/m), last = g(/^\s*Last name:\s*(.+)$/m), email = cleanEmail(g(/^\s*Email:\s*(\S+@\S+)/m));
    const price = Number(g(/Sales Price:\s*[A-Z]{3}\s*([\d.,]+)/).replace(/,/g, '')) || 0, paid = Number(g(/Payment:\s*[A-Z]{3}\s*([\d.,]+)/).replace(/,/g, '')) || 0, cur = g(/Sales Price:\s*([A-Z]{3})/) || '';
    const ch = g(/Booking Channel:\s*(.+)/), source = /GYG|GetYourGuide/i.test(ch) ? 'GetYourGuide' : /Viator/i.test(ch) ? 'Viator' : 'Website';
    const out = { ref: '#' + ref, date, start, title, kind: /group/i.test(title) ? 'group' : 'private', adults, children, guest: [first, last].filter(Boolean).join(' ') || email || 'Guest', email, phone: g(/Phone Number[^:\n]*:\s*(\+?[\d\s()-]{7,})/i).replace(/\s+/g, ''), source, cur, price, payment: price > 0 && paid >= price ? 'prepaid' : 'unpaid', due: Math.max(0, Math.round((price - paid) * 100) / 100) };
    out.dup = db.bookings.some(b => (b.ref || '').replace('#', '') === ref);
    out.tour = db.tours.find(t => live(t) && t.date === date && (t.start_time || '') === start && t.title.toLowerCase() === title.toLowerCase()) || db.tours.find(t => live(t) && t.kind === 'group' && t.date === date && (t.start_time || '') === start && title.toLowerCase().includes(t.title.toLowerCase().split(' ')[0])) || null;
    return out;
  }
  async function addOrderEmail() {
    const mm = state.mail; let t = mm.tour;
    const ce = catFind(mm.title) || {};
    if (!t) { t = { id: S.uid(), date: mm.date, date_to: ce.days > 1 ? addDays(mm.date, ce.days - 1) : null, start_time: mm.start, end_time: ce.end || null, title: mm.title, kind: mm.kind, capacity: ce.capacity || 0, pickup_url: ce.pickup_url || null, pax: 0, adults: 0, children: 0, language: null, pickup: ce.pickup || null, notes: null, status: 'confirmed', guide_id: null, driver_id: null, guide_pay: null, driver_pay: null, external_id: null }; }
    let c = findClient({ phone: mm.phone, guest: mm.guest });
    if (!c) { c = { id: S.uid(), name: mm.guest, phone: mm.phone || null, email: mm.email || null, notes: null }; await S.save('clients', c); }
    await S.save('tours', { ...t, adults: (t.adults || 0) + mm.adults, children: (t.children || 0) + mm.children, pax: (t.pax || 0) + mm.adults + mm.children });
    await S.save('bookings', { id: S.uid(), tour_id: t.id, client_id: c.id, guest: mm.guest, adults: mm.adults, children: mm.children, pax: mm.adults + mm.children, phone: mm.phone || null, ref: mm.ref, notes: mm.price ? `${mm.cur} ${mm.price}${mm.due ? ', ' + T('pay_unpaid').toLowerCase() + ' ' + mm.cur + ' ' + mm.due : ''}` : null, marks: [], source: mm.source, payment: mm.payment, amount_due: mm.due && mm.cur === guestCur() ? mm.due : null });
    logAct(`Added booking ${mm.ref} from email: ${mm.title}, ${mm.date}`);
    state.mail = null; state.date = mm.date; toast(T('mail_done'));
  }

  // ---------- Setmore import ----------
  const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  function parseDate(v) {
    if (v instanceof Date) return iso(v);
    const m = String(v || '').trim().match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})$/); if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${p2(MONTHS[m[2].toLowerCase()])}-${p2(m[1])}`;
    const n = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return n ? n[0] : null;
  }
  function to24(s) { const m = String(s || '').trim().match(/^(\d{1,2}):(\d{2})\s*([AP]M)?$/i); if (!m) return null; let h = Number(m[1]) % 12; if ((m[3] || '').toUpperCase() === 'PM') h += 12; if (!m[3]) h = Number(m[1]); return `${p2(h)}:${m[2]}`; }
  // Options written in names and comments ("+wine", "front seat", "non-refundable"...), and the platform a booking code belongs to.
  const MARK_RULES = [[/\+\s*wine|wine tasting/i, 'wine'], [/\+\s*front|front[\s-]?seat/i, 'front_seat'], [/\+\s*pick|pick[\s-]?up from (the )?hotel|hotel pick[\s-]?up/i, 'pickup'], [/\+\s*food|bear food/i, 'bear_food'], [/\+\s*drop|drop[\s-]?off/i, 'dropoff'], [/\+\s*stay|stays? (there|in kazbegi)/i, 'stays'], [/private room/i, 'private_room'], [/non[\s-]?refund|невозвра/i, 'nonref'], [/late[\s-]?cancel/i, 'cancellation']];
  const srcFromCodes = txt => { const t = String(txt || ''); return /\bGYG[A-Z0-9]{6,}/i.test(t) ? 'GetYourGuide' : /\bBR-\d{6,}/i.test(t) ? 'Viator' : /\bKL[A-Z0-9]{6,}|klook/i.test(t) ? 'Klook' : /trip\.com|\bctrip/i.test(t) ? 'Trip.com' : /airbnb|\bHM[A-Z0-9]{8}\b/i.test(t) ? 'Airbnb' : /civitatis/i.test(t) ? 'Civitatis' : /free\s*tour/i.test(t) ? 'FreeTour' : ''; };
  const codesIn = txt => [...new Set((String(txt || '').match(/\b(GYG[A-Z0-9]{6,}|BR-\d{6,}|KL[A-Z0-9]{6,}|HM[A-Z0-9]{8}|#?\d{7,9})\b/gi) || []).map(x => x.toUpperCase()))];
  // Guest list check: one pass over all guests and bookings that suggests fixes (platform from booking codes, options from names and notes,
  // clean names, no platform relay emails, phone format). Nothing changes until the admin presses Apply; each fix is written in the booking history.
  function guestCheck() {
    const out = []; const add = (kind, table, row, patch, note) => out.push({ k: out.length, kind, table, row, patch, note });
    db.bookings.forEach(b => {
      const txt = [b.guest, b.ref, b.notes].join(' '), src = srcFromCodes(txt);
      if (src && !b.source) add('source', 'bookings', b, { source: src }, T('gc_n_source', { src, code: codesIn(txt)[0] || '' }));
      const ms = new Set(b.marks || []), found = MARK_RULES.filter(([re]) => re.test(txt)).map(x => x[1]).filter(m => !ms.has(m));
      if (found.length) add('marks', 'bookings', b, { marks: [...ms, ...found] }, T('gc_n_marks', { what: found.map(markLabel).join(', ') }));
      if (!b.ref) { const c = codesIn(b.notes)[0]; if (c) add('ref', 'bookings', b, { ref: c }, T('gc_n_ref', { code: c })); }
    });
    db.clients.forEach(c => {
      if (c.anonymised_at) return; const nm = cleanName(c.name); if (nm && nm !== c.name && nm.length > 2) add('name', 'clients', c, { name: nm }, T('gc_n_name', { from: c.name, to: nm }));
      if (c.email && /reply\.getyourguide|expmessaging|@guest\.airbnb|@reply\.|noreply/i.test(c.email)) add('email', 'clients', c, { email: null }, T('gc_n_email', { e: c.email }));
      const ph = c.phone ? normPhone(c.phone) : ''; if (ph && ph !== c.phone) add('phone', 'clients', c, { phone: ph }, T('gc_n_phone', { from: c.phone, to: ph }));
    });
    return out;
  }
  function guestCheckHtml() {
    const all = state.gc || (state.gc = guestCheck()), kinds = ['source', 'marks', 'ref', 'name', 'email', 'phone'], off = state.gcOff || new Set();
    const by = k => all.filter(x => x.kind === k), on = all.filter(x => !off.has(x.kind));
    return `<div class="card f"><b>${T('gc_title')}</b><span class="muted">${T('gc_text')}</span>${all.length ? kinds.filter(k => by(k).length).map(k => `<details class="sect"><summary><label class="gck"><input type="checkbox" data-ch="gckind" data-v="${k}" ${off.has(k) ? '' : 'checked'}><b>${T('gc_k_' + k)}</b> <span class="muted num">${by(k).length}</span></label></summary><ul class="small gcl">${by(k).slice(0, 80).map(x => `<li>${esc(x.table === 'bookings' ? x.row.guest : x.row.name)}: ${esc(x.note)}</li>`).join('')}${by(k).length > 80 ? `<li class="muted">… +${by(k).length - 80}</li>` : ''}</ul></details>`).join('')
      + `<div class="actions"><button class="btn" data-act="gcrun">${T('gc_again')}</button><button class="btn primary" data-act="gcapply" ${on.length ? '' : 'disabled'}>${T('gc_apply', { n: on.length })}</button></div>` : `<span class="tag t-ok">${T('gc_clean')}</span><div class="actions"><button class="btn" data-act="gcrun">${T('gc_again')}</button></div>`}</div>`;
  }
  function parseSetmore(rows) {
    const head = rows[0].map(x => String(x || '').trim()), ix = n => head.indexOf(n);
    const cDate = ix('Appointment date'), cTime = ix('Appointment time'), cName = ix('Customer name'), cSvc = ix('Service/class/event'), cType = ix('Meeting Type'), cMem = ix('Team member'), cPhone = ix('Phone'), cCC = ix('Country code'), cStatus = ix('Status'), cBid = ix('Booking ID'), cCost = ix('Cost'), cPax = head.findIndex(x => x.startsWith('No of particip')), cCust = ix('Customer ID'), cEmail = ix('Email'), cAddr = ix('Address'), cHotel = ix('Hotel name');
    const cComments = head.map((x, i) => x === 'Comments' ? i : -1).filter(i => i >= 0);
    if (cDate < 0 || cSvc < 0 || cMem < 0) throw new Error(T('imp_bad'));
    const out = { tours: [], bookings: [], clients: {}, offs: [], skipped: 0, members: [], map: {} }, groups = {}, offDays = {};
    const MK = MARK_RULES, cPick = head.findIndex(x => /^pick-?up address/i.test(x)), cLabel = ix('Label'); out.cancelled = 0;
    for (const r of rows.slice(1)) {
      if (!r || !r[cDate]) continue;
      const date = parseDate(r[cDate]), mem = String(r[cMem] || '').trim(), svc = String(r[cSvc] || '').trim(), type = String(r[cType] || '').trim();
      // Setmore keeps cancelled bookings on a separate "Cancel" calendar: those are not a person.
      if (!date || !mem || /^cancel/i.test(mem) || String(r[cStatus] || '').trim().toLowerCase().startsWith('cancel')) { out.skipped++; if (date && (/^cancel/i.test(mem) || /^cancel/i.test(String(r[cStatus] || '').trim()))) out.cancelled++; continue; }
      if (!out.members.includes(mem)) out.members.push(mem);
      if (type === 'Event') { if (/OFF/i.test(svc)) (offDays[mem] = offDays[mem] || {})[date] = /HALF/i.test(svc) ? 'half' : 'dayoff'; else out.skipped++; continue; }
      const [a, b] = String(r[cTime] || '').split(' - '), start = to24(a), end = to24(b);
      const isClass = type === 'Class', key = isClass ? `${mem}|${date}|${start}|${svc}` : String(r[cBid] || S.uid());
      const name = String(r[cName] || '').trim(), xn = name.match(/x\s*(\d{1,2})(?!\d)/i);
      // "No of participants" is typed by hand in Setmore: "3", "2+2", "3 (2 adults + 1 child)", and sometimes a booking code by mistake.
      // A head count is 1-99; anything else (a long number, letters) is kept as the booking code, never as people.
      const praw = String(r[cPax] || '').trim(), pm = praw.match(/(\d{1,2})\s*adults?\s*\+\s*(\d{1,2})\s*child/i) || praw.match(/^(\d{1,2})\s*\+\s*(\d{1,2})$/), xc = name.match(/x\s*(\d{1,2})\s*\+\s*(\d{1,2})(?!\d)/i);
      const pn = praw.match(/^x?\s*(\d{1,2})(\D|$)/i), pnum = pn ? Number(pn[1]) : 0, pcode = !pm && !pnum && /^#?[A-Za-z0-9-]{6,}$/.test(praw) ? praw.replace(/^#/, '') : '';
      const adults = pm ? Number(pm[1]) : xc ? Number(xc[1]) : (pnum || (xn ? Number(xn[1]) : 1)), children = pm ? Number(pm[2]) : xc ? Number(xc[2]) : 0, pax = adults + children;
      const txt = [name, svc, ...cComments.map(i => r[i])].map(x => String(x || '')).join(' '), marks = MK.filter(([re]) => re.test(txt)).map(x => x[1]);
      const addr = String((cPick >= 0 && r[cPick]) || (cHotel >= 0 && r[cHotel]) || (cAddr >= 0 && r[cAddr]) || '').trim() || null, label = String((cLabel >= 0 && r[cLabel]) || '').trim().toLowerCase();
      const cid = /^[0-9a-f-]{36}$/i.test(String(r[cCust] || '').trim()) ? String(r[cCust]).trim() : null, phone = r[cPhone] ? `+${r[cCC] || ''}${r[cPhone]}` : null;
      if (cid && !out.clients[cid]) out.clients[cid] = { id: cid, name: cleanName(name) || name, phone, email: /reply\.|expmessaging|@guest\./i.test(String(r[cEmail] || '')) ? null : (String(r[cEmail] || '').trim() || null), notes: null };
      let t = groups[key];
      if (!t) { t = groups[key] = { id: S.uid(), member: mem, date, start_time: start, end_time: end, title: svc, kind: isClass ? 'group' : 'private', capacity: 0, pax: 0, adults: 0, children: 0, date_to: null, guide_pay: null, driver_pay: null, language: null, pickup: String(r[cHotel] || r[cAddr] || '').trim() || null, notes: String(r[cComments[0]] || '').trim() || null, status: 'confirmed', guide_id: null, driver_id: null, external_id: 'setmore:' + key }; out.tours.push(t); }
      t.pax += pax; t.adults += adults; t.children += children;
      if (name) out.bookings.push({ id: S.uid(), tour_id: t.id, client_id: cid, guest: name, adults, children, pax, phone, ref: String(r[cComments[1]] || pcode || r[cBid] || '').trim() || null, notes: null, marks, price: cCost >= 0 && Number(r[cCost]) > 0 ? Number(r[cCost]) : null, currency: 'USD', // Setmore prices are in US dollars (owner, 10 Nov)
        email: cid && out.clients[cid] ? out.clients[cid].email : null, history: [{ at: new Date().toISOString(), w: 'created', from: 'Setmore' }], pickup_addr: addr, payment: /online|paid|prepaid/.test(label) ? 'prepaid' : /cash/.test(label) ? 'cash' : null, source: srcFromCodes(txt) || null });
    }
    for (const mem of Object.keys(offDays)) {
      const ds = Object.keys(offDays[mem]).sort(); let cur = null;
      for (const d of ds) { const ty = offDays[mem][d]; if (cur && cur.type === ty && addDays(cur.date_to, 1) === d) cur.date_to = d; else { cur = { id: S.uid(), member: mem, date_from: d, date_to: d, type: ty, status: 'approved', note: 'Setmore', created_at: new Date().toISOString(), decided_by: null }; out.offs.push(cur); } }
    }
    const norm = s => s.toLowerCase().replace(/\(.*?\)/g, '').trim();
    out.members.forEach(n => { const p = staff().find(p => norm(p.name) === norm(n) || norm(p.name).startsWith(norm(n))); out.map[n] = p ? p.id : (S.mode === 'demo' ? 'new' : ''); });
    return out;
  }
  // ---------- paste a booking email (GetYourGuide, Viator, Klook, Trip.com, TrekkSoft, Airbnb and others) ----------
  const MON3 = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  function parseWhen(v) {
    const s = String(v || ''); let date = '', time = '';
    let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) date = `${m[1]}-${p2(+m[2])}-${p2(+m[3])}`;
    if (!date && (m = s.match(/([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/)) && MON3[m[1].slice(0, 3).toLowerCase()]) date = `${m[3]}-${p2(MON3[m[1].slice(0, 3).toLowerCase()])}-${p2(+m[2])}`;
    if (!date && (m = s.match(/(\d{1,2})(?:st|nd|rd|th)?\.?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})/)) && MON3[m[2].slice(0, 3).toLowerCase()]) date = `${m[3]}-${p2(MON3[m[2].slice(0, 3).toLowerCase()])}-${p2(+m[1])}`;
    if (!date && (m = s.match(/\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/))) date = `${m[3]}-${p2(+m[2])}-${p2(+m[1])}`;
    if ((m = s.match(/\b(\d{1,2}):(\d{2})\s*([AaPp][Mm])?/))) { let h = +m[1]; if (m[3] && /p/i.test(m[3]) && h < 12) h += 12; if (m[3] && /a/i.test(m[3]) && h === 12) h = 0; time = `${p2(h)}:${m[2]}`; }
    return { date, time };
  }
  const LANG_CODES = { english: 'EN', russian: 'RU', german: 'DE', french: 'FR', spanish: 'ES', italian: 'IT', georgian: 'KA', hebrew: 'HE', chinese: 'ZH', arabic: 'AR', polish: 'PL', ukrainian: 'UK', turkish: 'TR', dutch: 'NL', japanese: 'JA', korean: 'KO' };
  function parseBooking(raw) {
    const t = String(raw || '').replace(/\[[^\]]*\]\([^)]*\)/g, ' ').replace(/https?:\/\/\S+/g, ' ').replace(/\|/g, '\n').replace(/[ \t\u00a0]+/g, ' ').replace(/\n\s*\n+/g, '\n').replace(/^\s*(ticket-booking|calendar|users|single-person|globe|pin|currency)\s*$/gim, '').replace(/^(Booking time|Booked (?:at|on)|Please confirm the booking before)[^\n]*\n?[^\n]*$/gim, '');
    const get = re => { const m = t.match(re); return m ? m[1].trim() : ''; };
    const src = /getyourguide/i.test(t) ? 'GetYourGuide' : /viator|tripadvisor/i.test(t) ? 'Viator' : /klook/i.test(t) ? 'Klook' : /trip\.com|ctrip|VBK system/i.test(t) ? 'Trip.com' : /airbnb|booked your experience|Hosted by/i.test(t) ? 'Airbnb' : /civitatis/i.test(t) ? 'Civitatis' : /freetour/i.test(t) ? 'FreeTour' : /tourradar/i.test(t) ? 'TourRadar' : /trekksoft/i.test(t) ? 'Website' : '';
    const ref = get(/\b(GYG[A-Z0-9]{8,})\b/) || get(/\b(BR-\d{6,})\b/) || get(/Booking reference ID\s*:?\s*([A-Z0-9-]{5,})/i) || get(/Confirmation code\s*:?\s*([A-Z0-9]{6,})/i) || get(/(?:Booking (?:Reference|ID|number|No\.?|code)|Reference (?:number|no\.?)|Order (?:number|ID|No\.?)|Confirmation (?:number|code)|Voucher (?:number|code))\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{4,})/i) || get(/order[^#\n]{0,80}#\s?(\d{6,})/i);
    let title = get(/(?:Tour Name|Activity name|Product name)\s*:\s*([^\n]+)/i) || get(/Booked product\s*\n\s*([^\n]+)/i) || get(/has been booked:?\s*\n\s*([^\n]+)/i) || get(/new reservation for ([^.\n]+)/i) || get(/order for (.+?) and issued/i) || get(/\n([^\n]+)\n\s*Hosted by/i) || get(/(?:Activity|Product|Experience)\s*:\s*([^\n]+)/i);
    title = title.replace(/\s+Reference number.*$/i, '').replace(/^\d{5,}-/, '').replace(/\t.*$/, '').trim();
    let when = parseWhen(get(/(?:Travel Date|Activity Date|Tour date|Date of (?:the )?(?:tour|activity|use)|Departure date|Date Request|Date and time)\s*:?\s*([^\n]+)/i) || get(/\bDate\s*:?\s*([^\n]+)/));
    if (!when.time) when.time = parseWhen(get(/(?:Tour Grade|Start time|Time|Option)\s*:?\s*([^\n]*\d{1,2}:\d{2}[^\n]*)/i)).time;
    let guest = get(/(?:Lead Traveler Name|Lead traveller(?: name)?|Lead participant|Main customer|Customer name|Contact (?:name|person)|Guest name|Booked by|Traveler name)\s*:?\s*([^\n]+)/i) || get(/^\s*([^\n]{2,40}?) booked your experience/im);
    guest = guest.replace(/\S+@\S+.*$/, '').replace(/\s*(Phone|Tel|Mobile)\b.*$/i, '').replace(/^\((?:MR|MRS|MS|MISS|DR)\)\s*/i, '').trim();
    if (/^[A-Z' -]+\/[A-Z' -]+$/.test(guest)) { const [sn, gn] = guest.split('/'); const cap = s => s.toLowerCase().replace(/\b\w/g, x => x.toUpperCase()); guest = `${cap(gn)} ${cap(sn)}`.trim(); }
    const native = get(/\bName\s*:\s*([^\n]+)/); if (native && /[^\u0000-\u024f]/.test(native) && !guest.includes(native)) guest = guest ? `${guest} (${native.trim()})` : native.trim();
    const num = re => { const m = t.match(re); return m ? Number(m[1]) : 0; };
    let adults = num(/(\d+)\s*x?\s*Adults?\b/i), children = num(/(\d+)\s*x?\s*(?:Child|Children|Kids?)\b/i) + num(/(\d+)\s*x?\s*Youths?\b/i) + num(/(\d+)\s*x?\s*Infants?\b/i);
    if (!adults && !children) adults = num(/(?:Travell?ers|Participants|Persons|People|Guests|Number of (?:participants|people|guests)|Booking Quantity|Quantity)\s*:?\s*(\d+)/i) || 1;
    const phs = [...t.matchAll(/(?:Phone|Mobile|Tel(?:ephone)?|WhatsApp)\s*(?:number)?\s*:?\s*(?:\([^)]*\))?\s*(?:[A-Z]{2}\s*)?(\+?\d[\d\s()*-]{6,}\d)/gi)].map(m => m[1]).filter(x => !x.includes('*')).map(x => x.replace(/[\s()-]/g, ''));
    const phone = normPhone(phs.find(x => x.startsWith('+')) || (phs[0] ? (phs[0].length > 10 && !/^5/.test(phs[0]) ? '+' + phs[0] : phs[0]) : ''));
    const email = (t.match(/[\w.+*-]+@[\w-]+(?:\.[\w-]+)+/g) || []).find(e => !/\*|reply|expmessaging|tripadvisor|notification|no-?reply|friendly\.ge|klook\.com|trip\.com|viator|getyourguide|trekksoft|airbnb|example/i.test(e)) || '';
    const lv = (get(/(?:Tour Language|Guide language|Preferred language|Language)\s*:?\s*([^\n]+)/i) || '').toLowerCase(), lang = (Object.entries(LANG_CODES).find(([k]) => lv.includes(k)) || [])[1] || '';
    const pickup = get(/(?<!at )(?:Pick-?up(?: point| location| address)?|Meeting Point|Departure location|Hotel(?: name)?)\s*:?\s*([^\n]+)/i).replace(/\s*Open in Google Maps.*$/i, '').trim();
    const marks = []; if (/non[\s-]?refundable|no refund/i.test(t)) marks.push('nonref'); if (/wine tasting/i.test(t)) marks.push('wine'); if (/front seat/i.test(t)) marks.push('front_seat'); if (/\bPick-?up\b/i.test(t) && pickup && !/Meeting Point/i.test(t)) marks.push('pickup'); if (src === 'FreeTour') marks.push('freetour');
    const price = get(/Total \((?:USD|EUR|GEL)\)\s*:?\s*([^\n]+)/i) ? get(/Total \(((?:USD|EUR|GEL))\)/i) + ' ' + get(/Total \((?:USD|EUR|GEL)\)\s*:?\s*\$?€?([\d,.]+)/i) : get(/(?:Price|Net Rate|Total(?: price)?|Amount(?: paid)?|Sales Price)\s*:?\s*((?:USD|EUR|GEL|\$|€|₾)\s*\$?\s*[\d,.]+)/i);
    const pnum = Number(String(price).replace(/[^\d.,]/g, '').replace(/,(?=\d{3}\b)/g, '').replace(',', '.')) || null, pcur = /EUR|€/.test(price) ? 'EUR' : /GEL|₾/.test(price) ? 'GEL' : price ? 'USD' : '';
    const status = /cancell?ed|cancellation/i.test(t.slice(0, 600)) ? 'cancel' : /amended|changed|modified|rescheduled|has been updated/i.test(t.slice(0, 600)) ? 'change' : 'new';
    const kind = /private/i.test(title) ? 'private' : /group|shared|small-group|join-in/i.test(title) ? 'group' : /private tour/i.test(t) ? 'private' : /join-in|small group/i.test(t) ? 'group' : '';
    const res = { src, ref, title, date: when.date, time: when.time, guest, adults, children, phone, email: email.toLowerCase(), lang, pickup, marks, price, pnum, pcur, status, kind };
    // Website (TrekkSoft) order lines: "2 x Tour name (24 November, 2026, 10:30)", then "Guest 1 / First name / Last name / phone" blocks.
    const tk = t.match(/^\s*(\d+)\s*x\s+(.+?)\s*\(([^()]*\d{4}[^()]*)\)\s*$/m);
    if (tk) {
      const w = parseWhen(tk[3]); res.title = tk[2].trim(); res.date = w.date || res.date; res.time = w.time || res.time; res.src = res.src || 'Website';
      res.kind = /private/i.test(res.title) ? 'private' : /group/i.test(res.title) ? 'group' : res.kind;
      const blocks = t.split(/\n\s*Guest\s+\d+\s*\n/i).slice(1), people = blocks.map(b => ({ name: [((b.match(/First name\s*:\s*([^\n]+)/i) || [])[1] || '').trim(), ((b.match(/Last name\s*:\s*([^\n]+)/i) || [])[1] || '').trim()].join(' ').trim(), phone: normPhone(((b.match(/Phone[^:\n]*:\s*(\+?[\d\s()-]{7,})/i) || [])[1] || '').replace(/[\s()-]/g, '')), email: ((b.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/) || [])[0] || '').toLowerCase(), child: /child|kid|infant/i.test(b) }));
      const n = Number(tk[1]) || people.length || 1, kids = people.filter(x => x.child).length;
      res.adults = n - kids; res.children = kids;
      if (people.length) { const lead = people.find(x => x.name) || people[0]; res.guest = lead.name || res.guest; res.phone = lead.phone || res.phone; res.email = lead.email || res.email; const others = people.filter(x => x !== lead && (x.name || x.phone)); if (others.length) res.others = others.map(x => [x.name, x.phone].filter(Boolean).join(' ')).join('; '); }
      const sums = [...t.matchAll(/\(\s*(USD|EUR|GEL)\s*([\d.,]+)\s*\)/gi)]; if (sums.length) { res.pnum = sums.reduce((s, m) => s + Number(m[2].replace(',', '')), 0); res.pcur = sums[0][1].toUpperCase(); res.price = `${res.pcur} ${res.pnum}`; }
    }
    return res;
  }
  // Similar tour names: shared words count, ignoring small words.
  const words = s => new Set(String(s || '').toLowerCase().replace(/[^a-z0-9\u10a0-\u10ff\u0400-\u04ff ]+/g, ' ').split(/\s+/).filter(w => w.length > 3 && !/^(tour|tours|from|with|tbilisi|day|trip|private|group|small|guided|hours|full|half|georgia|the|and)$/.test(w)));
  const simil = (x, y) => { const A = words(x), B = words(y); if (!A.size || !B.size) return 0; let n = 0; A.forEach(w => { if (B.has(w)) n++; }); return n / Math.min(A.size, B.size); };
  function pbMatch(pb) {
    const old = pb.ref ? db.bookings.find(b => (b.ref || '').toUpperCase() === pb.ref.toUpperCase()) : null;
    const cat = catalog().map(x => ({ x, s: simil(pb.title, x.title) + (pb.kind && x.kind === pb.kind ? 0.2 : 0) })).sort((p, q) => q.s - p.s)[0];
    const tours = pb.date ? db.tours.filter(x => x.date === pb.date && live(x)).map(x => ({ x, s: simil(pb.title, x.title) + (cat && cat.s >= 0.4 && x.title === cat.x.title ? 1 : 0) + (pb.time && x.start_time === pb.time ? 0.5 : 0) })).filter(y => y.s >= 0.5).sort((p, q) => q.s - p.s) : [];
    return { old, oldTour: old ? db.tours.find(x => x.id === old.tour_id) : null, cat: cat && cat.s >= 0.4 ? cat.x : null, tour: tours[0] ? tours[0].x : null };
  }
  function pasteHtml() {
    const pb = state.pb, mt = pb && pbMatch(pb);
    const row = (k, v) => (v ? `<dt>${T(k)}</dt><dd>${esc(v)}</dd>` : '');
    return `<div class="card f"><b>${T('pb_title')}</b><span class="muted small">${T('pb_text')}</span><textarea class="inp" id="pb-text" rows="6" placeholder="${T('pb_ph')}"></textarea><div class="bar"><button class="btn primary" data-act="pbread">${T('pb_read')}</button>${pb ? `<button class="btn" data-act="pbclear">${T('close')}</button>` : ''}</div>
      ${pb ? `<div class="f"><b>${esc(pb.status === 'cancel' ? T('pb_cancel') : pb.status === 'change' ? T('pb_change') : T('pb_new'))}${pb.src ? ' · ' + esc(pb.src) : ''}</b><dl class="fields">${row('ref', pb.ref)}${row('tour', pb.title)}${row('date', pb.date ? fmtDay(pb.date) : '')}${row('start', pb.time)}${row('guest', pb.guest)}${row('guests_cap', acText({ adults: pb.adults, children: pb.children, pax: pb.adults + pb.children }))}${row('phone', pb.phone ? phoneFlag(pb.phone).split(' ')[0] + ' ' + pb.phone : '')}${row('email', pb.email)}${row('guest_lang', pb.lang)}${row('guest_addr', pb.pickup)}${row('options', pb.marks.map(markLabel).join(', '))}${row('pb_others', pb.others)}${row('pb_price', pb.price)}</dl>
        ${!pb.date || !pb.guest ? `<div class="warnline soft">! ${T('pb_missing')}</div>` : ''}
        ${mt.old ? `<div class="banner small">${T('pb_known', { tour: mt.oldTour ? mt.oldTour.title + ', ' + fmtDay(mt.oldTour.date) : '—' })}</div>` : ''}
        <div class="bar">${pb.status === 'cancel' && mt.old ? `<button class="btn primary" data-act="pbgo" data-m="cancel">${T('pb_do_cancel')}</button>` : `<button class="btn primary" data-act="pbgo" data-m="add">${mt.old ? T('pb_do_update') : mt.tour ? T('pb_do_add', { tour: mt.tour.title + (mt.tour.start_time ? ' ' + mt.tour.start_time : '') }) : T('pb_do_new')}</button>`}</div>
        <span class="muted small">${T('pb_check')}</span></div>` : ''}</div>`;
  }
  // ---------- guest contacts from Setmore (Customers export) or any table with name, phone, email ----------
  // CSV without any library: commas or semicolons, quoted fields with commas or new lines inside.
  function csvRows(text) {
    const s = String(text || '').replace(/^\ufeff/, ''), first = s.split('\n')[0], sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
    const rows = []; let row = [], cell = '', q = false;
    for (let k = 0; k < s.length; k++) { const ch = s[k];
      if (q) { if (ch === '"') { if (s[k + 1] === '"') { cell += '"'; k++; } else q = false; } else cell += ch; }
      else if (ch === '"') q = true; else if (ch === sep) { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && s[k + 1] === '\n') k++; row.push(cell); rows.push(row); row = []; cell = ''; } else cell += ch; }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  async function loadXlsx() { if (!window.XLSX) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = res; s.onerror = () => rej(new Error('xlsx')); document.head.appendChild(s); }); }
  async function readContacts(file) {
    let rows;
    if (/\.csv$/i.test(file.name) || /csv|text\/plain/.test(file.type)) rows = csvRows(await file.text());
    else { await loadXlsx(); const wb = window.XLSX.read(await file.arrayBuffer(), { type: 'array' }); rows = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' }); }
    const hi = rows.findIndex(r => r.some(x => /name/i.test(x)) && r.some(x => /phone|mobile|email|e-mail/i.test(x))); if (hi < 0) throw new Error(T('ct_nohead'));
    const H = rows[hi].map(x => String(x).toLowerCase().trim()), col = re => H.findIndex(x => re.test(x));
    const cF = col(/^first/), cL = col(/^last|surname/), cN = col(/^(full |customer |client )?name$/), cP = col(/^(phone|mobile|cell)/), cP2 = col(/^(phone|mobile)\s*1$|alternate phone/), cE = col(/^e-?mail$/), cE2 = col(/^e-?mail\s*1$/), cC = col(/^notes?$/), cA = col(/pick-?up address|hotel/);
    const proxy = e => /reply\.|expmessaging|guest\.airbnb|@m\.expediapartnercentral|tripadvisor/i.test(e);
    const byKey = new Map(), out = []; let skipped = 0, merged = 0;
    for (const r of rows.slice(hi + 1)) {
      let name = (cN >= 0 ? r[cN] : [r[cF] || '', r[cL] || ''].join(' ')).replace(/\s+/g, ' ').trim();
      if (!name) { skipped++; continue; }
      name = (cleanName(name.replace(/\b(cancel\w*|no ?show|pack)\b/gi, '')) || name).trim();
      const phone = normPhone((cP >= 0 ? r[cP] : '') || (cP2 >= 0 ? r[cP2] : '')) || null;
      const email = [cE >= 0 ? r[cE] : '', cE2 >= 0 ? r[cE2] : ''].map(cleanEmail).find(x => x && !proxy(x)) || null;
      const notes = [cC >= 0 ? r[cC] : '', cA >= 0 ? r[cA] : ''].map(x => String(x || '').trim()).filter(Boolean).join(' · ') || null;
      const k = (phone && digits(phone).length >= 7 ? 'p' + digits(phone).slice(-9) : '') || (email ? 'e' + email : '') || 'n' + name.toLowerCase();
      const prev = byKey.get(k);
      if (prev) { merged++; if (!prev.email && email) prev.email = email; if (!prev.phone && phone) prev.phone = phone; if (notes && !(prev.notes || '').includes(notes)) prev.notes = [prev.notes, notes].filter(Boolean).join(' · '); continue; }
      const x = { name, phone, email, notes }; byKey.set(k, x); out.push(x);
    }
    const byName = new Map(); db.clients.forEach(c => { if (!c.anonymised_at && !digits(c.phone) && !c.email) byName.set((c.name || '').toLowerCase(), c); });
    let fresh = 0, upd = 0; const plan = out.map(x => { const d = digits(x.phone).slice(-9), hit = db.clients.find(c => !c.anonymised_at && ((d.length >= 7 && digits(c.phone).slice(-9) === d) || (x.email && (c.email || '').toLowerCase() === x.email))) || (d.length < 7 && !x.email ? byName.get(x.name.toLowerCase()) : null); if (hit) upd++; else fresh++; return { x, hit }; });
    state.ct = { plan, fresh, upd, skipped, merged }; render();
  }
  async function importContacts() {
    const ct = state.ct; if (!ct) return; const add = [], up = [];
    const touched = new Map();
    ct.plan.forEach(({ x, hit }) => { if (!hit) { add.push({ id: S.uid(), ...x }); return; } const m = touched.get(hit.id) || { ...hit }; let ch = false; ['phone', 'email', 'notes'].forEach(k => { if (!m[k] && x[k]) { m[k] = x[k]; ch = true; } }); if (ch) touched.set(hit.id, m); });
    up.push(...touched.values());
    await S.saveMany('clients', [...add, ...up]); logAct(`Imported guest contacts: ${add.length} new, ${up.length} updated`); state.ct = null; toast(T('ct_done', { n: add.length, u: up.length }));
  }
  function contactsImpHtml() {
    const ct = state.ct;
    return `<div class="card f"><b>${T('ct_title')}</b><span class="muted small">${T('ct_text')}</span><input class="inp" type="file" id="ct-file" accept=".xlsx,.xls,.csv" data-ch="ctfile">${ct ? `<b>${T('ct_found', { n: ct.fresh, u: ct.upd, s: ct.skipped })}</b>${ct.merged ? `<span class="muted small">${T('ct_merged', { n: ct.merged })}</span>` : ''}<div class="bar"><button class="btn primary" data-act="ctgo">${T('ct_go')}</button></div>` : ''}</div>`;
  }
  async function readImport(file) {
    if (/\.csv$/i.test(file.name)) { state.imp = parseSetmore(csvRows(await file.text())); render(); return; }
    await loadXlsx();
    const wb = window.XLSX.read(await file.arrayBuffer(), { type: 'array' });
    state.imp = parseSetmore(window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' }));
  }
  async function runImport() {
    const im = state.imp, palette = ['#6243bd', '#a8500c', '#1c7439', '#2f6f73', '#3b5bbd', '#7a5c00'];
    const ids = {};
    for (const n of im.members) {
      let v = im.map[n];
      if (v === 'new') { const p = { id: S.uid(), name: n, role: 'guide', color: palette[db.profiles.length % palette.length], lang: 'en', active: true, phone: '' }; await S.save('profiles', p); v = p.id; }
      ids[n] = v || null;
    }
    const have = new Set(db.tours.map(t => t.external_id).filter(Boolean)), keepT = new Set();
    const tours = im.tours.filter(t => ids[t.member] && !have.has(t.external_id)).map(t => { const { member, ...row } = t; const p = person(ids[member]); if (p && p.role === 'driver') row.driver_id = p.id; else row.guide_id = ids[member]; keepT.add(row.id); return row; });
    const bookings = im.bookings.filter(b => keepT.has(b.tour_id)), cids = new Set(bookings.map(b => b.client_id).filter(Boolean));
    await S.saveMany('clients', Object.values(im.clients).filter(c => cids.has(c.id) && !db.clients.some(x => x.id === c.id)));
    const offs = im.offs.filter(o => ids[o.member] && !db.time_off.some(x => x.user_id === ids[o.member] && x.date_from === o.date_from && x.date_to === o.date_to)).map(o => { const { member, ...row } = o; row.user_id = ids[member]; return row; });
    await S.saveMany('tours', tours); await S.saveMany('bookings', bookings); await S.saveMany('time_off', offs);
    state.imp = null; toast(T('imp_done', { tours: tours.length, offs: offs.length }));
  }

  // ---------- me ----------
  // ---------- pay over any period: this month, last month, a year, or any two dates ----------
  const monthEnd = mo => { const d = D(mo + '-01'); d.setMonth(d.getMonth() + 1); d.setDate(0); return iso(d); };
  function payRange() {
    const p = state.pay || (state.pay = { mode: 'month' }), td = today(), y = Number(td.slice(0, 4));
    if (p.mode === 'year') return { from: `${y}-01-01`, to: `${y}-12-31` };
    if (p.mode === 'lastyear') return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    if (p.mode === 'custom') { const from = p.from || `${y}-01-01`, to = p.to || td; return from <= to ? { from, to } : { from: to, to: from }; }
    const mo = p.mode === 'lastmonth' ? (() => { const d = D(td); d.setDate(1); d.setMonth(d.getMonth() - 1); return iso(d).slice(0, 7); })() : (state.listMonth || td.slice(0, 7));
    return { from: mo + '-01', to: monthEnd(mo), month: mo };
  }
  function rangeBar() {
    const p = state.pay || (state.pay = { mode: 'month' }), r = payRange();
    return `<div class="seg wrap">${['month', 'lastmonth', 'year', 'lastyear', 'custom'].map(k => `<button data-act="payrange" data-v="${k}" aria-pressed="${p.mode === k}">${T('pr_' + k)}</button>`).join('')}</div>
      ${p.mode === 'month' ? `<div class="bar"><input class="inp" type="month" id="mm" data-ch="listmonth" value="${esc(r.month)}" style="max-width:170px" aria-label="${T('month')}"></div>` : ''}
      ${p.mode === 'custom' ? `<div class="f"><div class="two"><label>${T('pr_from')}<input id="pr-from" type="date" data-ch="payfrom" value="${esc(r.from)}"></label><label>${T('pr_to')}<input id="pr-to" type="date" data-ch="payto" value="${esc(r.to)}"></label></div></div>` : ''}`;
  }
  function payData(id, from, to) {
    const months = {}, titles = {}; let base = 0, n = 0;
    for (const t of db.tours) {
      if (!live(t) || !involves(t, id) || t.date < from || t.date > to) continue;
      const pay = (t.guide_id === id ? payFor(t, 'guide') : 0) + (t.driver_id === id ? payFor(t, 'driver') : 0), mo = t.date.slice(0, 7);
      const m = months[mo] = months[mo] || { n: 0, pay: 0, adj: 0 }; m.n++; m.pay += pay; base += pay; n++;
      const ti = titles[t.title] = titles[t.title] || { n: 0, pay: 0 }; ti.n++; ti.pay += pay;
    }
    let adj = 0; db.pay_adjustments.forEach(x => { if (x.user_id === id && x.month >= from.slice(0, 7) && x.month <= to.slice(0, 7)) { const m = months[x.month] = months[x.month] || { n: 0, pay: 0, adj: 0 }; m.adj += Number(x.amount) || 0; adj += Number(x.amount) || 0; } });
    const r2 = v => Math.round(v * 100) / 100;
    return { n, base: r2(base), adj: r2(adj), total: r2(base + adj), months: Object.keys(months).sort().map(mo => ({ mo, ...months[mo], total: r2(months[mo].pay + months[mo].adj) })), titles: Object.entries(titles).sort((x, y) => y[1].pay - x[1].pay).slice(0, 6) };
  }
  function payRangeHtml(id, from, to, modal) {
    const d = payData(id, from, to), cur = rules().currency || 'GEL', max = Math.max(1, ...d.months.map(m => m.total)), nm = Math.max(1, d.months.length);
    return `${modal ? `<div class="hdr"><h2>${esc(pname(id))}</h2><button class="iconbtn" data-act="close" aria-label="${T('close')}">✕</button></div>` : ''}<p class="muted small num">${esc(fmtRange(from, to))}</p>
      <div class="stats"><div class="stat"><b>${nf(d.total)}</b>${esc(cur)}</div><div class="stat"><b>${d.n}</b>${T('tours_n')}</div><div class="stat"><b>${d.n ? nf(d.base / d.n) : 0}</b>${T('pr_pertour')}</div><div class="stat"><b>${nf(d.total / nm)}</b>${T('pr_permonth')}</div></div>
      ${d.months.length > 1 ? `<div class="card"><div class="bars">${d.months.map(m => `<button class="barcol" data-act="paymonth" data-m="${m.mo}" aria-label="${esc(m.mo)}: ${m.total}"><span class="num small">${m.total >= 1000 ? (m.total / 1000).toFixed(1) + 'k' : nf(m.total)}</span><i style="height:${Math.round(Math.max(0, m.total) / max * 100)}%"></i><span class="small">${esc(fmt(m.mo + '-01', { month: 'short' }))}</span></button>`).join('')}</div><span class="muted small">${T('pr_tap')}</span></div>` : ''}
      <div class="tablewrap"><table><tr><th>${T('month')}</th><th class="n">${T('tours_n')}</th><th class="n">${esc(cur)}</th><th class="n">${T('correction')}</th><th class="n">${T('total')}</th></tr>${d.months.map(m => `<tr><td><button class="btn sm" data-act="paymonth" data-m="${m.mo}">${esc(fmt(m.mo + '-01', { month: 'long', year: 'numeric' }))}</button></td><td class="n">${m.n}</td><td class="n">${nf(m.pay)}</td><td class="n">${m.adj ? (m.adj > 0 ? '+' : '') + nf(m.adj) : ''}</td><td class="n"><b>${nf(m.total)}</b></td></tr>`).join('') || `<tr><td colspan="5" class="muted">${T('no_tours')}</td></tr>`}${d.months.length > 1 ? `<tr><td><b>${T('total')}</b></td><td class="n">${d.n}</td><td class="n">${nf(d.base)}</td><td class="n">${d.adj ? nf(d.adj) : ''}</td><td class="n"><b>${nf(d.total)}</b></td></tr>` : ''}</table></div>
      ${d.titles.length ? `<div class="card"><b>${T('pr_bytour')}</b>${d.titles.map(([ti, v]) => `<div class="row"><span style="flex:1;min-width:0;overflow-wrap:anywhere">${esc(ti)} <span class="muted small num">×${v.n}</span></span><b class="num">${nf(v.pay)}</b></div>`).join('')}</div>` : ''}`;
  }
  // ---------- ideas to earn more: worked out from the schedule of the last 12 months ----------
  function advice(id) {
    if (memo['adv' + id]) return memo['adv' + id];
    const p = person(id) || {}, td = today(), from = addDays(td, -365), role = p.role === 'driver' ? 'driver' : 'guide', out = [], cur = rules().currency || 'GEL', week = weekOf(p);
    const all = db.tours.filter(t => live(t) && t.date >= from && t.date <= td), mine = all.filter(t => involves(t, id));
    const open = db.tours.filter(t => live(t) && t.date > td && t.date <= addDays(td, 14) && (role === 'guide' ? !t.guide_id : (!t.driver_id && kmOf(t.title) > 0)) && week[(D(t.date).getDay() + 6) % 7] && !tourDays(t).some(d => offOn(id, d) || toursOnDay(d).some(x => involves(x, id))));
    if (open.length) out.push(T('adv_open', { n: open.length, sum: nf(open.reduce((s, t) => s + (payFor(t, role) || 0), 0)), cur }));
    if (all.length >= 10) {
      if (role === 'guide') {
        const lg = String(p.languages || '').toUpperCase().split(/[\s,;]+/).filter(Boolean), byL = {}; all.forEach(t => { const l = String(t.language || '').toUpperCase(); if (l && !lg.includes(l)) byL[l] = (byL[l] || 0) + 1; });
        const topL = Object.entries(byL).sort((x, y) => y[1] - x[1])[0]; if (lg.length && topL && topL[1] >= 5) out.push(T('adv_lang', { lang: topL[0], n: topL[1] }));
        const done = new Set(mine.map(t => t.title)), byT = {}; all.forEach(t => { if (t.guide_id && !done.has(t.title)) { const c = catFind(t.title); if ((p.skills || []).length && c && p.skills.includes(String(c.id))) return; byT[t.title] = (byT[t.title] || 0) + 1; } });
        const topT = Object.entries(byT).sort((x, y) => y[1] - x[1])[0]; if (topT && topT[1] >= 8) out.push(T('adv_skill', { title: topT[0], n: topT[1] }));
      }
      const offIdx = week.map((x, i) => (x ? -1 : i)).filter(i => i >= 0);
      if (offIdx.length) { const n = all.filter(t => offIdx.includes((D(t.date).getDay() + 6) % 7)).length, pc = Math.round(n / all.length * 100); if (pc >= 10) out.push(T('adv_days', { days: offIdx.map(i => fmt(addDays('2024-01-01', i), { weekday: 'long' })).join(', '), p: pc })); }
      const avg = {}; ['private', 'group', 'custom'].forEach(k => { const ts = all.filter(t => t.kind === k); if (ts.length >= 5) avg[k] = ts.reduce((s, t) => s + (payFor(t, role) || 0), 0) / ts.length; });
      const best = Object.entries(avg).sort((x, y) => y[1] - x[1])[0], overall = all.reduce((s, t) => s + (payFor(t, role) || 0), 0) / all.length;
      if (best && mine.length >= 5 && best[1] > overall * 1.1) { const my = mine.filter(t => t.kind === best[0]).length / mine.length, team = all.filter(t => t.kind === best[0]).length / all.length; if (my < team - 0.1) out.push(T('adv_kind', { kind: T('kind_' + best[0]), avg: nf(best[1]), cur, my: Math.round(my * 100), team: Math.round(team * 100) })); }
      const sm = seasonByMonth().months, peak = sm.filter(x => x.peak).map(x => x.m), low = sm.filter(x => x.low).sort((x, y) => x.avg - y.avg)[0];
      let offPeak = 0; db.time_off.forEach(o => { if (o.user_id === id && o.status === 'approved' && o.type !== 'sick' && o.date_from >= from && peak.includes(Number(o.date_from.slice(5, 7)))) offPeak += daysBetween(o.date_from, o.date_to) + 1; });
      if (offPeak >= 3 && low) out.push(T('adv_peak', { n: offPeak, month: fmt(`2024-${p2(low.m)}-01`, { month: 'long' }) }));
      if (role === 'guide' && mine.length >= 5 && !db.offers.some(o => o.user_id === id)) out.push(T('adv_offer'));
    }
    return memo['adv' + id] = out.slice(0, 5);
  }
  const adviceHtml = id => { const a = advice(id); return a.length ? `<details class="sect advice"><summary>${T('adv_title')} (${a.length})</summary><div class="card f">${a.map(x => `<div class="row nw">${ico('coin')}<span style="flex:1;min-width:0">${esc(x)}</span></div>`).join('')}<span class="muted small">${T('adv_note')}</span></div></details>` : ''; };

  // ---------- pay disputes: "the pay for this tour is not right" ----------
  const myPayOn = (t, id) => (t.guide_id === id ? payFor(t, 'guide') : 0) + (t.driver_id === id ? payFor(t, 'driver') : 0);
  const disputeOf = (tourId, id) => db.pay_disputes.filter(x => x.tour_id === tourId && x.user_id === id).sort((x, y) => (y.created_at || '').localeCompare(x.created_at || ''))[0];
  const disputeTag = q => (q ? `<span class="tag ${q.status === 'accepted' ? 't-ok' : q.status === 'declined' ? 't-danger' : 't-warn'}">${T(q.status === 'open' ? 'dp_open_tag' : 'dp_' + q.status)}</span>` : '');
  function disputeModalHtml(m) {
    const t = db.tours.find(x => x.id === m.id) || {}, cur = rules().currency || 'GEL', q = disputeOf(m.id, me().id);
    return `<div class="hdr"><h2>${T('dp_title')}</h2><button class="iconbtn" data-act="close" aria-label="${T('close')}">✕</button></div>
      <p class="muted small">${esc(t.title || '')} · ${esc(t.date ? dateText(t) : '')}</p><div class="stats"><div class="stat"><b class="num">${nf(myPayOn(t, me().id))}</b>${T('dp_counted')} (${esc(cur)})</div></div>
      ${q ? `<div class="card f"><div class="row">${disputeTag(q)}<span class="muted small num">${esc((q.created_at || '').slice(0, 10))}</span></div><span class="small">${esc(q.message || '')}</span>${q.reply ? `<span class="small"><b>${T('dp_reply')}:</b> ${esc(q.reply)}</span>` : ''}</div>` : ''}
      ${!q || q.status !== 'open' ? `<form class="f" data-form="dispute"><label>${T('dp_expected')} (${esc(cur)})<input id="dp-exp" name="expected" type="number" min="0" step="any" inputmode="decimal"></label><label>${T('dp_why')}<textarea id="dp-msg" name="message" required maxlength="400" placeholder="${T('dp_hint')}"></textarea></label><div class="actions"><button type="button" class="btn" data-act="close">${T('close')}</button><button class="btn primary">${T('send')}</button></div></form>` : `<p class="muted small">${T('dp_wait')}</p>`}`;
  }
  async function decideDispute(id, ok) {
    const q = db.pay_disputes.find(x => x.id === id), t = db.tours.find(x => x.id === q.tour_id); if (!q) return;
    const amt = Number(($('#dp-amt-' + id) || {}).value), reply = (($('#dp-re-' + id) || {}).value || '').trim();
    if (ok && !(amt >= 0 && ($('#dp-amt-' + id) || {}).value !== '')) { toast(T('dp_need_amount')); return; }
    if (ok && t) { const row = { ...t }; if (t.guide_id === q.user_id) row.guide_pay = amt; else if (t.driver_id === q.user_id) row.driver_pay = amt; await S.save('tours', row); }
    await S.save('pay_disputes', { ...q, status: ok ? 'accepted' : 'declined', reply: reply || null, decided_by: me().id });
    await notify([q.user_id], ok ? 'dispute_accepted' : 'dispute_declined', { title: t ? t.title : '', date: t ? t.date : '', time: ok ? String(amt) : reply });
    logAct(`Pay dispute ${ok ? 'accepted' : 'declined'}: ${t ? t.title : ''}, ${t ? t.date : ''}, ${pname(q.user_id)}${ok ? ' → ' + amt : ''}`);
  }

  function statement(id, mo) {
    const rows = db.tours.filter(t => live(t) && involves(t, id) && t.date.slice(0, 7) === mo).sort((a, b) => a.date.localeCompare(b.date)).map(t => ({ t, pay: (t.guide_id === id ? payFor(t, 'guide') : 0) + (t.driver_id === id ? payFor(t, 'driver') : 0) }));
    const adj = db.pay_adjustments.filter(x => x.user_id === id && x.month === mo), base = rows.reduce((a, x) => a + x.pay, 0);
    return { rows, adj, base: Math.round(base * 100) / 100, total: Math.round((base + adj.reduce((a, x) => a + (Number(x.amount) || 0), 0)) * 100) / 100 };
  }
  // Personal expenses (meal, fuel, car service, accommodation, parking, other): each person adds their own, the admin marks what was paid back.
  const EXP_KINDS = ['meal', 'fuel', 'service', 'stay', 'parking', 'other'];
  const EXP_ICON = { meal: 'restaurant', fuel: 'local_gas_station', service: 'build', stay: 'hotel', parking: 'local_parking', other: 'receipt_long' };
  function expensesHtml(id, from, to) {
    const xs = (db.expenses || []).filter(x => x.user_id === id && x.date >= from && x.date <= to).sort((a, b) => b.date.localeCompare(a.date)), base = rules().currency || 'GEL';
    const sum = xs.reduce((n, x) => n + (Number(x.amount) || 0) * (rateOf(x.currency, x.date) || 0), 0), open = xs.filter(x => !x.paid_back).reduce((n, x) => n + (Number(x.amount) || 0) * (rateOf(x.currency, x.date) || 0), 0);
    const by = {}; xs.forEach(x => { by[x.kind] = (by[x.kind] || 0) + (Number(x.amount) || 0) * (rateOf(x.currency, x.date) || 0); });
    const mine = id === me().id, past = db.tours.filter(t => live(t) && involves(t, id) && t.date >= from && t.date <= to && t.date <= today()).length;
    return `<div class="card f expcard"><div class="bar"><b>${T('ex_title')}</b><span class="spacer"></span>${mine ? `<button class="btn sm primary" data-act="expnew">+ ${T('ex_add')}</button>` : ''}</div>
      ${xs.length ? `<div class="tsum num"><div>${T('ex_total')}: <b>${nf(Math.round(sum))} ${esc(base)}</b>${open && open !== sum ? ` · ${T('ex_open')}: <b>${nf(Math.round(open))} ${esc(base)}</b>` : ''}</div><div class="muted">${EXP_KINDS.filter(k => by[k]).map(k => `${T('ex_k_' + k)} ${nf(Math.round(by[k]))}`).join(' · ')}</div></div>
      <div class="explist">${xs.map(x => `<div class="exrow">${msi(EXP_ICON[x.kind] || 'receipt_long')}<span class="grow-l"><b>${T('ex_k_' + x.kind)}</b> <span class="num">${esc(nf(Number(x.amount) || 0))} ${esc(x.currency)}</span><span class="muted small"> · ${esc(fmtDay(x.date))}${x.tour_id ? ' · ' + esc(aliasOf((db.tours.find(t => t.id === x.tour_id) || {}).title || '')) : ''}${x.note ? ' · ' + esc(x.note) : ''}</span></span>${x.paid_back ? `<span class="tag t-ok">${T('ex_paid')}</span>` : isAdmin() ? `<button class="btn sm" data-act="exppaid" data-id="${x.id}">${T('ex_markpaid')}</button>` : mine ? `<button class="lnk" data-act="expdel" data-id="${x.id}">${T('remove')}</button>` : ''}</div>`).join('')}</div>`
        : `<span class="muted">${mine ? T(past ? 'ex_nudge' : 'ex_none', { n: past }) : T('ex_none_admin')}</span>`}</div>`;
  }
  function expModalHtml(m) {
    const d = m.draft, mine = db.tours.filter(t => live(t) && involves(t, me().id) && t.date <= today() && t.date >= addDays(today(), -45)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 25);
    return `<div class="hdr"><h2>${T('ex_add')}</h2><button class="iconbtn" data-act="close" aria-label="${T('close')}">✕</button></div>
      <form class="f" data-form="expense"><div class="kinds">${EXP_KINDS.map(k => `<label class="kind"><input type="radio" name="kind" value="${k}" ${d.kind === k ? 'checked' : ''}>${msi(EXP_ICON[k])}<span>${T('ex_k_' + k)}</span></label>`).join('')}</div>
        <div class="two"><label>${T('ex_amount')}<input name="amount" type="number" inputmode="decimal" min="0" step="any" required value="${esc(d.amount || '')}"></label><label>${T('currency')}<select name="currency">${CURRENCIES.map(c => opt(c, c, d.currency || rules().currency || 'GEL')).join('')}</select></label></div>
        <div class="two"><label>${T('date')}<input name="date" type="date" required value="${esc(d.date || today())}"></label><label>${T('tour')}<select name="tour_id"><option value="">—</option>${mine.map(t => opt(t.id, `${fmt(t.date, { day: 'numeric', month: 'short' })} ${aliasOf(t.title)}`, d.tour_id || '')).join('')}</select></label></div>
        <label>${T('notes')}<input name="note" value="${esc(d.note || '')}" placeholder="${T('ex_note_ph')}"></label>
        <div class="actions"><button type="button" class="btn" data-act="close">${T('cancel')}</button><button class="btn primary">${T('save')}</button></div></form>`;
  }
  function statementHtml(id, mo, modal) {
    const st = statement(id, mo), cur = rules().currency || 'GEL', pd = db.payout_details.find(x => x.id === id);
    const text = [`${pname(id)} · ${mo}`, ...st.rows.map(x => `${x.t.date} ${x.t.title}: ${x.pay} ${cur}`), `${T('total')}: ${st.total} ${cur}`].join('\n');
    return `${modal ? `<div class="hdr"><h2>${esc(pname(id))} · ${esc(mo)}</h2><button class="iconbtn" data-act="close" aria-label="${T('close')}">✕</button></div>` : ''}
      <div class="stats"><div class="stat"><b>${st.rows.length}</b>${T('tours_n')}</div><div class="stat"><b>${st.total}</b>${esc(cur)}</div></div>
      <div class="tablewrap"><table><tr><th>${T('date')}</th><th>${T('title')}</th><th class="n">${esc(cur)}</th></tr>${st.rows.map(x => `<tr><td class="num">${esc(dateText(x.t))}</td><td style="white-space:normal">${esc(x.t.title)} ${disputeTag(disputeOf(x.t.id, id))}${id === me().id && !isAdmin() ? ` <button class="lnk" data-act="dispute" data-id="${x.t.id}">${T('dp_btn')}</button>` : ''}</td><td class="n">${x.pay}</td></tr>`).join('') || `<tr><td colspan="3" class="muted">${T('no_tours')}</td></tr>`}${st.adj.map(x => `<tr><td><span class="tag t-warn">${T('correction')}</span></td><td style="white-space:normal">${esc(x.note || '')}${isAdmin() ? ` <button class="btn sm" data-act="adjdel" data-id="${x.id}">${T('remove')}</button>` : ''}</td><td class="n">${Number(x.amount) > 0 ? '+' : ''}${esc(x.amount)}</td></tr>`).join('')}${st.adj.length ? `<tr><td colspan="2"><b>${T('total')}</b></td><td class="n"><b>${st.total}</b></td></tr>` : ''}</table></div>
      ${rules().payNote ? `<p class="muted small">${esc(rules().payNote)}</p>` : ''}
      ${modal ? expensesHtml(id, mo + '-01', monthEnd(mo)) : ''}
      ${modal && isAdmin() ? `<form class="bar" data-form="adjust"><input type="hidden" name="user_id" value="${id}"><input type="hidden" name="month" value="${mo}"><input class="inp" id="adj-amount" name="amount" type="number" step="any" placeholder="${T('adj_amount')}" required style="max-width:130px"><input class="inp" id="adj-note" name="note" placeholder="${T('adj_note')}" required style="flex:1;min-width:140px"><button class="btn">+ ${T('correction')}</button></form>` : ''}
      ${pd && (pd.account || pd.bank_name) ? `<div class="card"><b>${T('payout')}</b><div class="small">${esc([pd.holder, pd.bank_name].filter(Boolean).join(' · '))}</div>${pd.account ? `<div class="row"><span class="num">${esc(pd.account)}</span><button class="btn sm" data-act="copy" data-v="${esc(pd.account)}">${T('copy')}</button></div>` : ''}</div>` : ''}
      <div class="actions"><button class="btn" data-act="copy" data-v="${esc(text)}">${T('copy')}</button>${modal && isAdmin() && id !== me().id ? `<button class="btn primary" data-act="sendstatement" data-id="${id}" data-m="${mo}">${T('send_statement')}</button>` : ''}</div>`;
  }
  function personStats(id) {
    const ts = db.tours.filter(t => live(t) && involves(t, id) && t.date <= today());
    const titles = {}; ts.forEach(t => titles[t.title] = (titles[t.title] || 0) + 1);
    const offMonths = new Set(db.time_off.filter(o => o.user_id === id && o.status === 'approved' && o.type !== 'sick').map(o => o.date_from.slice(0, 7)));
    const last3 = [0, 1, 2].map(i => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); return iso(d).slice(0, 7); });
    const sc = db.tour_ratings.filter(r => r.user_id === id);
    return { ts, titles, guests: ts.reduce((a, t) => a + (t.pax || 0), 0), multi: ts.filter(t => endOf(t) !== t.date).length, early: ts.filter(t => (t.start_time || '99') < '08:00').length,
      langs: new Set(ts.map(t => (t.language || '').toUpperCase()).filter(Boolean)).size, tasks: db.tasks.filter(k => k.done_by === id).length, rested: last3.filter(m => offMonths.has(m)).length,
      bears: ts.filter(t => /sabaduri/i.test(t.title)).length, scores: sc.length };
  }
  function statsHtml(id) {
    const y = state.year, s = personStats(id), inYear = s.ts.filter(t => t.date.startsWith(String(y)));
    const per = [...Array(12)].map((_, i) => inYear.filter(t => Number(t.date.slice(5, 7)) === i + 1).length), max = Math.max(1, ...per);
    const kinds = KINDS.map(k => [k, inYear.filter(t => t.kind === k).length]);
    const top = Object.entries(inYear.reduce((a, t) => (a[t.title] = (a[t.title] || 0) + 1, a), {})).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const sm = state.statMonth, mlist = sm ? inYear.filter(t => t.date.slice(5, 7) === sm) : [];
    const tot = totals(id, y);
    return `<div class="bar">${isAdmin() ? `<select class="inp" id="stat-user" data-ch="statuser" style="max-width:220px" aria-label="${T('person')}">${crew().map(p => opt(p.id, p.name, id)).join('')}</select>` : ''}<div class="seg"><button data-act="year" data-d="-1" aria-label="${T('prev')}">‹</button><button disabled>${y}</button><button data-act="year" data-d="1" aria-label="${T('next')}">›</button></div></div>
      <div class="stats"><div class="stat"><b>${inYear.length}</b>${T('tours_n')}</div><div class="stat"><b>${inYear.reduce((a, t) => a + (t.pax || 0), 0)}</b>${T('guests')}</div><div class="stat"><b>${tot.off}</b>${T('rp_off')}</div><div class="stat"><b>${game(id).level}</b>${T('level')}</div>${(person(id) || {}).role !== 'driver' ? `<div class="stat"><b>${db.offers.filter(o => o.user_id === id && (o.at || '').startsWith(String(y))).length}</b>${T('offers_sent')}</div>` : ''}</div>
      <div class="card"><b>${T('st_months')}</b><span class="muted small">${T('st_tap')}</span><div class="bars">${per.map((n, i) => `<button class="barcol ${sm === p2(i + 1) ? 'sel' : ''}" data-act="statmonth" data-m="${p2(i + 1)}" aria-label="${esc(fmt(`2024-${p2(i + 1)}-01`, { month: 'long' }))}: ${n}"><span class="num small">${n || ''}</span><i style="height:${Math.round(n / max * 100)}%"></i><span class="small">${esc(fmt(`2024-${p2(i + 1)}-01`, { month: 'short' }))}</span></button>`).join('')}</div>
        ${sm ? `<div class="list">${mlist.map(t => `<button class="card" data-act="tour" data-id="${t.id}"><span class="row"><b class="num">${esc(dateText(t))}</b><span class="tag t-${esc(t.kind)}">${T('kind_' + t.kind)}</span><span class="tag t-muted num">${esc(acText(t))}</span></span><span class="ttl">${esc(t.title)}</span></button>`).join('') || `<div class="empty">${T('no_tours')}</div>`}</div>` : ''}</div>
      <div class="cols"><div class="card"><b>${T('st_kinds')}</b>${kinds.map(([k, n]) => `<div class="row"><span class="tag t-${k}">${T('kind_' + k)}</span><span class="meter"><i style="width:${inYear.length ? Math.round(n / inYear.length * 100) : 0}%"></i></span><b class="num">${n}</b></div>`).join('')}</div>
      <div class="card"><b>${T('st_top')}</b>${top.map(([t, n]) => `<div class="row"><span style="flex:1;min-width:0;overflow-wrap:anywhere">${esc(t)}</span><b class="num">${n}</b></div>`).join('') || `<span class="muted small">${T('no_tours')}</span>`}</div></div>`;
  }
  function badgesHtml(id) {
    const g = game(id), delta = (a, b) => (a === b ? '' : ` <span class="muted small num">${a > b ? '+' : '−'}${nf(Math.abs(a - b))}</span>`);
    const next = g.list.filter(b => !b.done && !b.hidden && b.track !== 'master' && b.have > 0).sort((x, y) => y.have / y.goal - x.have / x.goal).slice(0, 3);
    const tracks = [['titles', T('tr_titles')], ['all', ''], ['master', T('tr_master')], ['guide', T('tr_guide')], ['driver', T('tr_driver')], ['own', T('tr_own')], ['delica', 'Delica'], ['new', T('tr_new')], ['now', T('tr_now')], ['geo', T('tr_geo')], ['fun', T('tr_fun')], ['secret', T('tr_secret')]];
    const pals = Object.entries(g.partners).sort((x, y) => y[1] - x[1]).slice(0, 3);
    return `<div class="card lvl"><div class="row nw">${avatar(id, true)}<div class="grow-l" style="flex-direction:column;align-items:stretch;gap:4px;min-width:0"><b class="lvn">${T('level')} ${g.level}</b><details class="lvhelp"><summary class="lnk small">${T('lv_how')}</summary><p class="small">${T('lv_text')}</p><ul class="small"><li>${T('lv_tour')}</li><li>${T('lv_guest')}</li><li>${T('lv_km')}</li><li>${T('lv_badge')}</li></ul><p class="small muted">${T('lv_steps')}</p></details><span class="meter"><i style="width:${Math.round((g.xp - g.base) / (g.next - g.base) * 100)}%"></i></span><span class="muted small num">${T('g_xp', { xp: nf(g.xp), next: nf(g.next) })} · ${g.done}/${g.list.length} ${T('badges').toLowerCase()}</span></div></div></div>
      <h3>${T('g_month')}</h3><div class="stats"><div class="stat"><b>${g.weekNow}</b>${T('g_week')}</div><div class="stat"><b>${g.cur.tours}</b>${T('g_thismonth')}${delta(g.cur.tours, g.prev.tours)}</div><div class="stat"><b>${g.yearNow}</b>${T('g_year')}</div><div class="stat"><b>${nf(g.cur.guests)}</b>${T('guests')}${delta(g.cur.guests, g.prev.guests)}</div>${g.isD ? `<div class="stat"><b>${nf(g.cur.km)}</b>km${delta(g.cur.km, g.prev.km)}</div>` : ''}<div class="stat"><b>${Math.round(g.regs.size / REGIONS.length * 100)}%</b>${T('g_geo')}</div></div>
      ${next.length ? `<h3>${T('g_next')}</h3><div class="medals">${next.map(b => medal(b)).join('')}</div>` : ''}
      ${tracks.map(([k, label]) => { const bs = g.list.filter(b => b.track === k).sort((x, y) => (k === 'secret' ? y.done - x.done : 0)); return bs.length ? `${label ? `<h3>${esc(label)}</h3>` : ''}<div class="medals">${bs.map(b => medal(b)).join('')}</div>` : ''; }).join('')}
      <div class="card f"><b>${T('g_together')}</b>${pals.map(([pid, n]) => `<div class="row">${avatar(pid)}<span style="flex:1;min-width:0">${esc(T('g_with', { name: pname(pid), n }))}</span>${n >= 50 ? `<span class="tag t-ok">50+</span>` : ''}</div>`).join('') || `<span class="muted small">${T('no_tours')}</span>`}
        ${g.isG ? `<div class="row">${ico('heart')}<span>${T('g_repeat', { n: g.rep })}</span></div>` : ''}${g.isD ? `<div class="row">${ico('moon')}<span>${T('g_moon', { km: nf(g.km), p: (g.km / 384400 * 100).toFixed(g.km / 384400 < 0.1 ? 2 : 1) })}</span></div>` : ''}${g.isG && g.walk ? `<div class="row">${ico('boot')}<span>${T('g_walked', { km: nf(g.walk) })}</span></div>` : ''}</div>
      <p class="muted small">${T('badges_text')} ${T('g_note')}</p>`;
  }
  function meHtml() {
    const m = me(), perm = ('Notification' in window) ? Notification.permission : 'unsupported', tab = state.meTab, mo = state.listMonth || today().slice(0, 7);
    const pd = db.payout_details.find(x => x.id === m.id) || {};
    let h = `<div class="bar"><h2>${T('nav_me')}</h2><span class="spacer"></span>${helpBtn()}</div>${helpBox('me')}<div class="seg">${['profile', 'settings', 'month', 'stats', 'badges'].map(x => `<button data-act="metab" data-v="${x}" aria-pressed="${tab === x}">${T('me_' + x)}</button>`).join('')}</div>`;
    if (tab === 'month') { const pr = payRange(); return h + rangeBar() + (pr.month ? statementHtml(m.id, pr.month, false) : payRangeHtml(m.id, pr.from, pr.to, false)) + expensesHtml(m.id, pr.from, pr.to) + adviceHtml(m.id); }
    if (tab === 'stats') return h + statsHtml(isAdmin() ? (state.statUser || m.id) : m.id);
    if (tab === 'badges') return h + badgesHtml(m.id);
    if (tab === 'settings') return h + settingsHtml(m, perm);
    return h + `<div class="cols"><div class="list"><div class="card f">
      <div class="row">${avatar(m.id, true)}<div><b>${esc(m.name)}</b> <span class="tag t-muted">${T('role_' + m.role)}</span>${m.email ? `<div class="muted small">${esc(m.email)}</div>` : ''}</div></div>
      <div class="bar"><label class="btn filebtn">${msi('photo_camera')}${T('photo_upload')}<input type="file" id="me-photo" class="vh" accept="image/*" data-ch="avatar"></label></div>
      <details class="sect avpick" ${state.avOpen ? 'open' : ''}><summary>${T('av_choose')}</summary>${(() => { const cur = avLib(m.avatar) || { icon: '', color: state.avColor || m.color || AV_COLORS[0] }, col = state.avColor || cur.color; return `<div class="avcols">${AV_COLORS.map(c => `<button type="button" class="avcol" data-act="avcolor" data-v="${c}" style="background:${c}" aria-pressed="${c === col}" aria-label="${c}"></button>`).join('')}</div><div class="avgrid">${AV_ICONS.map(k => `<button type="button" class="avopt" data-act="avpick" data-v="ms:${k}:${col}" aria-pressed="${cur.icon === k}" style="background:${col}">${msi(k)}</button>`).join('')}</div>${m.avatar ? `<button type="button" class="lnk" data-act="avpick" data-v="">${T('av_none')}</button>` : ''}`; })()}</details>
      <form class="f" data-form="mydetails" id="me-details"><b>${T('md_title')}</b><div class="two"><label>${T('phone')}<input name="phone" type="tel" value="${esc(m.phone || '')}" placeholder="+995…" autocomplete="tel"></label><label>${T('md_langs')}<input name="languages" value="${esc(m.languages || '')}" placeholder="EN, RU, KA"></label></div>${(rules().promos || {})[m.id] ? `<div class="tsum">${T('promo_mine', { code: rules().promos[m.id] })}</div>` : ''}<div class="actions"><button class="btn qsave">${T('save')}</button></div></form>
      <form class="f" data-form="mytg"><b>Telegram</b><span class="muted small">${T('tg_mine_text')}</span><div class="bar"><input class="inp" id="me-tg" name="telegram" value="${esc(m.telegram ? '@' + m.telegram : '')}" placeholder="@username" autocomplete="off" autocapitalize="off" spellcheck="false" style="flex:1;min-width:150px"><button class="btn qsave">${T('save')}</button></div></form>
      ${/^https:\/\/t\.me\//.test(rules().botUrl || '') || m.telegram_id ? `<div class="f" id="me-tgbot"><b>${T('tg_title')}</b>${m.telegram_id ? `<span class="row"><span class="tag t-ok">${T('tg_on')}</span><span class="muted small">${T('tg_on_text')}</span></span>` : `<span class="muted small">${T('tg_text')}</span>${m.link_code ? `<div class="row"><b class="num tgcode">/link ${esc(m.link_code)}</b><button class="btn sm" data-act="copy" data-v="/link ${esc(m.link_code)}">${ico('copy')}${T('copy')}</button></div>` : ''}<div class="bar"><button class="btn sm" data-act="tgcode">${T(m.link_code ? 'tg_new' : 'tg_get')}</button>${/^https:\/\/t\.me\//.test(rules().botUrl || '') ? `<a class="btn sm" href="${esc(rules().botUrl)}" target="_blank" rel="noopener">${T('tg_open')}</a>` : ''}</div>`}</div>` : ''}
      </div>
      <div class="card f"><b>${T('pd_title')}</b><span class="muted small">${T('pd_text')}</span>
        <div class="pdlist">${db.personal_dates.filter(x => x.user_id === m.id).sort((x, y) => x.date.slice(5).localeCompare(y.date.slice(5))).map(x => `<div class="pdrow"><span class="pdic">${msi(PD_ICON[pdKind(x.title)] || 'event')}</span><span class="grow-l pdtx"><b>${esc(x.title)}</b><span class="muted small num">${esc(fmt(x.date, x.yearly ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' }))}${x.yearly ? ' · ' + T('pd_yearly') : ''}</span></span><button class="iconbtn" data-act="pdedit" data-id="${x.id}" aria-label="${T('edit')}" title="${T('edit')}">${msi('edit')}</button><button class="iconbtn" data-act="pdel" data-id="${x.id}" aria-label="${T('remove')}" title="${T('remove')}">${msi('delete')}</button></div>`).join('') || `<div class="empty">${T('pd_none')}</div>`}</div>
        <div class="actions"><button class="btn" data-act="pdnew">+ ${T('pd_add')}</button></div></div>
      <div class="card f ctlist"><b>${T('contacts')}</b>${staff().filter(p => p.phone || tgUser(p.telegram)).map(p => `<div class="row nw">${avatar(p.id)}<span class="row grow-l"><span>${esc(p.name)}</span><span class="muted small">${T('role_' + p.role)}</span></span>${staffBtns(p, true)}</div>`).join('') || `<span class="muted small">${T('no_contacts')}</span>`}</div>
      </div>
      <div class="list">${(() => { const acc = String(pd.account || ''), has = !!(pd.bank_name || pd.holder || acc), mask = acc ? '•••• ' + acc.replace(/\s/g, '').slice(-4) : '—';
        return has && !state.payEdit ? `<div class="card f"><b>${T('payout')}</b><span class="muted small">${T('payout_safe')}</span><dl class="fields"><dt>${T('bank_name')}</dt><dd>${esc(pd.bank_name || '—')}</dd><dt>${T('holder')}</dt><dd>${esc(pd.holder || '—')}</dd><dt>${T('account')}</dt><dd class="num">${esc(mask)}</dd></dl><div class="actions"><button class="btn" data-act="payshow">${T('edit')}</button></div></div>`
        : `<form class="card f" data-form="payout"><b>${T('payout')}</b><span class="muted small">${T('payout_safe')}</span><label>${T('bank_name')}<input id="pd-bank" name="bank_name" value="${esc(pd.bank_name || '')}" autocomplete="off"></label><label>${T('holder')}<input id="pd-holder" name="holder" value="${esc(pd.holder || '')}" autocomplete="off"></label><label>${T('account')}<input id="pd-acc" name="account" value="${esc(acc)}" autocomplete="off" autocapitalize="characters" spellcheck="false"></label><div class="actions">${has ? `<button type="button" class="btn" data-act="payshow">${T('close')}</button>` : ''}<button class="btn qsave">${T('save')}</button></div></form>`; })()}
      <form class="card f" data-form="worksched"><b>${T('ws_title')}</b><span class="muted small">${T('ws_text')}</span>${weekEditor(m)}<div class="actions"><button class="btn qsave">${T('save')}</button></div></form>
      ${m.role === 'guide' ? myToursHtml(m) : ''}</div></div>`;
  }
  // App settings, apart from the profile: how the app looks on this phone, language, notifications, install, privacy, sign out.
  function settingsHtml(m, perm) {
    return `<div class="cols"><div class="card f">
      <div class="f"><b>${T('ds_title')}</b>${displayHtml()}</div>
      <label>${T('language')}<select id="me-lang" data-ch="lang">${opt('en', 'English', lang())}${opt('ru', 'Русский', lang())}${opt('ka', 'ქართული', lang())}</select></label>
      ${notifCardHtml(perm)}<div class="checks col">${Object.keys(NOTE_GROUPS).map(g => `<label><input type="checkbox" id="mute-${g}" data-ch="mutepref" data-g="${g}" ${(m.mute || []).includes(g) ? '' : 'checked'}>${T('note_' + g)}</label>`).join('')}</div></div>
      </div><div class="list">${installCardHtml(true)}<div class="card f">
      <details class="sect"><summary>${T('privacy_link')}</summary><p class="muted small">${T('privacy_text', { n: pv().guideDays })}</p></details>
      <button class="btn" data-act="signout">${T('signout')}</button><span class="muted small num">${T('version')} ${APP_VERSION}${S.syncedAt ? ' · ' + T('updated_at', { time: new Intl.DateTimeFormat(LOCALES[lang()], { hour: '2-digit', minute: '2-digit' }).format(new Date(S.syncedAt)) }) : ''}</span></div></div></div>`;
  }
  function bellHtml() {
    const ns = myNotes().slice(0, 40);
    return `<div class="hdr"><h2>${T('notifications')}</h2><button class="iconbtn" data-act="close" aria-label="${T('close')}">✕</button></div>
      <div class="nlist">${ns.length ? ns.map(n => `<div class="nitem ${n.read ? '' : 'unread'}">${esc(noteText(n))}${tcBtns(n)}<div class="muted small">${esc(new Intl.DateTimeFormat(LOCALES[lang()], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(n.created_at)))}</div></div>`).join('') : `<div class="empty">${T('no_notifications')}</div>`}</div>`;
  }

  // ---------- render ----------
  const NAV = () => [['calendar', T('nav_calendar')], ['timeoff', T('nav_timeoff')], ['tasks', T('tasks')], ...(isAdmin() ? [['clients', T('nav_clients')], ['admin', T('nav_admin')]] : []), ['me', T('nav_me')]];
  let rendering = false;
  // The screen is patched in place: only the parts that changed are touched, so nothing flashes,
  // scroll position and open fields are kept, and new items fade in.
  const keyOf = n => (n.nodeType === 1 ? (n.id || n.getAttribute('data-key') || '') : '');
  const dirty = new WeakSet();   // plain form fields the person has typed in: never overwritten by a refresh
  function morphKids(oldP, newP, mark) {
    let o = oldP.firstChild;
    for (const n of [...newP.childNodes]) {
      const k = keyOf(n); let m = null;
      if (k) { for (let c = o; c; c = c.nextSibling) if (c.nodeType === 1 && c.nodeName === n.nodeName && keyOf(c) === k) { m = c; break; } }
      else if (o && o.nodeType === n.nodeType && o.nodeName === n.nodeName && !keyOf(o)) m = o;
      if (m) { if (m !== o) oldP.insertBefore(m, o); else o = o.nextSibling; morphNode(m, n); }
      else { const c = document.importNode(n, true); if (mark && c.nodeType === 1) c.classList.add('fresh'); oldP.insertBefore(c, o); }
    }
    while (o) { const x = o.nextSibling; oldP.removeChild(o); o = x; }
  }
  function morphNode(o, n) {
    if (o.nodeType !== 1) { if (o.nodeValue !== n.nodeValue) o.nodeValue = n.nodeValue; return; }
    if (o.id === 'modal' || o.id === 'toasts') return;
    const tag = o.nodeName;
    const keepOpen = tag === 'DETAILS' && (o.querySelector('summary') || {}).textContent === (n.querySelector('summary') || {}).textContent;
    for (const at of [...o.attributes]) if (!n.hasAttribute(at.name) && !(keepOpen && at.name === 'open')) o.removeAttribute(at.name);
    for (const at of [...n.attributes]) if (!(keepOpen && at.name === 'open') && o.getAttribute(at.name) !== at.value) o.setAttribute(at.name, at.value);
    if (tag === 'TEXTAREA') { if (o !== document.activeElement && o.value !== n.value) o.value = n.value; return; }
    morphKids(o, n, true);
    if (tag === 'INPUT') {
      const controlled = o.dataset.f || o.dataset.bf || o.dataset.bm || o.dataset.ch || o.dataset.cq || o.dataset.as;
      if (o.type === 'checkbox' || o.type === 'radio') { if ((controlled || !dirty.has(o)) && o.checked !== n.checked) o.checked = n.checked; }
      else if (o.type !== 'file' && o !== document.activeElement && (controlled || !dirty.has(o)) && o.value !== n.value) o.value = n.value;
    } else if (tag === 'SELECT' && o !== document.activeElement && o.value !== n.value) o.value = n.value;
  }
  let quietMorph = false;   // during a screen change the whole screen slides, so single items do not fade in as well
  function morph(root, html) { const tpl = document.createElement('template'); tpl.innerHTML = html; morphKids(root, tpl.content, root.childNodes.length > 0 && !quietMorph); }
  // Moving between screens: a short slide, like a native app (left or right by the order of the tabs). Phones without View Transitions just switch.
  const VIEW_ORDER = ['calendar', 'timeoff', 'tasks', 'clients', 'admin', 'me'];
  function slideTo(a, b, go) {   // a, b: positions of the old and new screen
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!document.startViewTransition || reduce || a === b) { go(); return; }
    document.documentElement.dataset.dir = b > a ? 'fwd' : 'back';
    quietMorph = true;
    try { const vt = document.startViewTransition(() => { try { go(); } finally { quietMorph = false; } }); vt.finished.finally(() => { delete document.documentElement.dataset.dir; }); } catch (e) { quietMorph = false; go(); }
  }
  document.addEventListener('input', ev => { const el = ev.target; if (el && el.nodeType === 1) dirty.add(el); }, true);
  // Day-first date fields: the number keyboard has no dot, so the dots are put in while typing (24111990 becomes 24.11.1990).
  document.addEventListener('input', ev => { const el = ev.target; if (!el || !el.classList || !el.classList.contains('dmy') || ev.inputType === 'deleteContentBackward') return; const d = el.value.replace(/\D/g, '').slice(0, 8); el.value = d.length > 4 ? `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4)}` : d.length > 2 ? `${d.slice(0, 2)}.${d.slice(2)}` : d.length === 2 ? d + '.' : d; }, true);
  // A quiet Save button lights up in the action colour only once something in its form has changed.
  const qsaveOn = () => document.querySelectorAll('form .qsave').forEach(b => { const f = b.closest('form'); b.classList.toggle('primary', [...f.elements].some(x => dirty.has(x))); });
  ['input', 'change'].forEach(t => document.addEventListener(t, ev => { if (ev.target && ev.target.form && ev.target.form.querySelector('.qsave')) { dirty.add(ev.target); qsaveOn(); } }, true));
  document.addEventListener('submit', ev => { [...(ev.target.elements || [])].forEach(el => dirty.delete(el)); }, true);

  function render() { if (rendering) return; rendering = true; try { renderNow(); } finally { rendering = false; } }
  function renderNow() {
    if (me() && me().active && maintHtml() === null) { const app = $('#app'); if (app) app.innerHTML = maintScreen(); return; }
    const t0 = performance.now(); memo = {};
    document.documentElement.lang = lang();
    const app = $('#app');
    if (!me() || !me().active) { state.modal = null; morph(app, authHtml() + '<div id="toasts"></div>'); return; }
    if (state.view === 'admin' && !isAdmin()) state.view = 'calendar';
    const unread = myNotes().filter(n => !n.read).length;
    const cur = state.view === 'admin' && state.adminTab === 'clients' ? 'clients' : state.view;
    const tb = me() && me().active ? tasksBadge() : 0;
    const nav = NAV().map(([k, l]) => `<button data-act="view" data-v="${k}" ${cur === k ? 'aria-current="page"' : ''}><span class="tabic">${ico(NAVIC[k])}${k === 'tasks' && tb ? `<i class="tabn num">${tb > 9 ? '9+' : tb}</i>` : ''}</span><span>${esc(l)}</span></button>`).join('');
    const body = state.view === 'calendar' ? calendarHtml() : state.view === 'timeoff' ? timeoffHtml() : state.view === 'tasks' ? tasksHtml() : state.view === 'admin' ? adminHtml() : meHtml();
    const demo = S.mode === 'demo' ? `<div class="banner slim"><b>${T('demo_title')}</b><span class="small only-wide">${T('demo_text')}</span><label class="small" for="demo-as">${T('demo_as')}</label><select id="demo-as" data-ch="demoas">${db.profiles.filter(p => p.active !== false).map(p => opt(p.id, `${p.name} · ${T('role_' + p.role)}`, me().id)).join('')}</select></div>` : '';
    const upd = S.syncedAt ? T('updated_at', { time: new Intl.DateTimeFormat(LOCALES[lang()], { hour: '2-digit', minute: '2-digit' }).format(new Date(S.syncedAt)) }) : T('refresh');
    const shell = `<header class="top"><div class="brand"><i></i>Friendly Schedule</div><nav class="nav" aria-label="Main">${nav}</nav><span class="spacer only-phone"></span>
      
      <button class="iconbtn ${state.refreshing ? 'spin' : ''}" data-act="refresh" aria-label="${T('refresh')}" title="${esc(upd)}">${ico('refresh')}</button>
      <button class="iconbtn" data-act="bell" aria-label="${T('notifications')}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>${unread ? `<span class="badge">${unread}</span>` : ''}</button><div class="subtop">${syncRow()}${testChip()}</div></header>
      ${maintHtml() || ''}${state.viewAs ? `<div class="vabar"><span>${T('va_now', { name: esc(me().name) })}</span><button class="btn sm" data-act="vaexit">${T('va_exit')}</button></div>` : ''}<main data-key="v-${state.view}-${state.view === 'admin' ? (state.adminTab || '') : state.view === 'me' ? state.meTab : ''}">${demo}${body}</main><nav class="tabs" aria-label="Main">${nav}</nav>`;
    const t1 = performance.now(); morph(app, shell + '<div id="modal"></div><div id="toasts"></div>');
    const hd = app.querySelector('header.top'); if (hd) document.documentElement.style.setProperty('--toph', hd.offsetHeight + 'px'); const sp = app.querySelector('.strip'); if (sp && sp.offsetHeight) document.documentElement.style.setProperty('--striph', sp.offsetHeight + 'px');
    window.__rt = { build: Math.round(t1 - t0), patch: Math.round(performance.now() - t1) }; syncNotice(); watchConn();
  }
  // ---------- one line that says how fresh the schedule is and whether my changes were delivered ----------
  const hm = iso => new Intl.DateTimeFormat(LOCALES[lang()], { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  function syncRow() {
    const n = S.pending || 0, at = S.syncedAt || S.cachedAt, old = at && Date.now() - new Date(at).getTime() > 10 * 60000;
    const st = S.offline ? 'off' : (n || S.syncing) ? 'send' : old ? 'old' : 'ok'; document.documentElement.classList.toggle('syncing', st === 'send');
    const tx = st === 'off' ? T('st_off', { time: at ? hm(at) : '—' }) + (n ? ' ' + T('st_wait', { n }) : '') : st === 'send' ? T('sync_wait', { n }) : st === 'old' ? T('st_old', { time: hm(at) }) : T('st_ok', { time: at ? hm(at) : '—' });
    return `<button class="syncrow s-${st}" data-act="refresh" aria-live="polite"><i></i><span class="num">${esc(tx)}</span>${S.failed ? `<span class="tag t-warn num">${T('st_failed', { n: S.failed })}</span>` : ''}${st === 'ok' ? '' : `<span class="lnk">${T(st === 'send' ? 'st_sending' : 'st_retry')}</span>`}</button>`;
  }
  // Delivery notices: saved on the phone while offline, and sent when the internet is back.
  let lastPending = 0;
  function syncNotice() { const n = S.pending || 0; if (n > lastPending && S.offline) toast(T('st_saved')); else if (lastPending > 0 && n === 0 && !S.offline) toast(T('st_sent')); lastPending = n; }
  // ---------- test period: ask people to report anything odd ----------
  // Maintenance: the admin switches it on in Rules (or in config.js when the database itself is down).
  const maint = () => { const s = (db.settings.find(x => x.id === 'maintenance') || {}).value || {}; return CFG.maintenance ? { on: true, text: String(CFG.maintenance) } : s; };
  function maintHtml() {
    const m = maint(); if (!m.on || !me()) return '';
    if (isAdmin()) return `<div class="banner small warnbn"><b>${T('mt_on_admin')}</b><span>${esc(m.text || '')}</span></div>`;
    if (state.mtSkip) return `<div class="banner small warnbn"><b>${T('mt_title')}</b><span>${T('mt_readonly')}</span></div>`;
    return null;
  }
  function maintScreen() { const m = maint(); return `<main><div class="status-screen"><span class="big-ico">${ico('clock')}</span><h2>${T('mt_title')}</h2><p>${esc(m.text || T('mt_text'))}</p><p class="muted small">${T('mt_hint')}</p><div class="bar"><button class="btn primary" data-act="mtskip">${T('mt_show')}</button><button class="btn" onclick="location.reload()">${T('refresh')}</button></div></div></main>`; }
  const testOn = () => CFG.testBanner !== false;
  const testChip = () => (testOn() ? `<button class="testchip" data-act="testinfo">${T('tb_chip')}</button>` : '');
  function testModalHtml() {
    const who = CFG.reportTo || 'Alex', ph = String(CFG.reportWhatsApp || '').replace(/\D/g, '');
    const msg = `Friendly Schedule ${APP_VERSION} · ${state.view}${state.view === 'calendar' ? '/' + state.mode : ''} · ${lang()} · ${/Android/i.test(navigator.userAgent) ? 'Android' : /iPhone|iPad/i.test(navigator.userAgent) ? 'iPhone' : 'computer'} ${window.innerWidth}px\n`;
    return `<div class="hdr"><h2>${T('tb_title')}</h2><button class="iconbtn" data-act="close" aria-label="${T('close')}">✕</button></div>
      <p>${T('tb_text', { name: who })}</p><ol class="small muted tbsteps"><li>${T('tb_s1')}</li><li>${T('tb_s2', { name: who })}</li><li>${T('tb_s3')}</li></ol><form class="f" data-form="bugnote"><label>${T('pr_note')}<textarea name="note" rows="2" placeholder="${T('pr_note_ph')}"></textarea></label><button class="btn sm">${T('pr_send')}</button></form>
      <div class="actions"><button class="btn" data-act="close">${T('close')}</button>${ph ? `<a class="btn primary" href="${esc(waLink(ph, msg))}" target="_blank" rel="noopener">${T('tb_send', { name: who })}</a>` : ''}</div>`;
  }
  let modalKey = '';
  // Phone Back button / back gesture: closes the open window first, then leaves a Back office page, like a native app.
  let navStack = 0, skipPop = 0, modalHist = false, adminHist = false;
  function navPush() { try { history.pushState({ fs: ++navStack }, ''); } catch (e) { /* not allowed here */ } }
  function navPop() { if (navStack > 0) { navStack--; skipPop++; try { history.back(); } catch (e) { skipPop--; } } }
  window.addEventListener('popstate', () => {
    if (skipPop) { skipPop--; return; } if (navStack > 0) navStack--;
    if (state.modal && state.modal.touched) { navPush(); guardClose(() => { state.modal = null; renderModal(); render(); }); return; }
    if (state.modal) { modalHist = false; state.modal = null; renderModal(); render(); }
    else if (state.view === 'admin' && state.adminTab) { adminHist = false; state.adminTab = null; render(); window.scrollTo(0, 0); }
  });
  function renderModal() {
    const el = $('#modal'); if (!el) return; const m = state.modal;
    if (m && !modalHist) { modalHist = true; navPush(); } else if (!m && modalHist) { modalHist = false; navPop(); }
    if (!m) { el.innerHTML = ''; modalKey = ''; return; }
    const inner = m.type === 'exp' ? expModalHtml(m) : m.type === 'tnames' ? tnamesHtml(m) : m.type === 'tour' ? tourModalHtml(m) : m.type === 'off' ? offModalHtml(m) : m.type === 'task' ? taskModalHtml(m) : m.type === 'client' ? clientModalHtml(m) : m.type === 'offer' ? offerModalHtml(m) : m.type === 'guest' ? guestSheetHtml(m) : m.type === 'creq' ? creqModalHtml(m) : m.type === 'cancel' ? cancelModalHtml(m) : m.type === 'person' ? personModalHtml(m) : m.type === 'invite' ? inviteModalHtml(m) : m.type === 'tip' ? tipModalHtml(m) : m.type === 'share' ? shareModalHtml(m) : m.type === 'test' ? testModalHtml() : m.type === 'display' ? `<div class="hdr"><h2>${T('ds_title')}</h2><button class="iconbtn" data-act="close" aria-label="${T('close')}">✕</button></div><div class="f">${displayHtml()}</div>` : m.type === 'move' ? moveModalHtml(m) : m.type === 'celebrate' ? celebrateHtml(m) : m.type === 'cat' ? catModalHtml(m) : m.type === 'dispute' ? disputeModalHtml(m) : m.type === 'prange' ? payRangeHtml(m.id, payRange().from, payRange().to, true) : m.type === 'badge' ? badgeModalHtml(m) : m.type === 'summary' ? summaryHtml(m) : m.type === 'statement' ? statementHtml(m.id, m.month, true) : m.type === 'pstats' ? `<div class="hdr"><h2>${T(state.mode === 'month' ? 'inc_month' : 'inc_week')}</h2><button class="iconbtn" data-act="close" aria-label="${T('close')}">✕</button></div>${periodStatsHtml(m.from, m.to).replace('<details class="wstats">', '<details class="wstats" open>')}` : m.type === 'addmenu' ? addMenuHtml() : m.type === 'pdate' ? pdModalHtml(m) : m.type === 'confirm' ? `<div class="hdr"><h2>${esc(m.text)}</h2></div><div class="actions"><button class="btn" data-act="close">${T('close')}</button><button class="btn danger" data-act="confirmyes">${esc(m.yes)}</button></div>` : bellHtml();
    const key = m.type + ':' + (m.id || (m.draft && m.draft.id) || '') + ':' + (m.edit ? 'e' : '');
    morph(el, `<div class="overlay" data-act="backdrop"><div class="sheet" role="dialog" aria-modal="true">${inner}</div></div>`);
    if (key !== modalKey) { const sh = el.querySelector('.sheet'); if (sh) sh.scrollTop = 0; modalKey = key; }
    refreshTourWarn(); refreshOffWarn();
  }
  const confirmDo = (text, yes, fn) => { state.modal = { type: 'confirm', text, yes, fn }; renderModal(); };
  // Closing a window with typed but unsaved data asks first. The question is drawn on top, so nothing typed is lost if the person stays.
  document.addEventListener('input', ev => { const el = ev.target; if (state.modal && el && el.closest && el.closest('#modal form') && el.type !== 'search') state.modal.touched = true; }, true);
  document.addEventListener('submit', ev => { if (state.modal && ev.target.closest && ev.target.closest('#modal')) state.modal.touched = false; }, true);
  function guardClose(go) {
    const m = state.modal; if (!m || !m.touched) { go(); return; }
    if (document.getElementById('askbox')) return;
    const box = document.createElement('div'); box.id = 'askbox'; box.className = 'askbox'; box.setAttribute('role', 'alertdialog');
    box.innerHTML = `<div class="askcard"><b>${T('unsaved_ask')}</b><div class="actions"><button type="button" class="btn" data-a="drop">${T('unsaved_drop')}</button><button type="button" class="btn primary" data-a="keep">${T('unsaved_keep')}</button></div></div>`;
    box.addEventListener('click', ev => { const a = ev.target.closest('[data-a]'); if (!a) return; ev.stopPropagation(); box.remove(); if (a.dataset.a === 'drop') { m.touched = false; go(); } });
    document.body.appendChild(box); box.querySelector('[data-a=keep]').focus();
  }
  const closeModal = () => { state.modal = (state.modal && state.modal.back) || null; if (state.modal && state.modal.type === 'tour' && !state.modal.edit) { const fresh = db.tours.find(x => x.id === state.modal.draft.id); if (fresh) { state.modal.draft = { ...fresh, bookings: tourBookings(fresh.id).map(b => ({ ...b, marks: [...(b.marks || [])] })) }; } } renderModal(); };

  // ---------- events ----------
  const acts = {
    prelangb(el) { S.ls.set('fs-lang', el.dataset.v); render(); },
    view(el) { const from = state.view === 'admin' && state.adminTab === 'clients' ? 'clients' : state.view; slideTo(VIEW_ORDER.indexOf(from), VIEW_ORDER.indexOf(el.dataset.v), () => acts.viewNow(el)); },
    viewNow(el) { state.view = el.dataset.v; if (state.view === 'clients') { state.view = 'admin'; state.adminTab = 'clients'; state.q = ''; } else if (state.view === 'admin') state.adminTab = null; try { history.replaceState(null, '', '#' + state.view); } catch (e) { location.hash = state.view; } render(); window.scrollTo(0, 0); },
    nav(el) { const n = Number(el.dataset.d); if (state.mode === 'week') state.date = addDays(state.date, 7 * n); else { const d = D(state.date); d.setDate(1); d.setMonth(d.getMonth() + n); state.date = iso(d); } render(); document.querySelectorAll('main .mgrid, main .gridwrap, main .list').forEach(e => { e.classList.remove('sl-n', 'sl-p'); void e.offsetWidth; e.classList.add(n > 0 ? 'sl-n' : 'sl-p'); }); },
    today() { state.date = today(); render(); toToday(); },
    mode(el) { state.mode = el.dataset.m; render(); },
    mine(el) { state.mine = el.dataset.v === '1'; render(); },
    day(el) { state.date = el.dataset.date; render(); const x = document.getElementById('day-' + state.date); if (x) x.scrollIntoView({ block: 'start', behavior: 'smooth' }); },
    pickday(el) { state.date = el.dataset.date; render(); const x = document.getElementById('day-' + state.date); if (x && window.matchMedia('(max-width:760px)').matches) x.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); },
    tour(el) { openTour(el.dataset.id); },
    newtour(el) { state.fabOpen = false; const who = el.dataset.who ? person(el.dataset.who) : null; const pre = {}; if (el.dataset.date) pre.date = el.dataset.date; if (who) pre[who.role === 'driver' ? 'driver_id' : 'guide_id'] = who.id; openTour(null, pre); },
    touredit() { state.modal.edit = true; renderModal(); },
    help() { state.help = !state.help; render(); },
    offer(el) { state.modal = { type: 'offer', bid: el.dataset.b || null, back: state.modal }; renderModal(); },
    offercopy(el) { logOffer(el.dataset.tour, el.dataset.b); acts.copy(el); },
    guest(el) { state.modal = { type: 'guest', id: el.dataset.id, back: state.modal }; renderModal(); },
    adjdel(el) { run(() => S.remove('pay_adjustments', el.dataset.id)).then(renderModal); },
    pdel(el) { run(() => S.remove('personal_dates', el.dataset.id)); },
    attend(el) {
      const m = state.modal, b = db.bookings.find(x => x.id === el.dataset.id); if (!b) return;
      const val = b.attendance === el.dataset.s ? null : el.dataset.s, t = db.tours.find(x => x.id === b.tour_id);
      const holder = m && m.back && m.back.draft ? m.back : m, db2 = holder && holder.draft && holder.draft.bookings && holder.draft.bookings.find(x => x.id === b.id); if (db2) db2.attendance = val;
      run(async () => { await S.save('bookings', { ...b, attendance: val }); if (val === 'noshow') { await notify(admins(), 'noshow', { name: b.guest, title: t ? t.title : '', date: t ? t.date : '' }); logAct(`No-show: ${b.guest}, ${t ? t.title : ''}`); } }).then(renderModal);
    },
    creq(el) { const t = db.tours.find(x => x.id === el.dataset.id); state.modal = { type: 'creq', draft: { tour_id: t.id, start_time: t.start_time || '', pickup: t.pickup || '', notes: t.notes || '', message: '', cant: false, swap_with: '' } }; renderModal(); },
    swapagree(el) { const q = db.change_requests.find(x => x.id === el.dataset.id), ok = el.dataset.s === '1', t = db.tours.find(x => x.id === q.tour_id) || {}; run(async () => { await S.save('change_requests', ok ? { ...q, agreed: true } : { ...q, status: 'declined' }); await notify([q.user_id, ...(ok ? admins() : [])], ok ? 'swap_yes' : 'swap_no', { name: me().name, title: t.title || '', date: t.date || '' }); }); },
    creqdecide(el) { run(() => decideCreq(el.dataset.id, el.dataset.s === '1')); },
    summary(el) { state.modal = { type: 'summary', date: (el && el.dataset && el.dataset.date) || state.date }; renderModal(); },
    copy(el) {
      const v = el.dataset.v || '', ok = () => toast(T('copied'));
      const old = () => { try { const ta = document.createElement('textarea'); ta.value = v; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0'; document.body.appendChild(ta); ta.select(); const done = document.execCommand('copy'); ta.remove(); done ? ok() : toast(T('copy_fail')); } catch (e) { toast(T('copy_fail')); } };
      try { navigator.clipboard.writeText(v).then(ok, old); } catch (e) { old(); }
    },
    score(el) { const tid = el.dataset.id, old = myScore(tid, me().id); run(() => S.save('tour_ratings', { id: old ? old.id : S.uid(), tour_id: tid, user_id: me().id, score: Number(el.dataset.s), created_at: new Date().toISOString() })).then(renderModal); },
    metab(el) { const tabs = ['profile', 'settings', 'month', 'stats', 'badges'], a = tabs.indexOf(state.meTab || 'profile'), b = tabs.indexOf(el.dataset.v); slideTo(a, b, () => { state.meTab = el.dataset.v; render(); }); if (el.dataset.v === 'badges') { S.repeatGuests(me().id).then(n => { if (n !== state.repeatN) { state.repeatN = n; render(); } }).catch(() => {}); S.myCounts(me().id).then(c => { if (JSON.stringify(c) !== JSON.stringify(state.counts || null)) { state.counts = c; render(); } }).catch(() => {}); } },
    payrange(el) { (state.pay = state.pay || {}).mode = el.dataset.v; render(); },
    paymonth(el) { state.pay = { ...(state.pay || {}), mode: 'month' }; state.listMonth = el.dataset.m; if (state.modal && state.modal.type === 'prange') state.modal = { type: 'statement', id: state.modal.id, month: el.dataset.m }; render(); renderModal(); },
    prange(el) { state.modal = { type: 'prange', id: el.dataset.id }; renderModal(); },
    dispute(el) { state.modal = { type: 'dispute', id: el.dataset.id, back: state.modal }; renderModal(); },
    dpdecide(el) { run(() => decideDispute(el.dataset.id, el.dataset.s === '1')); },
    badgesave(el) { badgeOut(el.dataset.k, false); },
    badgeshare(el) { badgeOut(el.dataset.k, true); },
    viponly() { state.vipOnly = !state.vipOnly; render(); },
    weekok(el) { const k = db.tasks.find(x => x.id === el.dataset.id); if (k) run(() => S.save('tasks', { ...k, status: 'done', done_by: me().id, done_at: new Date().toISOString() }), T('wk_done')); },
    tgcode() { const code = String(Math.floor(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296) * 900000)); run(() => S.save('profiles', { ...stripEmail(me()), link_code: code })); },
    car2(el) { run(async () => { const nid = await secondCar(el.dataset.id); if (nid) { toast(T('car2_done')); openTour(nid); state.modal.edit = true; } }).then(renderModal); },
    celeopen() { const m = state.modal; if (!m || m.type !== 'celebrate') return; m.opened = true; fx.box(); renderModal(); setTimeout(() => fx.badge(), 380); },
    celeok() { state.modal = null; renderModal(); checkBadges(); },
    badge(el) { state.modal = { type: 'badge', k: el.dataset.k }; renderModal(); },
    catedit(el) { const i = Number(el.dataset.i), c = i >= 0 ? catalog()[i] : { title: '', kind: 'private', days: 1 }; state.modal = { type: 'cat', i, draft: { ...c, dur: c.start && c.end ? durOf({ start_time: c.start, end_time: c.end }) : '', regions: [...regionsOf(c.title || '')] } }; renderModal(); },
    catdel() { const m = state.modal, items = catalog().slice(); confirmDo(T('cat_del_q', { name: m.draft.title }), T('cat_del'), async () => { items.splice(m.i, 1); await S.save('settings', { id: 'catalog', value: { items } }); toast(T('saved')); }); },
    statmonth(el) { state.statMonth = state.statMonth === el.dataset.m ? null : el.dataset.m; render(); },
    statement(el) { state.modal = { type: 'statement', id: el.dataset.id, month: el.dataset.m }; renderModal(); },
    sendstatement(el) { const st = statement(el.dataset.id, el.dataset.m); run(() => notify([el.dataset.id], 'statement', { title: el.dataset.m, time: `${st.total} ${rules().currency || 'GEL'}` }), T('sent')); },
    client(el) { if (el.dataset.id) { state.modal = { type: 'client', id: el.dataset.id, back: state.modal && ['tour', 'guest'].includes(state.modal.type) ? state.modal : null }; renderModal(); if (S.fetchClient) S.fetchClient(el.dataset.id).then(n => { if (n && state.modal && state.modal.type === 'client') { memo = {}; renderModal(); } }).catch(() => {}); } },
    rate(el) { const note = ($('#rate-note') || {}).value || null; run(async () => { const prev = db.client_ratings.find(r => r.client_id === el.dataset.id && r.user_id === me().id && ['like', 'dislike'].includes(r.rating) && ['like', 'dislike'].includes(el.dataset.r)); if (prev) await S.remove('client_ratings', prev.id); await S.save('client_ratings', { id: S.uid(), client_id: el.dataset.id, user_id: me().id, rating: el.dataset.r, note, created_at: new Date().toISOString() }); }, T('saved')).then(renderModal); },
    csv() {
      const mo = state.listMonth || today().slice(0, 7), q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
      const head = ['Date', 'End date', 'Start', 'End', 'Tour', 'Type', 'Status', 'Guide', 'Driver', 'Guest', 'Adults', 'Children', 'Phone', 'Booking ref', 'Marks', 'Notes', 'Pick-up'];
      const lines = [head.map(q).join(',')];
      db.tours.filter(t => t.date.slice(0, 7) <= mo && endOf(t).slice(0, 7) >= mo).sort((a, b) => a.date.localeCompare(b.date)).forEach(t => { const bk = tourBookings(t.id); (bk.length ? bk : [{ guest: '', adults: t.adults ?? t.pax, children: t.children || 0 }]).forEach(b => lines.push([t.date, endOf(t), t.start_time, t.end_time, t.title, t.kind, t.status, pname(t.guide_id), pname(t.driver_id), b.guest, b.adults, b.children, b.phone, b.ref, (b.marks || []).map(markLabel).join('; '), b.notes || t.notes, t.pickup].map(q).join(','))); });
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv' })); a.download = `tours-${mo}.csv`; document.body.appendChild(a); a.click(); a.remove();
    },
    // The phone's own share sheet (WhatsApp, Telegram, Messages, ...); WhatsApp link where the browser has none.
    reload() { location.reload(); },
    gcopen() { state.gcOpen = !state.gcOpen; if (state.gcOpen) state.gc = guestCheck(); render(); },
    gcrun() { state.gc = guestCheck(); render(); },
    async gcapply() {
      const off = state.gcOff || new Set(), on = (state.gc || []).filter(x => !off.has(x.kind)); if (!on.length) return; const now = new Date().toISOString(), rows = { bookings: {}, clients: {} };
      on.forEach(x => { const cur = rows[x.table][x.row.id] || { ...x.row }; Object.assign(cur, x.patch); if (x.table === 'bookings') cur.history = [...(Array.isArray(cur.history) ? cur.history : []), { at: now, w: 'checked', note: x.note, by: me().id }]; rows[x.table][x.row.id] = cur; });
      return run(async () => { for (const t of ['bookings', 'clients']) { const list = Object.values(rows[t]); if (list.length) await S.saveMany(t, list); } logAct(`Guest list check: ${on.length} fixes`); state.gc = guestCheck(); }, T('gc_done', { n: on.length }));
    },
    vastart() { const v = ($('#va-who') || {}).value; if (!v) return; state.viewAs = v; state.view = 'calendar'; state.adminTab = null; state.mine = true; render(); window.scrollTo(0, 0); },
    vaexit() { state.viewAs = null; state.view = 'admin'; state.mine = false; render(); window.scrollTo(0, 0); },
    expnew(el) { state.modal = { type: 'exp', draft: { kind: 'meal', date: (el && el.dataset.date) || today(), tour_id: (el && el.dataset.tour) || '', currency: rules().currency || 'GEL' } }; renderModal(); },
    expdel(el) { return run(() => S.remove('expenses', el.dataset.id), T('saved')); },
    exppaid(el) { const x = (db.expenses || []).find(y => y.id === el.dataset.id); if (x) return run(() => S.save('expenses', { ...x, paid_back: true }), T('saved')); },
    xctake(el) { const t = db.tours.find(x => x.id === el.dataset.id); if (!t) return; const role = el.dataset.role === 'driver' ? 'driver_id' : 'guide_id';
      return run(async () => { await S.save('change_requests', { id: S.uid(), tour_id: t.id, user_id: me().id, patch: { [role]: me().id }, cant: false, swap_with: null, agreed: false, message: null, status: 'pending', created_at: new Date().toISOString(), decided_by: null }); await notify(admins(), 'creq_new', { name: me().name, title: t.title, date: t.date }); }, T('xc_sent')); },
    xcback(el) { const q = db.change_requests.find(x => x.id === el.dataset.id); if (q) return run(() => S.remove('change_requests', q.id), T('xc_backed')); },
    async install() { if (!installEvt) return; installEvt.prompt(); try { await installEvt.userChoice; } catch (e) { /* closed */ } installEvt = null; render(); },
    instlater() { try { localStorage.setItem('fs-install-later', String(Date.now() + 7 * 86400000)); } catch (e) { /* private mode */ } render(); },
    mtskip() { state.mtSkip = true; render(); },
    testinfo() { state.modal = { type: 'test', back: state.modal }; renderModal(); },
    async share(el) {
      const text = el.dataset.v || '', title = el.dataset.title || 'Friendly Schedule';
      // The phone's own share sheet first. Where it is missing or blocked, our own list of ways to send.
      if (navigator.share && !window.__noNativeShare) { try { await navigator.share({ title, text }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
      state.modal = { type: 'share', title, text, back: state.modal }; renderModal();
    },
    move(el) { const t = db.tours.find(x => x.id === el.dataset.id); if (t) openMove(t, {}); },
    tipqr(el) { state.modal = { type: 'tip', id: el.dataset.id, back: state.modal }; renderModal(); },
    cancelask(el) { state.modal = { type: 'cancel', id: el.dataset.id, back: state.modal }; renderModal(); },
    tourrestore(el) { const t = db.tours.find(x => x.id === el.dataset.id); if (t) run(() => setCancelled(t, false)).then(() => { openTour(t.id); }); },
    pnew() { state.modal = { type: 'person', isNew: true, draft: { name: '', role: 'guide', email: '', phone: '', languages: '', color: ['#6243bd', '#a8500c', '#1c7439', '#2f6f73', '#3b5bbd', '#7a5c00'][db.profiles.length % 6] } }; renderModal(); },
    pedit(el) { const p = person(el.dataset.id); if (p) { state.modal = { type: 'person', draft: { ...p } }; renderModal(); } },
    pdelete(el) { const p = person(el.dataset.id); if (!p) return; confirmDo(T('delete_person_q', { name: p.name }), T('delete_person'), async () => { await S.removePerson(p.id); logAct(`Removed person: ${p.name}`); toast(T('saved')); }); },
    invdel(el) { run(() => S.remove('invites', el.dataset.id)); },
    wsame(el) { const box = el.closest('.wweek'), rows = [...box.querySelectorAll('.wrow')], src = rows.find(r => r.querySelector('[type=checkbox]').checked && r.querySelector('[name^=wf]').value) || rows[0], f = src.querySelector('[name^=wf]').value, t = src.querySelector('[name^=wt]').value; rows.forEach(r => { r.querySelector('[name^=wf]').value = f; r.querySelector('[name^=wt]').value = t; r.querySelectorAll("input").forEach(x => dirty.add(x)); }); qsaveOn(); },
    showpw() { state.showPw = !state.showPw; render(); },
    refresh() { if (state.refreshing) return; state.refreshing = true; render(); (async () => { try { if (S.offline) await S.sync(); else await S.pulse(); } catch (e) { console.error(e); } state.refreshing = false; render(); toast(T(S.offline ? 'offline_title' : 'up_to_date')); })(); },
    pvcount() { run(async () => { state.staleN = await S.staleGuests(pv().keepMonths); }); },
    pvrun() { confirmDo(T('pv_run_q', { n: state.staleN }), T('pv_run'), async () => { const n = await S.purgeGuests(pv().keepMonths); logAct(`Privacy clean-up: contact details of ${n} old guests removed`); state.staleN = 0; toast(T('pv_done', { n })); }); },
    gexport(el) { exportGuest(el.dataset.id); },
    gerase(el) { const c = db.clients.find(x => x.id === el.dataset.id); if (!c) return; const back = state.modal; confirmDo(T('pv_delete_q', { name: c.name }), T('pv_delete'), async () => { await S.eraseGuests([c.id]); logAct('Guest data erased on request'); toast(T('pv_done', { n: 1 })); }); },
    gpick(el) {
      const m = state.modal, i = Number(el.dataset.i), b = m.draft.bookings[i], cl = db.clients.find(x => x.id === el.dataset.c); if (!b || !cl) return;
      b.client_id = cl.id; const last = db.bookings.filter(x => x.client_id === cl.id).slice(-1)[0] || {};
      const fill = { guest: b.guest && cleanName(b.guest).length > 2 ? b.guest : cl.name, phone: b.phone || cl.phone || '', email: cleanEmail(b.email || cl.email), lang: b.lang || last.lang || '' };
      Object.entries(fill).forEach(([k, v]) => { b[k] = v; const inp = document.querySelector(`[data-bi="${i}"][data-bf="${k}"]`); if (inp) inp.value = v; });
      const f = $('#pflag-' + i); if (f) f.textContent = phoneFlag(normPhone(b.phone)); const box = $('#gsug-' + i); if (box) box.innerHTML = '';
      toast(T('linked_guest', { name: cl.name }));
    },
    availwk(el) { state.availWk = addDays(state.availWk || addDays(monday(today()), 7), Number(el.dataset.d)); render(); },
    availremind(el) { const wk = el.dataset.wk, ids = crew().filter(p => p.role !== 'admin' && !availOf(p, wk)).map(p => p.id); run(() => notify(ids, 'avail_remind', { date: wk }), T('av_sent', { n: ids.length })); },
    balm(el) { const mo = state.balMonth || today().slice(0, 7), d = new Date(Number(mo.slice(0, 4)), Number(mo.slice(5, 7)) - 1 + Number(el.dataset.d), 1); state.balMonth = iso(d).slice(0, 7); render(); },
    avcolor(el) { state.avColor = el.dataset.v; state.avOpen = true; render(); },
    avpick(el) { state.avOpen = false; run(() => S.save('profiles', { ...stripEmail(me()), avatar: el.dataset.v || null }), T('saved')); },
    gosetup(el) { const k = el.dataset.k || (setupSteps().find(x => !x.done) || {}).k; state.view = 'me'; state.meTab = 'profile'; if (k === 'photo') state.avOpen = true; render(); const x = document.getElementById(k === 'tours' ? 'me-tours' : k === 'photo' ? 'me-photo' : k === 'tg' ? (document.getElementById('me-tgbot') ? 'me-tgbot' : 'me-tg') : 'me-details'); if (x) x.scrollIntoView({ block: 'center', behavior: 'smooth' }); },
    async mytoursok() {
      const m = me(), list = catalog().filter(c => c.id), was = new Set((m.skills || []).length ? m.skills : list.map(c => String(c.id))), now = state.myTours || was;
      const add = list.filter(c => now.has(String(c.id)) && !was.has(String(c.id))).map(c => c.title), drop = list.filter(c => !now.has(String(c.id)) && was.has(String(c.id))).map(c => c.title);
      if (add.length || drop.length) await notify(admins(), 'tours_change', { name: m.name, add: add.join(', ') || '—', drop: drop.join(', ') || '—', user_id: m.id, add_ids: list.filter(c => now.has(String(c.id)) && !was.has(String(c.id))).map(c => String(c.id)), drop_ids: list.filter(c => !now.has(String(c.id)) && was.has(String(c.id))).map(c => String(c.id)) });
      state.myTours = null; await run(() => S.save('profiles', { ...stripEmail(m), display: { ...((m.display && typeof m.display === 'object') ? m.display : {}), toursOk: today() } }), T(add.length || drop.length ? 'mt_sent' : 'saved'));
    },
    tnames() { state.modal = { type: 'tnames' }; renderModal(); },
    async tnjoin(el) {
      const box = el.closest('.tncard'), on = [...box.querySelectorAll('input:checked')].map(x => ({ t: x.value, n: Number(x.dataset.n) || 0 }));
      if (on.length < 2) { toast(T('tn_need2')); return; }
      const main = on.slice().sort((p, q) => q.n - p.n)[0].t, al = { ...tourAlias() }, joinK = new Set(on.map(x => tourKey(x.t)));
      tnUnits().filter(u => joinK.has(u.key) || on.some(x => x.t === u.main)).forEach(u => Object.keys(u.names).forEach(n => { if (tourKey(n) !== tourKey(main)) al[tourKey(n)] = main; else delete al[tourKey(n)]; }));
      Object.keys(al).forEach(k => { if (on.some(x => x.t === al[k])) al[k] = main; });
      await tnSave(al); toast(T('tn_done', { n: on.length, main })); renderModal(); render();
    },
    async tnsplit(el) { const al = { ...tourAlias() }; Object.keys(al).forEach(k => { if (al[k] === el.dataset.v) delete al[k]; }); await tnSave(al); renderModal(); render(); },
    mergeask(el) { state.mergeAsk = el.dataset.ids; render(); },
    mergeno() { state.mergeAsk = null; render(); },
    mergedo(el) {
      const ids = el.dataset.ids.split(','), cnt = id => db.bookings.filter(b => b.client_id === id).length, cs = ids.map(id => db.clients.find(c => c.id === id)).filter(Boolean);
      const target = cs.slice().sort((x, y) => cnt(y.id) - cnt(x.id))[0], others = cs.filter(c => c.id !== target.id);
      const merged = { ...target }; others.forEach(o => { ['phone', 'email', 'notes'].forEach(k => { if (!merged[k] && o[k]) merged[k] = o[k]; }); });
      state.mergeAsk = null;
      run(async () => { await S.save('clients', merged); await S.mergeClients(target.id, others.map(o => o.id)); logAct(`Merged guests into ${target.name}: ${others.map(o => o.name).join(', ')}`); }, T('dup_done', { name: target.name }));
    },
    soundset(el) { try { localStorage.setItem('fs-sound', el.dataset.v); } catch (e) { /* private mode */ } if (!el.dataset.v) fx.ok(); render(); if (state.modal && state.modal.type === 'display') renderModal(); },
    dset(el) { setDisplay(el.dataset.k, el.dataset.v); render(); if (state.modal && state.modal.type === 'display') renderModal(); },
    displaybtn() { state.modal = { type: 'display' }; renderModal(); },
    payshow() { state.payEdit = !state.payEdit; render(); },
    pbread() { const v = ($('#pb-text') || {}).value || ''; if (!v.trim()) return; if (/New order of/i.test(v) && /Booked At/i.test(v) && !/getyourguide|viator/i.test(v)) { state.pb = null; run(() => forms.mail({ get: () => v })); return; } state.pb = parseBooking(v); render(); },
    pbclear() { state.pb = null; render(); },
    pbgo(el) {
      const pb = state.pb, mt = pbMatch(pb); if (!pb) return;
      if (el.dataset.m === 'cancel') { run(async () => { const b = mt.old; await S.remove('bookings', b.id); const t = mt.oldTour; if (t) { const rest = db.bookings.filter(x => x.tour_id === t.id); await S.save('tours', { ...t, adults: rest.reduce((n, x) => n + (+x.adults || 0), 0), children: rest.reduce((n, x) => n + (+x.children || 0), 0), pax: rest.reduce((n, x) => n + (+x.pax || 0), 0) }); } logAct(`Booking cancelled from email: ${pb.ref} (${b.guest})`); state.pb = null; }, T('pb_cancelled')); return; }
      const bk = { id: mt.old ? mt.old.id : S.uid(), client_id: mt.old ? mt.old.client_id : null, guest: pb.guest || (mt.old || {}).guest || '', adults: pb.adults, children: pb.children, phone: pb.phone || (mt.old || {}).phone || '', email: pb.email || (mt.old || {}).email || '', ref: pb.ref, lang: pb.lang, source: pb.src || null, marks: [...new Set([...((mt.old || {}).marks || []), ...pb.marks])], pickup_addr: pb.marks.includes('pickup') ? pb.pickup : '', notes: [(mt.old || {}).notes, pb.others ? T('pb_others') + ': ' + pb.others : ''].filter(Boolean).join(' · '), payment: (mt.old || {}).payment || 'prepaid', currency: pb.pcur || (mt.old || {}).currency || guestCur(), price: pb.pnum ?? (mt.old || {}).price ?? null, history: (mt.old || {}).history || [] };
      const target = mt.old && mt.oldTour && (!pb.date || pb.date === mt.oldTour.date) && (!pb.time || pb.time === mt.oldTour.start_time) ? mt.oldTour : mt.tour;
      state.pb = null; state.view = 'calendar';
      if (target) { openTour(target.id); const d = state.modal.draft; d.bookings = d.bookings.filter(b => b.id !== bk.id); d.bookings.push(bk); state.modal.edit = true; renderModal(); }
      else { const cat = mt.cat || {}, dur = cat.days > 1 ? 0 : (parseFloat(cat.duration) || 0); const start = pb.time || cat.start || '10:00';
        openTour(null, { title: cat.title || pb.title || '', kind: cat.kind || pb.kind || 'private', date: pb.date || today(), start_time: start, end_time: dur ? hhmm(mins(start) + dur * 60) : '', date_to: cat.days > 1 && pb.date ? addDays(pb.date, cat.days - 1) : null, capacity: cat.capacity || 0, pickup: cat.pickup || '', pickup_url: cat.pickup_url || null, language: pb.lang || 'EN' });
        state.modal.draft.bookings.push(bk); renderModal(); }
      toast(T('pb_opened'));
    },
    ctgo() { run(importContacts); },
    fitpick(el) { const m = state.modal; if (!m || !m.draft) return; m.draft[el.dataset.f] = el.dataset.id; const s = $(el.dataset.f === 'guide_id' ? '#t-guide' : '#t-driver'); if (s) s.value = el.dataset.id; const b = $('#fitbox'); if (b) b.innerHTML = fitHtml(m.draft); refreshTourWarn(); },
    msdone(el) { const d = el.closest('details'); if (d) d.open = false; },
    msclear(el) { const m = state.modal, b = m && m.draft && m.draft.bookings[Number(el.dataset.i)]; if (!b) return; const had = needsAddr(b); b.marks = []; el.closest('.mspanel').querySelectorAll('input[type=checkbox]').forEach(x => { x.checked = false; }); const sm = $('#ms-' + el.dataset.i); if (sm) { sm.textContent = optSummary(b); sm.nextElementSibling.textContent = ''; } if (had) setTimeout(renderModal, 0); },
    badd() { state.modal.draft.bookings.push({ id: S.uid(), guest: '', adults: 1, children: 0, phone: '', ref: '', notes: '', marks: [] }); renderModal(); },
    bdel(el) { state.modal.draft.bookings.splice(Number(el.dataset.i), 1); renderModal(); },
    close() { guardClose(closeModal); },
    backdrop(el, ev) { if (ev.target === el) guardClose(closeModal); },
    tcapply(el) { run(() => tcAnswer(el.dataset.id, true)); },
    tcdecline(el) { run(() => tcAnswer(el.dataset.id, false)); },
    tccorrect(el) { const n = db.notifications.find(x => String(x.id) === String(el.dataset.id)), who = n && tcWho(n); if (who) { state.modal = { type: 'person', draft: { ...who }, back: state.modal }; renderModal(); } },
    tourdelask(el) { const t = db.tours.find(x => x.id === el.dataset.id); if (!t) return; const n = tourBookings(t.id).length;
      confirmDo(T('del_ask', { title: t.title, date: fmtDay(t.date), n }), T('del_yes'), async () => { for (const b of tourBookings(t.id)) await S.remove('bookings', b.id); await S.remove('tours', t.id); toast(T('del_done')); render(); }); },
    bell() { state.modal = { type: 'bell' }; renderModal(); const un = myNotes().filter(n => !n.read); (async () => { for (const n of un) { try { await S.save('notifications', { ...n, read: true }); } catch (e) { /* ignore */ } } render(); })(); },
    offnew(el) { const sick = el.dataset.type === 'sick', d0 = el.dataset.date || (sick ? today() : state.date > today() ? state.date : addDays(today(), 1)); state.fabOpen = false; state.modal = { type: 'off', draft: { user_id: el.dataset.who || me().id, type: sick ? 'sick' : 'dayoff', date_from: d0, date_to: d0, note: '' } }; renderModal(); render(); },
    fabtoggle() { state.modal = { type: 'addmenu' }; renderModal(); },
    pstats(el) { state.modal = { type: 'pstats', from: el.dataset.from, to: el.dataset.to }; renderModal(); },
    tourclone(el) { const t = db.tours.find(x => x.id === el.dataset.id); if (!t) return; const { id, external_id, status, pax, adults, children, cancel_reason, created_at, ...keep } = t; openTour(null, { ...keep, pax: 1, adults: 1, children: 0, status: 'confirmed', external_id: null }); state.modal.touched = true; toast(T('clone_hint')); },
    offdecide(el) { const o = db.time_off.find(x => x.id === el.dataset.id); logAct(`Time off ${el.dataset.s} for ${pname(o.user_id)}: ${o.date_from} to ${o.date_to}`); run(async () => { await S.save('time_off', { ...o, status: el.dataset.s, decided_by: me().id }); await notify([o.user_id], el.dataset.s === 'approved' ? 'off_approved' : 'off_declined', { from: o.date_from, to: o.date_to }); }); },
    offdel(el) { confirmDo(T('confirm_remove'), T('remove'), () => S.remove('time_off', el.dataset.id)); },
    taskfilter(el) { state.taskFilter = el.dataset.v; render(); },
    pdkind(el) { const m = state.modal; if (!m || m.type !== 'pdate') return; const t = $('#pd-title'), y = $('#pd-yearly'); if (t) { t.value = T('pdk_' + el.dataset.k); dirty.add(t); } if (y) { y.checked = ['birthday', 'anniversary', 'family'].includes(el.dataset.k); dirty.add(y); } m.touched = true; document.querySelectorAll('#modal .chip2').forEach(c => c.classList.toggle('on', c === el)); },
    pdnew() { state.modal = { type: 'pdate', draft: { title: '', date: today(), yearly: false } }; renderModal(); requestAnimationFrame(() => wheelSync(true)); },
    pdedit(el) { const x = db.personal_dates.find(q => q.id === el.dataset.id); if (!x) return; state.modal = { type: 'pdate', draft: { ...x } }; renderModal(); requestAnimationFrame(() => wheelSync(true)); },
    tgskip() { const m = me(); run(() => S.save('profiles', { ...stripEmail(m), display: { ...((m.display && typeof m.display === 'object') ? m.display : {}), tgSkip: today() } }), T('saved')); },
    tasksec(el) { state.taskSec = el.dataset.v; render(); window.scrollTo(0, 0); },
    tasknew(el) { const tour = el.dataset.tour ? db.tours.find(t => t.id === el.dataset.tour) : null; state.modal = { type: 'task', isNew: true, draft: { id: S.uid(), title: '', notes: '', due_date: tour ? tour.date : '', assignees: tour ? [tour.guide_id, tour.driver_id].filter(Boolean) : [], status: 'open', tour_id: tour ? tour.id : null } }; renderModal(); },
    taskedit(el) { const k = db.tasks.find(x => x.id === el.dataset.id); state.modal = { type: 'task', isNew: false, draft: { ...k, assignees: [...(k.assignees || [])] } }; renderModal(); },
    taskdel() { const id = state.modal.draft.id; confirmDo(T('confirm_remove'), T('remove'), () => S.remove('tasks', id)); },
    confirmyes() { const fn = state.modal.fn; state.modal = null; renderModal(); run(fn); },
    admintab(el) { const to = el.dataset.v || null; if (to && !state.adminTab && !adminHist) { adminHist = true; navPush(); } else if (!to && adminHist) { adminHist = false; navPop(); } state.adminTab = to; state.q = ''; state.errs = null; render(); window.scrollTo(0, 0); },
    bnview() { const n = document.querySelector('.bnote'); if (n) n.remove(); state.view = 'me'; state.meTab = 'badges'; render(); window.scrollTo(0, 0); },
    rsno() { state.restore = null; render(); },
    rsgo() { if (!state.restore) return; if (!state.rsAsk) { state.rsAsk = true; toast(T('rs_sure')); return; } state.rsAsk = false; run(runRestore); },
    paysort(el) { state.paySort = el.dataset.v; render(); },
    payrole(el) { state.payRole = el.dataset.v; render(); },
    paycsv() { const rows = [[T('name'), T('role'), T('tours_n'), T('rp_days'), T('pay_total')], ...(state.payRows || [])]; const csv = '\ufeff' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n'); const a2 = document.createElement('a'); a2.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a2.download = state.payFile || 'salary.csv'; document.body.appendChild(a2); a2.click(); a2.remove(); },
    errreload() { state.errs = null; flushErr().then(render); },
    errclear() { run(async () => { await S.clearErrors(); state.errs = []; }); },
    year(el) { state.year += Number(el.dataset.d); render(); if (S.loadedFrom && String(state.year) < S.loadedFrom.slice(0, 4)) { toast(T('loading_older')); S.loadOlder(`${state.year}-01-01`).then(() => render()).catch(() => {}); } },
    pactive(el) { const p = person(el.dataset.id); logAct(`${p.active === false ? 'Gave access to' : 'Removed access from'} ${p.name}`); if (state.modal && state.modal.type === 'person') state.modal = null; run(() => S.save('profiles', { ...stripEmail(p), active: p.active === false })).then(renderModal); },
    holdel(el) { run(() => S.remove('holidays', el.dataset.id)); },
    holpreset(el) {
      const y = Number(el.dataset.y), e = orthodoxEaster(y);
      const list = [[T('h_newyear'), `${y}-01-01`, `${y}-01-02`], [T('h_christmas'), `${y}-01-07`, `${y}-01-07`], [T('h_easter'), addDays(e, -2), addDays(e, 1)]];
      run(async () => { for (const [name, a, b] of list) if (!db.holidays.some(h => h.date_from === a && h.date_to === b)) await S.save('holidays', { id: S.uid(), name, date_from: a, date_to: b, kind: 'holiday' }); }, T('saved'));
    },
    impgo() { run(runImport); },
    mailgo() { run(addOrderEmail); },
    backup() {
      S.save('settings', { id: 'backup', value: { at: new Date().toISOString(), by: me().id } }).then(render).catch(() => {});
      const blob = new Blob([JSON.stringify({ exported: new Date().toISOString(), app: APP_VERSION, ...db }, null, 1)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `friendly-schedule-backup-${today()}.json`; document.body.appendChild(a); a.click(); a.remove();
    },
    demoreset() { confirmDo(T('demo_reset') + '?', T('demo_reset'), async () => { S.demoReset(); state.imp = null; }); },
    push() { enableNotifications(); },
    pushoff() { pushOff(); },
    pushtest() { run(pushTest); },
    auth(el) { state.auth = el.dataset.to; state.authMsg = ''; render(); },
    signout() { run(async () => { await S.signOut(); state.auth = 'signin'; }); }
  };
  const changes = {
    errwho(el) { state.errWho = el.value; render(); },
    errnooff(el) { state.errNoOff = el.checked; render(); },
    gckind(el) { const s2 = state.gcOff || (state.gcOff = new Set()); el.checked ? s2.delete(el.dataset.v) : s2.add(el.dataset.v); render(); },
    mytour(el) { const m = me(), list = catalog().filter(c => c.id), base = (m.skills || []).length ? m.skills : list.map(c => String(c.id)), st = state.myTours || new Set(base); el.checked ? st.add(el.dataset.v) : st.delete(el.dataset.v); state.myTours = st; render(); },
    jump(el) { if (el.value) { state.date = el.value; render(); } },
    cattitle(el) {
      const m = state.modal, c = catFind(el.value); if (!m || !m.draft || !c || m.catApplied === c.title) return; m.catApplied = c.title;
      const d = m.draft; d.title = c.title; d.kind = KINDS.includes(c.kind) ? c.kind : 'private'; if (c.start) d.start_time = c.start; d.end_time = c.end || ''; d.capacity = c.capacity || 0;
      if (c.pickup) { d.pickup = c.pickup; d.pickup_url = c.pickup_url || null; }
      d.date_to = c.days > 1 ? addDays(d.date, c.days - 1) : null;
      setTimeout(() => { if (state.modal === m) renderModal(); }, 0); toast(T('cat_filled'));
    },
    statuser(el) { state.statUser = el.value; render(); },
    lang(el) { const v = el.value; S.ls.set('fs-lang', v); run(() => S.save('profiles', { ...stripEmail(me()), lang: v })); },
    prelang(el) { S.ls.set('fs-lang', el.value); render(); },
    payfrom(el) { if (el.value) { (state.pay = state.pay || {}).from = el.value; render(); } },
    payto(el) { if (el.value) { (state.pay = state.pay || {}).to = el.value; render(); } },
    mutepref(el) { const s = new Set(me().mute || []); el.checked ? s.delete(el.dataset.g) : s.add(el.dataset.g); run(() => S.save('profiles', { ...stripEmail(me()), mute: [...s] })); },
    demoas(el) { S.demoViewAs(el.value); state.mine = !isAdmin(); state.mode = 'week'; render(); weekCheck(); },
    taskdone(el) { track('taskdone'); const k = db.tasks.find(x => x.id === el.dataset.id), done = el.checked; run(async () => { await S.save('tasks', { ...k, status: done ? 'done' : 'open', done_by: done ? me().id : null, done_at: done ? new Date().toISOString() : null }); if (done) await notify([k.created_by], 'task_done', { name: me().name, title: k.title }); }); },
    restorefile(el) { const f = el.files && el.files[0]; if (f) run(() => readRestore(f)); },
    impfile(el) { const f = el.files && el.files[0]; if (f) run(() => readImport(f)); },
    ctfile(el) { const f = el.files && el.files[0]; if (f) run(async () => { try { await readContacts(f); } finally { el.value = ''; } }); },
    impmap(el) { state.imp.map[el.dataset.name] = el.value; },
    listmonth(el) { if (el.value) { state.listMonth = el.value; render(); } },
    q(el) { state.q = el.value; render(); },
    avatar(el) {
      const f = el.files && el.files[0]; if (!f) return;
      const img = new Image(), url = URL.createObjectURL(f);
      img.onload = () => { const s = Math.min(img.width, img.height), c = document.createElement('canvas'); c.width = c.height = 128; c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 128, 128); URL.revokeObjectURL(url); run(() => S.save('profiles', { ...stripEmail(me()), avatar: c.toDataURL('image/jpeg', 0.8) }), T('saved')); };
      img.onerror = () => toast(T('err_save')); img.src = url;
    }
  };
  const stripEmail = p => { const { email, ...rest } = p; return rest; };
  const forms = {
    async signin(fd) { await S.signIn(fd.get('email'), fd.get('password')); displayFromAccount(); state.mine = !isAdmin(); state.mode = 'week'; state.view = 'calendar'; checkBadges(); weekCheck(); },
    async signup(fd) { const inside = await S.signUp(fd.get('name'), fd.get('email'), fd.get('password')); if (!inside) { state.auth = 'signin'; state.authMsg = T('check_email'); } },
    async reset(fd) { await S.resetPassword(fd.get('email')); state.auth = 'signin'; state.authMsg = T('reset_sent'); },
    async newpass(fd) { await S.setPassword(fd.get('password')); state.auth = 'signin'; state.authMsg = T('saved'); location.reload(); },
    async tour() { await saveTour(false); renderModal(); },
    async off() { await saveOff(); renderModal(); },
    async task() { await saveTask(); renderModal(); },
    async holiday(fd) { if (fd.get('to') < fd.get('from')) { toast(T('bad_dates')); return; } const ev = fd.get('kind') === 'event'; await S.save('holidays', { id: S.uid(), name: fd.get('name'), date_from: fd.get('from'), date_to: fd.get('to'), kind: ev ? 'event' : 'holiday' }); if (ev) await notify(db.profiles.filter(p => p.active !== false).map(p => p.id), 'event', { title: fd.get('name'), from: fd.get('from'), to: fd.get('to') }); logAct(`Added ${ev ? 'team event' : 'holiday'}: ${fd.get('name')}`); },
    async paytable(fd) { const v = { ...rules() }, tb = { ...(v.payTable || {}) }; payTitles().forEach((ti, i) => { const o = {}; for (const k of ['guide_base', 'guide_guest', 'driver_base', 'driver_guest']) { const x = fd.get(`${i}_${k}`); if (x !== '' && x !== null) o[k] = Number(x) || 0; } if (Object.keys(o).length) tb[ti] = o; else delete tb[ti]; }); v.payTable = tb; await S.save('settings', { id: 'rules', value: v }); toast(T('saved')); },
    async dispute(fd) { const m = state.modal, t = db.tours.find(x => x.id === m.id); if (!t) return; const ex = fd.get('expected'); await S.save('pay_disputes', { id: S.uid(), tour_id: t.id, user_id: me().id, counted: myPayOn(t, me().id), expected: ex === '' || ex == null ? null : Number(ex), message: String(fd.get('message') || '').trim(), status: 'open', reply: null, created_at: new Date().toISOString(), decided_by: null }); await notify(admins(), 'dispute_new', { name: me().name, title: t.title, date: t.date }); logAct(`Pay dispute opened: ${t.title}, ${t.date}`); toast(T('sent')); closeModal(); },
    async cat() { await saveCat(); renderModal(); },
    async creq() { await saveCreq(); renderModal(); },
    async mail(fd) { state.mail = parseOrderEmail(String(fd.get('text') || '')); },
    async adjust(fd) { await S.save('pay_adjustments', { id: S.uid(), user_id: fd.get('user_id'), month: fd.get('month'), amount: Number(fd.get('amount')) || 0, note: fd.get('note') || '', created_by: me().id, created_at: new Date().toISOString() }); await notify([fd.get('user_id')], 'adjusted', { title: fd.get('month'), time: fd.get('note') || '' }); logAct(`Pay correction for ${pname(fd.get('user_id'))}, ${fd.get('month')}: ${fd.get('amount')}`); renderModal(); },
    async expense(fd) {
      const amount = Number(fd.get('amount')); if (!(amount > 0)) { toast(T('ex_amount_bad')); return; }
      await S.save('expenses', { id: S.uid(), user_id: me().id, tour_id: fd.get('tour_id') || null, date: fd.get('date') || today(), kind: fd.get('kind') || 'other', amount, currency: fd.get('currency') || 'GEL', note: String(fd.get('note') || '').trim() || null, paid_back: false, created_at: new Date().toISOString() });
      state.modal = null; renderModal(); toast(T('ex_saved'));
    },
    async avail(fd, form) {
      const f = form || document.querySelector('form[data-form=avail]'), wk = f.dataset.wk, m = me(), d = (m.display && typeof m.display === 'object') ? m.display : {}, av = { ...(d.avail || {}) };
      av[wk] = { w: weekFrom(fd), at: new Date().toISOString() }; Object.keys(av).forEach(x => { if (x < addDays(monday(today()), -56)) delete av[x]; });
      await S.save('profiles', { ...stripEmail(m), display: { ...d, avail: av } });
      const k = db.tasks.find(x => x.id === f.dataset.task); if (k && k.status === 'open') await S.save('tasks', { ...k, status: 'done', done_by: m.id, done_at: new Date().toISOString() });
      toast(T('wk_done'));
    },
    async worksched(fd) { await S.save('profiles', { ...stripEmail(me()), ...weekFields(weekFrom(fd)) }); toast(T('saved')); },
    async pdate(fd) { wheelSync(false); const d = state.modal.draft, title = String(fd.get('title') || '').trim(); if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(d.date || '')) return; await S.save('personal_dates', { id: d.id || S.uid(), user_id: d.user_id || me().id, title, date: d.date, yearly: !!fd.get('yearly') }); closeModal(); },
    async payout(fd) { state.payEdit = false; await S.save('payout_details', { id: me().id, bank_name: fd.get('bank_name') || null, holder: fd.get('holder') || null, account: fd.get('account') || null }); toast(T('saved')); },
    async move() { await moveSubmit(); },
    async cedit(fd, form) { const cl = db.clients.find(x => x.id === (form || document.querySelector('form[data-form=cedit]')).dataset.id); if (!cl) return; const em = cleanEmail(fd.get('email')) || String(fd.get('email') || '').trim().toLowerCase(); if (em && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { toast(T('err_email')); return; } await S.save('clients', { ...cl, name: String(fd.get('name') || '').trim() || cl.name, phone: normPhone(fd.get('phone')) || null, email: em || null, notes: String(fd.get('notes') || '').trim() || null }); logAct(`Edited guest: ${cl.name}`); toast(T('saved')); },
    async bugnote(fd) { const n = String(fd.get('note') || '').trim(); if (!n) return; logErr('report', n, ''); toast(T('pr_thanks')); closeModal(); },
    async mydetails(fd) { const ph = normPhone(String(fd.get('phone') || '').trim()), lg = String(fd.get('languages') || '').toUpperCase().split(/[\s,;/]+/).filter(Boolean).join(', '); await S.save('profiles', { ...stripEmail(me()), phone: ph || null, languages: lg || null }); toast(T('saved')); },
    async mytg(fd) { const raw = String(fd.get('telegram') || '').trim(), u = tgUser(raw); if (raw && !u) { toast(T('tg_bad')); return; } await S.save('profiles', { ...stripEmail(me()), telegram: u || null }); toast(T('saved')); },
    async cancel(fd) { await cancelSubmit((fd.get('reason') || '').trim()); },
    async bulkteam(fd) {
      const palette = ['#6243bd', '#a8500c', '#1c7439', '#2f6f73', '#3b5bbd', '#7a5c00', '#8a3a6b', '#3d6b2f']; let ok = 0, bad = 0;
      for (const line of String(fd.get('list') || '').split(/\n+/).map(x => x.trim()).filter(Boolean)) {
        const [name, roleRaw, email, phone, tgRaw] = line.split(/[,;\t]/).map(x => (x || '').trim()), role = /driv|вод|მძღ/i.test(roleRaw || '') ? 'driver' : /admin|адм|ადმ/i.test(roleRaw || '') ? 'admin' : 'guide', mail = (email || '').toLowerCase();
        if (!name || (S.mode !== 'demo' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) || db.invites.some(i => i.email === mail && mail) || db.profiles.some(p => p.name === name && !p.left_at)) { bad++; continue; }
        const f = { name, role, phone: phone || null, telegram: tgUser(tgRaw) || null, color: palette[(db.profiles.length + db.invites.length + ok) % palette.length] };
        if (S.mode === 'demo') await S.save('profiles', { id: S.uid(), ...f, lang: 'en', active: true }); else await S.save('invites', { id: S.uid(), email: mail, ...f, created_by: me().id, created_at: new Date().toISOString() });
        ok++;
      }
      logAct(`Added ${ok} people from a list`); toast(T('bulk_done', { n: ok, bad }));
    },
    async person(fd) { await savePerson(fd.has('wf0') ? weekFields(weekFrom(fd)) : {}); renderModal(); },
    async privacy(fd) { const v = { ...rules() }; v.privacy = { guideDays: Math.min(365, Math.max(1, Number(fd.get('guideDays')) || 14)), keepMonths: Math.min(120, Math.max(3, Number(fd.get('keepMonths')) || 24)), auto: !!fd.get('auto') }; await S.save('settings', { id: 'rules', value: v }); state.staleN = null; toast(T('saved')); },
    async rules(fd) { const v = { ...rules() }; for (const k of Object.keys(DEFAULT_RULES)) v[k] = Number(fd.get(k)) || 0; v.customMarks = fd.get('customMarks') || ''; v.pubHol = !!fd.get('pubHol'); v.rates = String(fd.get('rates') || '').trim(); v.commission = String(fd.get('commission') || '').trim(); v.peaks = String(fd.get('peaks') || '').trim(); await S.save('settings', { id: 'maintenance', value: { on: !!fd.get('mtOn'), text: String(fd.get('mtText') || '').trim() } }); v.guestCurrency = (fd.get('guestCurrency') || 'USD').trim().toUpperCase(); for (const k of ['reviewGoogle', 'reviewTripadvisor', 'reviewTrustindex', 'reviewGyg', 'reviewViator', 'offerPromo', 'tipUrl', 'botUrl']) v[k] = (fd.get(k) || '').trim(); await S.save('settings', { id: 'rules', value: v }); toast(T('saved')); },
    async pay(fd) { const v = { ...rules() }, p = {}; for (const k of ['guide_private', 'guide_group', 'guide_custom', 'driver_private', 'driver_group', 'driver_custom']) p[k] = Number(fd.get(k)) || 0; v.pay = p; v.currency = (fd.get('currency') || 'GEL').trim(); v.payNote = (fd.get('payNote') || '').trim(); await S.save('settings', { id: 'rules', value: v }); toast(T('saved')); }
  };
  document.addEventListener('click', ev => {
    const el = ev.target.closest('[data-act]'); if (!el) return;
    if (el.dataset.act === 'backdrop' && ev.target !== el) { const inner = ev.target.closest('.sheet [data-act]'); if (inner) { ev.preventDefault(); acts[inner.dataset.act](inner, ev); } return; }
    if (el.tagName === 'BUTTON' && el.type === 'submit' && !acts[el.dataset.act]) return;
    const fn = acts[el.dataset.act]; if (fn) { if (el.tagName !== 'INPUT') ev.preventDefault(); track(el.dataset.act === 'view' ? 'view_' + el.dataset.v : el.dataset.act); busyWhile(el, fn(el, ev)); }
  });
  document.addEventListener('change', ev => { const el = ev.target.closest('[data-ch]'); if (el && changes[el.dataset.ch]) changes[el.dataset.ch](el); });
  document.addEventListener('input', ev => {
    const el = ev.target, m = state.modal; if (!m || !m.draft) return;
    if (m.type === 'tour' && (el.dataset.f === 'dur' || el.dataset.f === 'start_time')) {
      const d = m.draft, old = durOf(d), dur = el.dataset.f === 'dur' ? Number(el.value) : Number(old);
      if (el.dataset.f === 'start_time') d.start_time = el.value;
      if (d.start_time && dur > 0) d.end_time = hhmm(mins(d.start_time) + dur * 60); else if (el.dataset.f === 'dur') d.end_time = '';
      const et = $('#t-endtxt'); if (et) et.textContent = d.end_time || '—';
    } else if (el.dataset.f) m.draft[el.dataset.f] = el.value;
    else if (el.dataset.msq !== undefined) { const q2 = el.value.trim().toLowerCase(); el.closest('.mspanel').querySelectorAll('label[data-mk]').forEach(l => { l.hidden = !!q2 && !l.dataset.mk.includes(q2); }); return; }
    else if (el.dataset.bm) { const b = m.draft.bookings[Number(el.dataset.bi)], st = new Set(b.marks || []); el.checked ? st.add(el.dataset.bm) : st.delete(el.dataset.bm); b.marks = [...st]; const sm = $('#ms-' + el.dataset.bi); if (sm) { sm.textContent = optSummary(b); const cn = sm.nextElementSibling; if (cn) cn.textContent = b.marks.length || ''; } if (el.dataset.bm === 'pickup' || el.dataset.bm === 'dropoff' || el.dataset.bm === 'stays') setTimeout(renderModal, 0); }
    else if (el.dataset.bi) { const bi = Number(el.dataset.bi), b = m.draft.bookings[bi]; b[el.dataset.bf] = el.dataset.bf === 'email' && /mailto:/i.test(el.value) ? (el.value = cleanEmail(el.value)) : el.value;
      if (['guest', 'phone', 'email', 'ref'].includes(el.dataset.bf)) { const box = $('#gsug-' + bi); if (box) box.innerHTML = suggHtml(b, bi); }
      if (el.dataset.bf === 'phone') { const f = $('#pflag-' + bi); if (f) f.textContent = phoneFlag(normPhone(el.value)); } }
    else if (el.dataset.cq) m.draft[el.dataset.cq] = el.checked;
    else if (el.dataset.cost) { const d = m.draft; if (!d.costs) { d.costs = { ...costOf(d.id).items }; d.costNote = costOf(d.id).note; } if (el.dataset.cost === 'note') d.costNote = el.value; else d.costs[el.dataset.cost] = el.value === '' ? null : Number(el.value); }
    else if (el.dataset.rg) { const s = new Set(m.draft.regions || []); el.checked ? s.add(el.dataset.rg) : s.delete(el.dataset.rg); m.draft.regions = [...s]; }
    else if (el.dataset.sk) { const s = new Set(m.draft.skills || []); el.checked ? s.add(el.dataset.sk) : s.delete(el.dataset.sk); m.draft.skills = [...s]; }

    else if (el.dataset.as) { const s = new Set(m.draft.assignees); el.checked ? s.add(el.dataset.as) : s.delete(el.dataset.as); m.draft.assignees = [...s]; }
    if (m.type === 'off' && el.dataset.f === 'date_from' && m.draft.date_to < el.value) { m.draft.date_to = el.value; const to = $('#o-to'); if (to) to.value = el.value; }
    if (m.type === 'tour' && ['date', 'start_time', 'dur', 'title', 'language', 'guide_id', 'driver_id'].includes(el.dataset.f)) { const b = $('#fitbox'); if (b) b.innerHTML = fitHtml(m.draft); }
    refreshTourWarn(); refreshOffWarn();
  });
  document.addEventListener('submit', ev => {
    const f = ev.target.closest('[data-form]'); if (!f) return; ev.preventDefault();
    const fn = forms[f.dataset.form]; if (fn) busyWhile(ev.submitter || f.querySelector('button.primary, button:not([type=button])'), run(() => fn(new FormData(f), f)));
  });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && state.modal) guardClose(closeModal); });
  try { window.matchMedia('(max-width:760px)').addEventListener('change', () => render()); } catch (e) { /* old browsers keep the layout they opened with */ }
  window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (['calendar', 'timeoff', 'tasks', 'admin', 'me'].includes(v) && v !== state.view) { state.view = v; render(); } });

  const toToday = () => { const x = document.getElementById('day-' + today()); if (x && window.matchMedia('(max-width:760px)').matches) x.scrollIntoView({ block: 'start' }); };
  // ---------- usage: counts of what people tap, sent in small batches ----------
  const TRACKED = { tour: 'Open tour card', guest: 'Open guest', client: 'Open client card', attend: 'Guest check-in', summary: 'Day summary', creq: 'Suggest a change', score: 'Tour score', offer: 'Offer a tour', offersend: 'Send tour offer', copy: 'Copy', mode: 'Week / month switch', mine: 'Team / mine switch', offnew: 'Day-off request', taskdone: 'Task ticked', statmonth: 'Statistics', metab: 'Me tabs', swapagree: 'Handover answer', rate: 'Guest mark', help: 'Help', csv: 'Export CSV', statement: 'Pay statement', swipe: 'Swipe', wa: 'WhatsApp tap', call: 'Call tap', map: 'Map tap', view_calendar: 'Calendar screen', view_timeoff: 'Time off screen', view_tasks: 'Tasks screen', view_me: 'Me screen', view_admin: 'Back office screen', view_clients: 'Clients screen' };
  let usageBuf = {};
  function track(name) { if (!TRACKED[name] || !me()) return; usageBuf[name] = (usageBuf[name] || 0) + 1; }
  function flushUsage() {
    const keys = Object.keys(usageBuf); if (!keys.length || !me() || !me().active) return;
    const day = today(), buf = usageBuf; usageBuf = {};
    keys.forEach(k => { S.save('usage', { id: S.uid(), day, user_id: me().id, action: k, n: buf[k] }).catch(() => {}); });
  }
  setInterval(flushUsage, 45000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushUsage(); });
  document.addEventListener('click', ev => { const l = ev.target.closest('a[href]'); if (!l) return; if (l.dataset.act2 === 'offersend') logOffer(l.dataset.tour, l.dataset.b); const h = l.getAttribute('href') || ''; if (h.startsWith('https://wa.me')) track('wa'); else if (h.startsWith('tel:')) track('call'); else if (/maps\.|goo\.gl/.test(h)) track('map'); }, true);

  // ---------- swipe left / right on the calendar to change week or month ----------
  let sw = null;
  // ---------- drag and drop (admin): pull a tour onto another day; on the team grid also onto another person ----------
  let dg = null, dragEnd = 0;
  const dropAt = (x, y) => { const e = document.elementFromPoint(x, y); return e ? e.closest('[data-drop]') : null; };
  function dragDown(src, x, y, touch) {
    if (!me() || !isAdmin() || state.modal || state.view !== 'calendar') return;
    const el = src.closest('[data-drag]'); if (!el) return; const cell = el.closest('.cell');
    dg = { el, id: el.dataset.drag, x, y, on: false, touch, from: cell ? cell.dataset.who || '' : null };
    if (touch) dg.tm = setTimeout(() => { if (dg && !dg.on) dragStart(dg.x, dg.y); }, 380);
  }
  function dragStart(x, y) {
    const r = dg.el.getBoundingClientRect(), g = dg.el.cloneNode(true);
    g.removeAttribute('data-act'); g.removeAttribute('data-drop'); g.removeAttribute('data-drag'); g.removeAttribute('data-key'); g.className += ' dragghost'; g.style.width = r.width + 'px'; g.style.left = r.left + 'px'; g.style.top = r.top + 'px';
    dg.dx = x - r.left; dg.dy = y - r.top; dg.ghost = g; dg.on = true; sw = null;
    document.body.appendChild(g); dg.el.classList.add('dragsrc'); document.documentElement.classList.add('dragging');
    if (dg.touch && navigator.vibrate) { try { navigator.vibrate(12); } catch (e) { /* not allowed */ } }
  }
  function dragMove(x, y) {
    if (!dg) return false;
    if (!dg.on) { const far = Math.hypot(x - dg.x, y - dg.y) > 8; if (dg.touch) { if (far) dragStop(); return false; } if (!far) return false; dragStart(dg.x, dg.y); }
    dg.ghost.style.left = (x - dg.dx) + 'px'; dg.ghost.style.top = (y - dg.dy) + 'px';
    const tg = dropAt(x, y); if (tg !== dg.over) { if (dg.over) dg.over.classList.remove('dropon'); dg.over = tg; if (tg) tg.classList.add('dropon'); }
    const h = window.innerHeight; if (y > h - 70) window.scrollBy(0, 14); else if (y < 130 && state.mode !== 'week') window.scrollBy(0, -14);
    return true;
  }
  function dragStop(x, y) {
    document.removeEventListener('touchmove', dragTouchMove);
    if (!dg) return; const d = dg; dg = null; clearTimeout(d.tm);
    if (!d.on) return;
    d.ghost.remove(); d.el.classList.remove('dragsrc'); document.documentElement.classList.remove('dragging'); document.querySelectorAll('.dropon').forEach(e => e.classList.remove('dropon')); dragEnd = Date.now();
    const tg = x === undefined ? null : dropAt(x, y), t = db.tours.find(z => z.id === d.id); if (!tg || !t) return;
    const date = tg.dataset.drop, p = d.from !== null && tg.dataset.who && tg.dataset.who !== d.from ? person(tg.dataset.who) : null;
    const who = p ? { [p.role === 'driver' ? 'driver_id' : 'guide_id']: p.id } : null;
    if (date === t.date && !who) return;
    track('drag'); openMove(t, { date, who });
  }
  document.addEventListener('mousedown', ev => { if (ev.button === 0) dragDown(ev.target, ev.clientX, ev.clientY, false); });
  document.addEventListener('mousemove', ev => { if (dg && dragMove(ev.clientX, ev.clientY)) ev.preventDefault(); });
  document.addEventListener('mouseup', ev => dragStop(ev.clientX, ev.clientY));
  // The blocking touchmove listener is only attached while a tour is being dragged, so normal scrolling never waits for JavaScript.
  const dragTouchMove = ev => { if (!dg) { document.removeEventListener('touchmove', dragTouchMove); return; } const p = ev.touches[0]; if (dragMove(p.clientX, p.clientY) && ev.cancelable) ev.preventDefault(); };
  document.addEventListener('touchstart', ev => { if (ev.touches.length === 1) { dragDown(ev.target, ev.touches[0].clientX, ev.touches[0].clientY, true); if (dg) document.addEventListener('touchmove', dragTouchMove, { passive: false }); } else dragStop(); }, { passive: true });
  document.addEventListener('touchend', ev => { if (!dg) return; const on = dg.on, p = ev.changedTouches[0]; dragStop(p.clientX, p.clientY); if (on && ev.cancelable) ev.preventDefault(); });
  document.addEventListener('touchcancel', () => dragStop());
  document.addEventListener('click', ev => { document.querySelectorAll('details.msel[open]').forEach(d => { if (!d.contains(ev.target)) d.open = false; }); });
  document.addEventListener('contextmenu', ev => { if (dg && dg.touch) ev.preventDefault(); });
  document.addEventListener('click', ev => { if (Date.now() - dragEnd < 350 && !ev.target.closest('#modal')) { ev.stopPropagation(); ev.preventDefault(); } }, true);
  document.addEventListener('input', ev => { const el = ev.target, m = state.modal; if (!m || m.type !== 'move' || !el.dataset || !el.dataset.mv) return; m[el.dataset.mv] = el.value; const w = $('#mv-warn'); if (w) w.innerHTML = moveWarnHtml(m); });
  document.addEventListener('touchstart', ev => { sw = null; if (state.view !== 'calendar' || state.modal || ev.touches.length !== 1 || ev.target.closest('.gridwrap, .top, .tabs, .banner, input, select')) return; sw = { x: ev.touches[0].clientX, y: ev.touches[0].clientY }; }, { passive: true });
  document.addEventListener('touchend', ev => {
    if (!sw) return; const t = ev.changedTouches[0], dx = t.clientX - sw.x, dy = t.clientY - sw.y; sw = null;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8) return;
    track('swipe'); acts.nav({ dataset: { d: dx < 0 ? '1' : '-1' } });
  }, { passive: true });

  // ---------- pinned week strip: the marked day follows what is on screen ----------
  let scrollTick = false;
  window.addEventListener('scroll', () => {
    if (scrollTick || state.view !== 'calendar') return; scrollTick = true;
    requestAnimationFrame(() => {
      scrollTick = false; const strip = document.querySelector('.strip'); if (!strip || state.view !== 'calendar' || state.mode !== 'week' || getComputedStyle(strip).position !== 'sticky') return;
      const line = strip.getBoundingClientRect().bottom + 12; let cur = null;
      document.querySelectorAll('.dayhd').forEach(h => { if (h.getBoundingClientRect().top <= line) cur = h.id.slice(4); });
      if (!cur) return; strip.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.date === cur)));
    });
  }, { passive: true });

  // ---------- boot ----------
  let pending = false;
  S.onChange(() => { memo = {}; });
  S.onChange((table, row, type, remote) => {
    if (remote && table === 'notifications' && type === 'INSERT' && me() && row.user_id === me().id) { const tx = noteText(row); toast(tx); if (document.hidden) systemNotify(tx); }
    if (remote && !pending) { pending = true; setTimeout(() => { pending = false; render(); }, 150); }
    if (me() && me().active) checkBadges();
  });
  S.authEvent = ev => { if (ev === 'PASSWORD_RECOVERY') { state.auth = 'newpass'; render(); } };
  // Text size, colours and contrast: kept on this phone and on the account, so they follow the person to another phone.
  const DKEYS = { fs: 'fs-fsize', theme: 'fs-theme', contrast: 'fs-contrast', accent: 'fs-accent' };
  const ACCENTS = [['', '#f0901e'], ['sky', '#5aa9e6'], ['mint', '#45b88a'], ['lilac', '#b39ddb'], ['rose', '#f28fad'], ['sun', '#f2c94c']];
  const dget = k => { try { return localStorage.getItem(DKEYS[k]) || ''; } catch (e) { return ''; } };
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) { const vp = document.querySelector('meta[name=viewport]'); if (vp) vp.setAttribute('content', 'width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover'); }
  document.documentElement.dataset.os = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'ios' : /Android/i.test(navigator.userAgent) ? 'android' : 'other';
  function applyDisplay() { const r = document.documentElement; Object.keys(DKEYS).forEach(k => { const v = dget(k); if (v) r.dataset[k] = v; else delete r.dataset[k]; }); }
  function setDisplay(k, v, keepAccount) { try { localStorage.setItem(DKEYS[k], v); localStorage.setItem('fs-display-set', '1'); } catch (e) { /* private mode */ } applyDisplay(); if (!keepAccount && me() && S.mode === 'supabase') { const d = { ...((me().display && typeof me().display === 'object') ? me().display : {}), fs: dget('fs'), theme: dget('theme'), contrast: dget('contrast'), accent: dget('accent') }; S.save('profiles', { ...stripEmail(me()), display: d }).catch(() => { /* stays on this phone */ }); } }
  function displayFromAccount() { try { if (localStorage.getItem('fs-display-set')) return; } catch (e) { return; } const d = me() && me().display; if (d && typeof d === 'object') { Object.keys(DKEYS).forEach(k => { if (d[k]) setDisplay(k, d[k], true); }); } }
  function displayHtml() {
    const seg = (k, opts) => `<div class="seg wrap">${opts.map(([v, l]) => `<button data-act="dset" data-k="${k}" data-v="${v}" aria-pressed="${dget(k) === v}">${l}</button>`).join('')}</div>`;
    return `<span class="muted small">${T('ds_size')}</span>${seg('fs', [['s', T('ds_small')], ['', T('ds_normal')], ['l', T('ds_big')], ['xl', T('ds_xl')]])}
      <span class="muted small">${T('ds_theme')}</span>${seg('theme', [['', T('ds_system')], ['light', T('ds_light')], ['dark', T('ds_dark')]])}
      <span class="muted small">${T('ds_contrast')}</span>${seg('contrast', [['', T('ds_c_normal')], ['high', T('ds_c_high')]])}
      <span class="muted small">${T('ds_accent')}</span><div class="accents">${ACCENTS.map(([v, c]) => `<button class="acc" data-act="dset" data-k="accent" data-v="${v}" style="background:${c}" aria-pressed="${dget('accent') === v}" aria-label="${T('ds_acc_' + (v || 'orange'))}" title="${T('ds_acc_' + (v || 'orange'))}"></button>`).join('')}</div><span class="muted small">${T('ds_sound')}</span><div class="seg wrap"><button data-act="soundset" data-v="" aria-pressed="${sndOn()}">${T('ds_on')}</button><button data-act="soundset" data-v="off" aria-pressed="${!sndOn()}">${T('ds_off')}</button></div><span class="muted small">${T('ds_hint')}</span>`;
  }
  applyDisplay();
  (async () => {
    const v = location.hash.slice(1); if (['calendar', 'timeoff', 'tasks', 'admin', 'me'].includes(v)) state.view = v;
    try { await S.init(); } catch (e) { console.error(e); logErr('offline', `${errCode(e)} App could not start: ${(e && e.message) || e}`, navigator.onLine ? 'phone was online' : 'phone had no internet'); $('#app').innerHTML = `<main><div class="banner f"><b>${esc(T('err_connect'))}</b><span class="small">${esc(errCode(e) + ': ' + T('ec_' + errCode(e)))}</span><span class="small">${esc(T('err_retry'))}</span><button class="btn primary" onclick="location.reload()">${esc(T('refresh'))}</button></div></main>`; setTimeout(() => { if (navigator.onLine) location.reload(); }, 20000); return; }
    if (me() && !isAdmin()) state.mine = true;
    displayFromAccount();
    render(); if (state.view === 'calendar') toToday();
    // Test period: explain once how to report a mistake. A new badge goes first; then this waits for the next opening.
    setTimeout(() => { try { if (testOn() && me() && me().active && !window.__noCelebrate && !state.modal && localStorage.getItem('fs-test-seen') !== '1') { localStorage.setItem('fs-test-seen', '1'); acts.testinfo(); } } catch (e) { /* private mode */ } }, 2500);
    setTimeout(privacyAuto, 4000); checkBadges(); weekCheck(); setInterval(weekCheck, 30 * 60000); setTimeout(fxRefresh, 6000); setInterval(fxRefresh, 6 * 3600000);
    setInterval(() => { if (me() && me().active && !isAdmin() && state.view === 'calendar' && !state.modal && !document.hidden) render(); }, 5 * 60000);
    if ('serviceWorker' in navigator && location.protocol === 'https:' && S.mode === 'supabase') { try { swReg = await navigator.serviceWorker.register('sw.js'); const had = !!navigator.serviceWorker.controller; navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) { state.newVersion = true; render(); } }); setInterval(() => { try { swReg.update(); } catch (e) { /* later */ } }, 30 * 60000); } catch (e) { /* no service worker here */ } }
  })();
})();
