// Friendly Schedule: badges, levels, medals and the full-screen moment for a new badge.
// Loaded before app.js; app.js calls window.FSGame({...helpers}) once, at the end of its own setup, and gets the functions back.
(function () {
  'use strict';
  window.FSGame = function (d) {
    const { getMemo, firstName, pref, hm, involves, endOf, myScore, aliasOf, fmtDay, render, pname, pdKind, offOn, holidayOn, trName, photoOn, avatar, isAdmin, logErr, D, IC, LOCALES, REGIONS, S, T, UNLOCKS, addDays, cleanName, countryName, daysBetween, db, esc, fmt, fx, gameOn, ico, initials, iso, kmOf, lang, live, me, monday, msi, payFor, person, personStats, phoneIso, regionsOf, renderModal, rules, staff, state, stripEmail, toast, today, tourDays, track, twin, waLink, walkOf, weeklySave } = d;
    // ---------- badges: what a person has done, counted from their tours ----------
    const B_ICON = { star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>', moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>', mountain: '<path d="M3 20l6-11 4 7 2-3 6 7z"/>', coin: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10.2c0-1 1-1.7 2.5-1.7s2.5.7 2.5 1.7-1 1.5-2.5 1.8-2.5.8-2.5 1.8 1 1.7 2.5 1.7 2.5-.7 2.5-1.7"/>', boot: '<path d="M8 3v9l-3 3v4h14v-3l-6-3V3z"/>', bed: '<path d="M3 18V8M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="1.5"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', glass: '<path d="M7 3h10l-1 7a4 4 0 0 1-8 0z"/><path d="M12 14v6M9 21h6"/>', map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>', users: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.5a5 5 0 0 1 5 5.5"/>', bolt: '<path d="M13 2 5 14h6l-1 8 8-12h-6z"/>', paw: '<circle cx="7" cy="9" r="1.6"/><circle cx="12" cy="6.5" r="1.6"/><circle cx="17" cy="9" r="1.6"/><path d="M8 17c0-2.5 2-4.5 4-4.5s4 2 4 4.5c0 1.5-1.5 2-4 2s-4-.5-4-2z"/>', car: '<path d="M4 16v-4l2-5h12l2 5v4"/><path d="M3 16h18v2H3z"/><circle cx="7.5" cy="18" r="1.5"/><circle cx="16.5" cy="18" r="1.5"/>', globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>', heart: '<path d="M12 20s-7-4.4-7-9.5A4 4 0 0 1 12 8a4 4 0 0 1 7 2.5C19 15.6 12 20 12 20z"/>' };
    Object.assign(IC, B_ICON);
    // Titles: for each kind of tour, the guide and the driver with the most such tours in the last 12 months hold a title.
    // The ranking itself is never shown; a title simply moves when a colleague overtakes its holder.
    const THEMES = [['desert', /gareji|rainbow/i, 'sun'], ['mountain', /kazbegi|truso|juta|gudauri|khevsureti|tusheti|svaneti/i, 'mountain'], ['wine', /kakheti|wine|sighnaghi|signagi|telavi/i, 'glass'], ['city', /walking|brutal|night tour|old tbilisi|tiflis/i, 'pin'], ['south', /vardzia|borjomi|uplistsikhe|rabati/i, 'map'], ['west', /kutaisi|chiatura|katskhi|tskaltubo/i, 'map'], ['armenia', /armenia|yerevan|sevan|dilijan|haghpat/i, 'globe']];
    const titleKey = (th, role) => (th === 'mountain' ? (role === 'guide' ? 'eagle' : 'goat') : th);
    function holders() {
      if (getMemo().hold) return getMemo().hold;
      const td = today(), from = addDays(td, -365), cnt = {}, out = {};
      for (const t of db.tours) {
        if (!live(t) || t.date > td || t.date < from) continue;
        for (const [th, re] of THEMES) if (re.test(t.title)) for (const [role, id] of [['guide', t.guide_id], ['driver', t.driver_id]]) if (id) { const c = cnt[th + ':' + role] = cnt[th + ':' + role] || {}; c[id] = (c[id] || 0) + 1; }
      }
      for (const key of Object.keys(cnt)) { const [th, role] = key.split(':'), max = Math.max(...Object.values(cnt[key])); if (max < 5) continue; for (const id of Object.keys(cnt[key])) if (cnt[key][id] === max && (person(id) || {}).active !== false) (out[id] = out[id] || []).push({ th, role, n: max, key: titleKey(th, role), icon: THEMES.find(x => x[0] === th)[2] }); }
      return getMemo().hold = out;
    }
    const titlesOf = id => (holders()[id] || []).map(x => T('ti_' + x.key));
    function firstRuns() {
      if (getMemo().first) return getMemo().first;
      const by = {}; let start = '9999';
      for (const t of db.tours) { if (!live(t)) continue; if (t.date < start) start = t.date; (by[t.title] = by[t.title] || []).push(t); }
      const fresh = new Set(), cut = addDays(start === '9999' ? today() : start, 60);
      for (const k of Object.keys(by)) { const ts = by[k].sort((x, y) => x.date.localeCompare(y.date)); if (ts[0].date >= cut) ts.slice(0, 3).forEach(t => fresh.add(t.id)); }
      return getMemo().first = fresh;
    }
    const nf = n => new Intl.NumberFormat(LOCALES[lang()]).format(Math.round(n));
    function game(id) {
      if (getMemo()['g' + id]) return getMemo()['g' + id];
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
      { const ab = ts.filter(t => /tusheti|omalo/i.test(t.title)).length * 2; list.push(B('abano2', 'geo', 'mountain', ab, 2), B('abano10', 'geo', 'mountain', ab, 10), B('abano30', 'geo', 'mountain', ab, 30)); }
      { const mp = db.photos.filter(x => twin(x.user_id) === id), pl = mp.reduce((a, x) => a + likesN(x), 0), tk = db.thanks.filter(x => twin(x.to_id) === id).length; list.push(B('photo1', 'fun', 'camera', mp.length, 1), B('photo10', 'fun', 'camera', mp.length, 10), B('photo50', 'fun', 'camera', mp.length, 50), B('liked25', 'fun', 'heart', pl, 25), B('thanks10', 'fun', 'heart', tk, 10)); }
      const newToMe = Object.values(mineFirst).filter(d => d >= d90).length;
      list.push(B('pioneer', 'new', 'star', pioneer, 1), B('pioneer5', 'new', 'star', pioneer, 5), B('newdest', 'new', 'map', newToMe, 5), B('armenia1', 'new', 'globe', armenia, 1), B('armenia10', 'new', 'globe', armenia, 10));
      const offs = db.time_off.filter(o => o.user_id === id && o.type !== 'sick'), notice = rules().minNoticeDays || 14;
      const planned = offs.filter(o => o.created_at && daysBetween(o.created_at.slice(0, 10), o.date_from) >= notice).length, restDays = offs.filter(o => o.status === 'approved').reduce((n, o) => n + daysBetween(o.date_from, o.date_to) + 1, 0);
      const dq = db.pay_disputes.filter(q => q.user_id === id);
      list.push(B('nights5', 'new', 'moon', nights, 5), B('nights30', 'new', 'moon', nights, 30));
      if (isG) list.push(B('kids50', 'guide', 'users', kids, 50), B('kids200', 'guide', 'users', kids, 200), B('noshow5', 'guide', 'pin', cn.noshow || 0, 5), B('diplomat', 'guide', 'heart', cn.trouble || 0, 1), B('steel', 'guide', 'bolt', cn.trouble || 0, 5));
      list.push(B('ritual', 'fun', 'check', db.tasks.filter(k => k.kind === 'week_check' && k.done_by === id).length, 10));
      list.push(B('planner', 'fun', 'cal', planned, 5), B('rest10', 'fun', 'bed', restDays, 15), B('accountant', 'fun', 'coin', dq.length, 1), B('sharpeye', 'fun', 'coin', dq.filter(q => q.status === 'accepted').length, 3));
      list.push(B('khinkali', 'fun', 'heart', khink, 20), B('smart', 'fun', 'car', smart, 25), B('churchkhela', 'fun', 'glass', kakh, 10));
      list.push(B('week5', 'now', 'bolt', best(per.w), 5), B('month20', 'now', 'cal', best(per.m), 20), B('season80', 'now', 'sun', best(per.s), 80), B('year150', 'now', 'star', best(per.y), 150));
      // tour mastery: the three tours this person has done most, each on its own ladder up to 500
      Object.entries(s.titles).sort((x, y) => y[1] - x[1]).slice(0, 3).forEach(([title, c]) => { const goal = [10, 25, 50, 100, 250, 500].find(x => x > c) || 500, b = B('m:' + title, 'master', 'star', c, goal); b.title = title; b.desc = T('bd_master', { n: c, goal }); b.done = c >= 10; b.tier = [10, 25, 50, 100, 250, 500].filter(x => x <= c).length; list.push(b); });
      (holders()[id] || []).forEach(x => { const b = B('ti:' + x.key, 'titles', x.icon, x.n, x.n); b.title = T('ti_' + x.key); b.desc = T('bd_title'); list.push(b); });
      [['newyear', 'star', hid.newyear], ['snow', 'mountain', hid.snow], ['comeback', 'bolt', away > 30 ? 1 : 0], ['hattrick', 'bolt', Object.values(starts).some(x => x >= 3) ? 1 : 0], ['fri13', 'moon', hid.fri13], ['sunrise', 'sun', hid.sunrise]].forEach(([k, icon, v]) => { const b = B(k, 'secret', icon, v, 1); b.hidden = true; list.push(b); });
      // guests' countries (from the phone code), names, extras and places: counted from this person's own tours
      { const tids = new Set(ts.map(t => t.id)), bk = db.bookings.filter(b => tids.has(b.tour_id)), cty = {}, nm = {}, myFirst = String(firstName(p)).toLowerCase(); let wineN = 0, rare = 0, same = 0;
        for (const b of bk) { const pax = Number(b.pax) || 1, c = phoneIso(b.phone); if (c) cty[c] = (cty[c] || 0) + pax; if ((b.marks || []).includes('wine')) wineN++;
          const f = (cleanName(b.guest).split(/\s+/)[0] || '').toLowerCase(); if (f.length > 1) { nm[f] = (nm[f] || 0) + 1; if (/^[qxz]/.test(f)) rare++; if (myFirst && f === myFirst) same = 1; } }
        const topC = Object.keys(cty).sort((x, y) => cty[y] - cty[x])[0], topN = Object.keys(nm).sort((x, y) => nm[y] - nm[x])[0], world = Object.keys(cty).length, cap = x => x ? x[0].toUpperCase() + x.slice(1) : '';
        list.push(B('world10', 'geo', 'globe', world, 15), B('world25', 'geo', 'globe', world, 30), B('world40', 'geo', 'globe', world, 50));
        [50, 200, 1000].forEach(g => { const b = B('country' + g, 'geo', 'globe', topC ? cty[topC] : 0, g); b.desc = topC ? T('bd_country', { n: g, c: countryName(topC) }) : T('bd_country0', { n: g }); list.push(b); });
        [5, 15].forEach(g => { const b = B('names' + g, 'fun', 'users', topN ? nm[topN] : 0, g); b.desc = topN && nm[topN] >= 2 ? T('bd_names', { n: g, name: cap(topN), have: nm[topN] }) : T('bd_names0', { n: g }); list.push(b); });
        // Legends: goals so far away that they are a joke and a dream at once. They show real progress all the same.
        { const b1 = B('legend_country', 'legend', 'globe', topC ? cty[topC] : 0, 100000); b1.desc = topC ? T('bd_legend_country', { c: countryName(topC) }) : T('bd_legend_country0'); const b2 = B('legend_names', 'legend', 'users', topN ? nm[topN] : 0, 2000); b2.desc = topN && nm[topN] >= 2 ? T('bd_legend_names', { name: cap(topN) }) : T('bd_legend_names0'); list.push(b1, b2, B('legend_guests', 'legend', 'users', s.guests, 100000), B('legend_mother', 'legend', 'pin', ts.filter(t => /walking|old tbilisi|old town/i.test(t.title)).length, 10000)); }
        if (isG) list.push(B('tamada5', 'guide', 'glass', wineN, 5), B('tamada25', 'guide', 'glass', wineN, 25), B('tamada100', 'guide', 'glass', wineN, 100), B('baker25', 'guide', 'glass', kakh, 25));
        const cnt = re => ts.filter(t => re.test(t.title + ' ' + (t.notes || ''))).length, mother = cnt(/walking|old tbilisi|old town/i);
        if (isG) list.push(B('mother50', 'guide', 'pin', mother, 75), B('mother200', 'guide', 'pin', mother, 250));
        UNLOCKS.forEach(([k, re]) => { const b = B('pl_' + k, 'geo', 'pin', cnt(re), 3); b.desc = T('bd_pl_' + k) + ' · ' + T('pl_x3'); list.push(b); });
        const took = db.change_requests.filter(q => q.user_id === id && q.patch && (q.patch.guide_id === id || q.patch.driver_id === id)).length; list.push(B('enthusiast3', 'fun', 'bolt', took, 3), B('enthusiast10', 'fun', 'bolt', took, 10));
        [['namesake', 'heart', same], ['rarename', 'star', rare >= 3 ? 1 : 0]].forEach(([k, icon, v]) => { const b = B(k, 'secret', icon, v, 1); b.hidden = true; list.push(b); }); }
      { const at = (p.display && p.display.badgeAt) || {}; list.forEach(b => { if (at[b.k] && !b.done && !b.hidden && b.track !== 'master' && b.track !== 'titles') { b.done = true; b.have = b.goal; b.raw = b.goal; } }); }
      const done = list.filter(b => b.done).length, xp = n * 10 + s.guests + Math.round(km / 20) + Math.round(walk * 2) + done * 25;
      const level = Math.floor((1 + Math.sqrt(1 + 8 * xp / 100)) / 2), base = 100 * level * (level - 1) / 2, next = 100 * level * (level + 1) / 2;
      return getMemo()['g' + id] = { list, done, xp, level, base, next, km, walk, regs, partners, cur, prev, isD, isG, rep, weekNow, yearNow: per.y[td.slice(0, 4)] || 0 };
    }
    // ---------- medals: flat vector art drawn here, so they are sharp at any size and work offline ----------
    const METAL = { bronze: ['#7d4a1e', '#b87333', '#e0a36b'], silver: ['#7c838b', '#b9bec4', '#eceef0'], gold: ['#a67c12', '#e2b340', '#f6d67a'] };   // rim, face, highlight
    const RIBBON = { guide: '#f0901e', all: '#f0901e', master: '#a8500e', driver: '#3b5bbd', delica: '#3b5bbd', own: '#3b5bbd', geo: '#2f6b48', fun: '#6243bd', new: '#0f766e', now: '#0f766e', titles: '#20251f', secret: '#20251f' };
    const mPoly = (n, r1, r2, rot) => [...Array(n * 2)].map((_, i) => { const a = Math.PI * i / n + (rot || 0), r = i % 2 ? r2 : r1; return (48 + r * Math.sin(a)).toFixed(1) + ',' + (62 - r * Math.cos(a)).toFixed(1); }).join(' ');
    const M_SHAPE = { seal: mPoly(16, 37, 33.5), burst: mPoly(12, 38, 31), hex: mPoly(3, 38, 38), shield: null };
    // Bronze, silver or gold: the place of a badge on its own ladder (50 / 100 / 250 tours), or how far a tour mastery has gone.
    function tierOf(b, list) {
      if (b.track === 'titles' || b.track === 'secret') return 'gold';
      if (b.track === 'master') { const n = Array.isArray(b.tier) ? b.tier.length : Number(b.tier) || [10, 25, 50, 100, 250, 500].filter(x => x <= b.raw).length; return n >= 4 ? 'gold' : n >= 2 ? 'silver' : 'bronze'; }
      const pre = String(b.k).replace(/\d+$/, ''), sib = (list || []).filter(x => x.track === b.track && String(x.k).replace(/\d+$/, '') === pre && /\d$/.test(x.k)).sort((x, y) => x.goal - y.goal);
      if (sib.length > 1) { const i = sib.findIndex(x => x.k === b.k); return i <= 0 ? 'bronze' : i === sib.length - 1 ? 'gold' : 'silver'; }
      return ['welcome', 'first', 'firstoff'].includes(b.k) ? 'bronze' : 'silver';
    }
    // Badges are cute round stickers (cute.js): a soft colour by group, one friendly picture, and one to three small stars for the step
    // on the ladder. Not earned yet: pale, with a ring that fills as the person gets closer.
    const STICKER = { guide: '#ffe2b8', all: '#ffe2b8', master: '#fff0b8', driver: '#cfe8fb', delica: '#cfe8fb', own: '#cfe8fb', geo: '#d5f0df', fun: '#fbd9e3', new: '#e4dcf7', now: '#e4dcf7', titles: '#fff0b8', secret: '#e4dcf7' };
    const cuteOf = b => { const C = window.CUTE || { art: {}, pick: () => '' }, n = C.pick(b) || (b.track === 'geo' ? 'map' : b.track === 'driver' || b.track === 'delica' ? 'van' : 'star'); return C.art[n] || C.art.star || ''; };
    // Stars mean a level: one to three on badges that come in steps (10 / 50 / 100 tours, tour mastery). A one-off badge or a title has none.
    function starsOf(b, tier) {
      if (b.track === 'titles' || b.track === 'secret') return 0; const byTier = tier === 'gold' ? 3 : tier === 'silver' ? 2 : 1; if (b.track === 'master') return byTier;
      if (!/\d$/.test(b.k)) return 0; const pre = String(b.k).replace(/\d+$/, ''), list = (game(me().id) || {}).list || []; return list.filter(x => x.track === b.track && /\d$/.test(x.k) && String(x.k).replace(/\d+$/, '') === pre).length > 1 ? byTier : 0;
    }
    function medalInner(b, tier, hex) {
      const secret = b.hidden && !b.done, done = !!b.done, O = '#4a3526';
      const c = hex ? { rim: '#d9d9d0', face: '#f1efe8', ink: '#70766d', acc: '#314b3c', paper: '#ffffff' } : { rim: 'var(--line)', face: 'var(--surface2)', ink: 'var(--muted)', acc: 'var(--accent)', paper: 'var(--surface)' };
      const p = Math.max(0, Math.min(100, Math.round((b.have || 0) / (b.goal || 1) * 100))), n = starsOf(b, tier);
      const stars = done && n && window.CUTE ? `<rect x="${48 - (n * 13 + 10) / 2}" y="84" width="${n * 13 + 10}" height="19" rx="9.5" fill="#ffffff" stroke="${O}" stroke-width="2"/>` + [...Array(n)].map((_, i) => window.CUTE.star(48 + (i - (n - 1) / 2) * 13, 93.5, 5.4)).join('') : '';
      const pic = secret ? `<text x="48" y="61" text-anchor="middle" font-size="34" font-weight="700" fill="${c.ink}" font-family="-apple-system,Segoe UI,Roboto,sans-serif">?</text>` : `<g transform="translate(18 16) scale(1.25)"${done ? '' : ' style="filter:grayscale(1);opacity:.4"'}>${cuteOf(b)}</g>`;
      return `<circle cx="48" cy="46" r="42" fill="${done ? '#ffffff' : c.paper}" stroke="${done ? O : c.rim}" stroke-width="3"/>
        <circle cx="48" cy="46" r="35.5" fill="${done ? STICKER[b.track] || '#ffe2b8' : c.face}"/>
        ${!done && !secret && p ? `<circle cx="48" cy="46" r="39" fill="none" stroke="${c.acc}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${(p * 2.45).toFixed(1)} 246" transform="rotate(-90 48 46)"/>` : ''}
        ${pic}${stars}`;
    }
    const medalArt = b => `<span class="art">${`<svg viewBox="0 0 96 104" aria-hidden="true"><defs><clipPath id="mc-${esc(String(b.k).replace(/[^a-z0-9]/gi, ''))}"><circle cx="48" cy="46" r="41"/></clipPath></defs>${medalInner(b, tierOf(b, (game(me().id) || {}).list))}${b.done ? `<g clip-path="url(#mc-${esc(String(b.k).replace(/[^a-z0-9]/gi, ''))})"><rect class="shine" x="-30" y="0" width="16" height="96" fill="#fff" opacity=".6" transform="rotate(20 48 46)"/></g>` : ''}</svg>`}</span>`;
    const bName = b => b.title || T('b_' + b.k), bDesc = b => b.desc || T('bd_' + b.k), bSecret = b => b.hidden && !b.done;
    const medal = b => (bSecret(b) ? `<button class="mdl secret" data-act="badge" data-k="${esc(b.k)}" style="--p:0" aria-label="${T('b_secret')}">${medalArt(b)}<span class="mt">${T('b_secret')}</span><span class="muted small">&nbsp;</span></button>`
      : `<button class="mdl ${b.done ? 'done' : ''}" data-t="${b.track}" data-act="badge" data-k="${esc(b.k)}" style="--p:${Math.round(b.have / b.goal * 100)}" aria-label="${esc(bName(b))}">${medalArt(b)}<span class="mt">${esc(bName(b))}</span><span class="muted small num">${b.track === 'titles' ? nf(b.raw) + ' ' + T('tours_n') : b.track === 'master' ? '×' + nf(b.raw) : b.done ? T('b_done') : nf(b.have) + '/' + nf(b.goal)}</span></button>`);
    function badgeModalHtml(m) {
      const g = game(me().id), b = g.list.find(x => x.k === m.k); if (!b) return '';
      const head = `<div class="hdr"><span class="spacer"></span><button class="iconbtn" data-act="close" aria-label="${T('close')}">✕</button></div>`;
      if (bSecret(b)) return `${head}<div class="ccard"><span class="mdl big secret" style="--p:0">${medalArt(b)}</span><h2>${T('b_secret')}</h2><p class="muted">${T('bd_secret')}</p></div>`;
      return `${head}<div class="ccard"><span class="mdl big ${b.done ? 'done' : ''}" data-t="${b.track}" style="--p:${Math.round(b.have / b.goal * 100)}">${medalArt(b)}</span>${(() => { const n = db.badge_likes.filter(x => x.badge === b.k).length, mine = db.badge_likes.some(x => x.badge === b.k && x.user_id === me().id); return `<span class="bheart"><button class="iconbtn blike" data-act="blike" data-k="${esc(b.k)}" aria-pressed="${mine}" aria-label="${esc(T('bl_like'))}" title="${esc(T('bl_like'))}" ${state.viewAs ? 'disabled' : ''}>${msi('favorite')}</button>${n ? `<span class="num small">${n}</span>` : ''}</span>`; })()}<h2>${esc(bName(b))}</h2><p class="muted">${esc(bDesc(b))}</p>
          ${b.track === 'titles' ? '' : `<b class="num">${nf(b.raw)}/${nf(b.goal)} ${esc(b.unit)}</b><span class="meter" style="width:100%"><i style="width:${Math.round(b.have / b.goal * 100)}%"></i></span>`}${b.done && b.track !== 'master' ? `<span class="tag t-ok">${T('b_done')}</span>` : ''}${b.done && badgeAt(b.k) ? `<span class="muted small num">${T('b_on', { date: fmt(badgeAt(b.k), { day: 'numeric', month: 'long', year: 'numeric' }) })}</span>` : ''}</div>
        ${(() => { if (b.track === 'master' || b.track === 'titles') return ''; const team = staff().filter(p => p.role !== 'admin' || p.id === me().id), n = team.filter(p => p.id !== me().id && (game(p.id).list.find(x => x.k === b.k) || {}).done).length; return `<span class="muted small">${esc(n === 0 ? T(b.done ? 'b_team_only' : 'b_team_none') : T('b_team_n', { n, of: team.length - 1 }))}</span>`; })()}
        ${b.done ? `<div class="actions"><button class="btn" data-act="phfrombadge" data-k="${esc(b.k)}">${msi('photo_camera')}${T('ph_use_badge')}</button><button class="btn" data-act="celereplay" data-k="${esc(b.k)}">${T('b_replay')}</button><button class="btn" data-act="badgesave" data-k="${esc(b.k)}">${T('b_save')}</button><button class="btn primary" data-act="badgeshare" data-k="${esc(b.k)}">${ico('share')}${T('share')}</button></div>` : ''}`;
    }
    // ---------- a newly earned badge gets a full-screen moment ----------
    const seenKey = () => 'fs-badges-' + me().id;
    let celeTimer = null;
    function checkBadges() {
      if (state.viewAs) { clearTimeout(celeTimer); return; }   // looking as someone: their badges are theirs to open; nothing is shown and nothing is marked as seen
      if (!gameOn()) return;   // the person turned the game side off: no badge windows, no weekly challenge
      setTimeout(() => { try { weeklySave(); } catch (e) { /* later */ } }, 2500);
      clearTimeout(celeTimer);
      celeTimer = setTimeout(() => {
        if (!me() || !me().active || state.viewAs || state.modal || window.__noCelebrate) return;
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
    function saveSeen(seen, fresh) { if (state.viewAs || S.mode === 'demo' && !me()) return; const d = (me().display && typeof me().display === 'object') ? me().display : {}, at = { ...(d.badgeAt || {}) }; (fresh || []).forEach(k => { if (!at[k]) at[k] = today(); }); S.save('profiles', { ...stripEmail(me()), badges_seen: seen, display: { ...d, badgeAt: at } }).catch(() => { /* kept on this phone until next time */ }); }
    function badgeNote(bs) {
      if (!bs.length || state.viewAs) return; const old = document.querySelector('.bnote'); if (old) old.remove();
      const el = document.createElement('div'); el.className = 'bnote'; el.setAttribute('role', 'status');
      const bye = () => { if (!el.isConnected) return; document.removeEventListener('pointerdown', away, true); el.classList.remove('in'); setTimeout(() => el.remove(), 250); }, away = e => { if (!el.contains(e.target)) bye(); };
      let sx = null; el.addEventListener('touchstart', e => { sx = [e.touches[0].clientX, e.touches[0].clientY]; }, { passive: true }); el.addEventListener('touchmove', e => { if (sx && (Math.abs(e.touches[0].clientX - sx[0]) > 40 || e.touches[0].clientY - sx[1] > 24)) { sx = null; bye(); } }, { passive: true });
      el.addEventListener('click', e => { if (e.target.closest('.bnx')) bye(); }); setTimeout(() => document.addEventListener('pointerdown', away, true), 400);
      el.innerHTML = `<span class="mdl done" data-t="${esc(bs[0].track)}" style="--p:100">${medalArt(bs[0])}</span><span class="grow-l"><b>${esc(bs.length > 1 ? T('bn_many', { n: bs.length }) : T('bn_one'))}</b><span class="small">${esc(bs.map(bName).join(', '))}</span></span><button class="btn sm" data-act="bnview">${T('bn_view')}</button><button class="iconbtn bnx" type="button" aria-label="${T('close')}">✕</button>`;
      document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('in')); setTimeout(bye, 6000);
    }
    function celebrateHtml(m) {
      const b = game(me().id).list.find(x => x.k === m.k); if (!b) return '';
      const cols = ['#f0901e', '#2f6b48', '#3b5bbd', '#20251f', '#e2b340', '#6243bd'], rib = RIBBON[b.track] || '#f0901e';
      const bits = [...Array(28)].map((_, i) => `<i style="left:${(i * 37) % 100}%;background:${cols[i % cols.length]};animation-delay:${(i % 9) * 0.12}s;animation-duration:${2.2 + (i % 5) * 0.35}s"></i>`).join('');
      // A gift box first: the person opens it with a tap, then the lid flies off and the medal comes out.
      const box = `<svg class="gbox" viewBox="0 0 200 190" aria-hidden="true"><g class="gbase"><rect x="30" y="86" width="140" height="94" rx="10" fill="#e9e3d2" stroke="#20251f" stroke-width="4"/><rect x="88" y="86" width="24" height="94" fill="${rib}" stroke="#20251f" stroke-width="4"/></g>
        <g class="glid"><rect x="20" y="56" width="160" height="36" rx="8" fill="#f1efe8" stroke="#20251f" stroke-width="4"/><rect x="88" y="56" width="24" height="36" fill="${rib}" stroke="#20251f" stroke-width="4"/><path d="M100 56c-26-34-58-18-40-2 10 8 26 6 40 2zm0 0c26-34 58-18 40-2-10 8-26 6-40 2z" fill="${rib}" stroke="#20251f" stroke-width="4" stroke-linejoin="round"/></g></svg>`;
      if (!m.opened) return `<div class="celebrate"><button class="iconbtn celex" data-act="celeok" aria-label="${T('close')}">✕</button><span class="muted">${T(b.track === 'titles' ? 'ce_title' : 'ce_new')}</span><button class="gboxbtn shake" data-act="celeopen" aria-label="${T('ce_open')}">${box}</button><h2>${T('ce_box')}</h2><div class="actions"><button class="btn primary big" data-act="celeopen">${T('ce_open')}</button></div></div>`;
      return `<div class="celebrate opened"><div class="confetti" aria-hidden="true">${bits}</div><button class="iconbtn celex" data-act="celeok" aria-label="${T('close')}">✕</button><span class="muted">${T(b.track === 'titles' ? 'ce_title' : 'ce_new')}</span>
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
        <circle cx="96" cy="984" r="12" fill="#b94a2f"/><text x="122" y="996" font-size="34" font-weight="700" fill="#20251f" ${font}>Friendly.ge</text>
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


    const clearCele = () => clearTimeout(celeTimer);
    // ---------- one quick question a day: how do you feel? (kept as a count; the office sees it, and the card says so) ----------
    const MOODS = [5, 4, 3, 2, 1], moodKey = () => 'fs-mood-' + (me() ? me().id : ''), moodToday = () => { try { const v = JSON.parse(localStorage.getItem(moodKey()) || '{}'); if (v.day === today()) return v; } catch (e) { /* private mode */ } const m = me(), r = m && db.usage.find(u => u.day === today() && twin(u.user_id) === twin(m.id) && /^mood_[1-5]$/.test(u.action)); return r ? { day: today(), v: Number(r.action.slice(5)) } : null; };
    const moodFace = n => `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="${['', '#c9b3ee', '#bcd3ea', '#fff3d6', '#cfeecd', '#ffd166'][n]}" stroke="#4a3526" stroke-width="1.600"/><circle cx="8.500" cy="10" r="1.100" fill="#4a3526"/><circle cx="15.500" cy="10" r="1.100" fill="#4a3526"/><path d="${['', 'M8 17q4-3.500 8 0', 'M8.500 16.500q3.500-2 7 0', 'M8.500 16h7', 'M8.500 15q3.500 2.400 7 0', 'M7.500 14.500q4.500 4.500 9 0'][n]}" fill="none" stroke="#4a3526" stroke-width="1.600" stroke-linecap="round"/></svg>`;
    const moodBtns = () => `<div class="moods">${MOODS.map(n => `<button class="moodb" data-act="mood" data-v="${n}">${moodFace(n)}<span>${T('md_' + n)}</span></button>`).join('')}</div>`;
    function moodCardHtml() { const m = me(); if (!m || !m.active || state.viewAs || pref('mood') === 'off' || moodToday()) return ''; return `<div class="card f moodcard"><div class="row nw"><b class="grow-l">${T('md_q', { name: firstName(m) })}</b><button class="lnk small" data-act="mood" data-v="0">${T('md_skip')}</button></div>${moodBtns()}<span class="muted small">${T('md_note')}</span><button class="lnk small askoff" data-act="askoff" data-k="mood">${T('ask_never')}</button></div>`; }
    function moodLineHtml() { const v = moodToday(); return v && v.v ? `<span class="wrline moodline">${moodFace(v.v)}<span>${T('md_today', { m: T('md_' + v.v) })} <button class="lnk small" data-act="moodredo">${T('md_change')}</button></span></span>` : ''; }
    // ---------- after a tour: one tap to say how it went ----------
    const rateSkip = () => { try { return JSON.parse(localStorage.getItem('fs-rate-skip') || '[]'); } catch (e) { return []; } };
    // The same tour can exist twice (same day, title and start): answering one answers both.
    const twinsOf = x => db.tours.filter(y => y.date === x.date && y.title === x.title && (y.start_time || '') === (x.start_time || ''));
    function rateCardHtml() {
      const m = me(); if (!m || !m.active || state.viewAs || pref('rate') === 'off') return ''; const td = today(), now = hm(new Date().toISOString()), skip = rateSkip();
      const t = db.tours.filter(x => live(x) && involves(x, m.id) && x.date <= td && x.date >= addDays(td, -1) && (endOf(x) < td || !x.end_time || x.end_time <= now) && !twinsOf(x).some(y => myScore(y.id, m.id) || skip.includes(y.id))).sort((a, b) => (b.date + (b.start_time || '')).localeCompare(a.date + (a.start_time || '')))[0];
      if (!t) return ''; return `<div class="card f ratecard"><div class="row nw"><b class="grow-l">${T('rt_q', { tour: aliasOf(t.title), day: t.date === td ? T('today').toLowerCase() : fmtDay(t.date) })}</b><button class="lnk small" data-act="rateskip" data-id="${t.id}">${T('md_skip')}</button></div><div class="moods">${[[10, 5, 'rt_great'], [7, 4, 'rt_good'], [5, 3, 'rt_ok'], [3, 2, 'rt_hard']].map(([sc, f, k]) => `<button class="moodb" data-act="ratequick" data-id="${t.id}" data-s="${sc}">${moodFace(f)}<span>${T(k)}</span></button>`).join('')}</div><button class="lnk small askoff" data-act="askoff" data-k="rate">${T('ask_never')}</button></div>`;
    }
    // One question at a time at the top of the home page: the tour that just ended first, otherwise today's mood.
    const askCardHtml = () => rateCardHtml() || moodCardHtml();
    // ---------- Photo of the day: one photo per person per day, likes from the team, the best one leads; older days are the archive ----------
    // Only the team sees the photos (private storage, opened with short-lived links).
    const PH = { url: {}, asked: new Set(), want: new Set(), timer: 0 };
    const phPath = (p, k) => `${p.user_id}/${p.id}-${k}.jpg`, likesN = p => (Array.isArray(p.likes) ? p.likes.length : 0), iLike = p => (p.likes || []).includes(S.authId);
    function phAsk(paths) {
      paths.forEach(x => { if (!PH.asked.has(x)) { PH.asked.add(x); PH.want.add(x); } }); if (!PH.want.size || PH.timer) return;
      PH.timer = setTimeout(async () => { PH.timer = 0; const list = [...PH.want]; PH.want = new Set(); try { Object.assign(PH.url, await S.photoUrls(list)); } catch (e) { list.forEach(x => PH.asked.delete(x)); return; } if (state.modal && state.modal.type === 'photos') renderModal(); else if (!state.modal) render(); }, 80);
    }
    function phSrc(p, k) { if (p.data) return p.data; const path = phPath(p, k), u = PH.url[path]; if (u) return u; phAsk([path]); return ''; }
    const phImg = (p, k, cls) => { const src = phSrc(p, k); return src ? `<img class="${cls}" src="${esc(src)}" alt="${esc(p.caption || pname(p.user_id))}" loading="lazy" decoding="async">` : `<span class="${cls} wait" aria-hidden="true">${msi('photo_camera')}</span>`; };
    // A badge the person has earned can ride on their photo as a sticker; the few words sit on the photo as a paper label.
    const phBadge = p => { if (!p.sticker) return null; const id = twin(p.user_id), g = game(id), b = g && g.list.find(x => x.k === p.sticker); return b && b.done ? { b, tier: tierOf(b, g.list) } : null; };
    const phStick = (p, cls) => { const x = phBadge(p); return x ? `<span class="phstick ${cls || ''}" title="${esc(bName(x.b))}"><svg viewBox="0 0 96 104" aria-hidden="true">${medalInner({ ...x.b, done: true }, x.tier, true)}</svg></span>` : ''; };
    const phCap = p => (p.caption ? `<span class="phcap">${esc(p.caption)}</span>` : '');
    const myStickers = () => game(me().id).list.filter(b => b.done && !(b.hidden && !b.done)).slice(0, 60);
    async function phDataUrl(p) { if (p.data) return p.data; let u = PH.url[phPath(p, 'f')]; if (!u) { Object.assign(PH.url, await S.photoUrls([phPath(p, 'f')])); u = PH.url[phPath(p, 'f')]; } const bl = await (await fetch(u)).blob(); return await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(bl); }); }
    // The photo as a picture to share: the photo fills the card, the words sit on a paper label, the badge is a sticker in the corner.
    async function photoPng(p) {
      const xml = t => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'), font = 'font-family="-apple-system,Segoe UI,Roboto,Noto Sans,Noto Sans Georgian,sans-serif"';
      const src = await phDataUrl(p), x = phBadge(p), words = String(p.caption || '').split(/\s+/).filter(Boolean), lines = []; let cur = '';
      words.forEach(w => { if ((cur + ' ' + w).trim().length > 30 && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }); if (cur) lines.push(cur); const ls = lines.slice(0, 3), bh = ls.length ? 60 + ls.length * 62 : 0;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1080" height="1350" viewBox="0 0 1080 1350"><rect width="1080" height="1350" fill="#f7f5ef"/><defs><clipPath id="pc"><rect x="40" y="40" width="1000" height="1130" rx="56"/></clipPath></defs>
        <image href="${src}" xlink:href="${src}" x="40" y="40" width="1000" height="1130" preserveAspectRatio="xMidYMid slice" clip-path="url(#pc)"/>
        ${bh ? `<rect x="80" y="${1130 - bh}" width="920" height="${bh}" rx="32" fill="#ffffff" opacity=".93"/>${ls.map((l, i) => `<text x="120" y="${1130 - bh + 84 + i * 62}" font-size="48" font-weight="600" fill="#20251f" ${font}>${xml(l)}</text>`).join('')}` : ''}
        ${x ? `<g transform="translate(770 70) scale(2.6)">${medalInner({ ...x.b, done: true }, x.tier, true)}</g>` : ''}
        <circle cx="84" cy="1262" r="14" fill="#b94a2f"/><text x="114" y="1276" font-size="40" font-weight="700" fill="#20251f" ${font}>Friendly.ge</text>
        <text x="1000" y="1276" text-anchor="end" font-size="36" fill="#55594f" ${font}>${xml(pname(p.user_id))} · ${xml(fmt(p.day, { day: 'numeric', month: 'long', year: 'numeric' }))}</text></svg>`;
      return await new Promise((res, rej) => { const img = new Image(), url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })); img.onload = () => { try { const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; c.getContext('2d').drawImage(img, 0, 0); URL.revokeObjectURL(url); c.toBlob(b => (b ? res(b) : rej(new Error('image'))), 'image/jpeg', 0.88); } catch (e) { rej(e); } }; img.onerror = () => rej(new Error('image')); img.src = url; });
    }
    const photosOn = day => db.photos.filter(p => p.day === day).sort((x, y) => likesN(y) - likesN(x) || String(x.created_at || '').localeCompare(String(y.created_at || '')));
    const myPhoto = day => db.photos.find(p => p.day === day && twin(p.user_id) === me().id);
    // The greeting line. Ordinary day: "Good morning, <name>" and one short phrase (phrases.js). A special day gets a card:
    // own birthday or anniversary (special dates), a holiday from the team calendar, a sick day (get well) or an approved day off.
    const hiText = (k, name) => T(k, { name }).replace(/[,،]\s*$/, '').replace(/,\s*!/, '!');
    function specialOn(day) {
      const m = me(); if (!m) return null; const md = day.slice(5);
      const mine = db.personal_dates.filter(d => twin(d.user_id) === m.id && (d.yearly ? String(d.date).slice(5) === md : d.date === day)).map(d => pdKind(d.title));
      const k = mine.includes('birthday') ? 'birthday' : mine.includes('anniversary') ? 'anniversary' : ''; if (k) return { k, art: 'gift' };
      const o = offOn(m.id, day); if (o && o.type === 'sick') return { k: 'sick', art: 'cup' };
      const h = holidayOn(day); if (h) return { k: 'holiday', art: 'star', name: h.name };
      return o && o.status === 'approved' && o.type !== 'half' ? { k: 'off', art: 'sofa' } : null;
    }
    const specialText = sp => [hiText('gr_' + sp.k, sp.k === 'holiday' ? trName(sp.name) : firstName(me())), T('gr_' + sp.k + '_t')];
    // Bank details the office typed in for a person: they show a banner until the person confirms or edits them.
    const bankWaiting = (pd, id) => !!(pd && pd.entered_by && pd.entered_by !== id && !pd.confirmed_at && (pd.account || pd.bank_name || pd.holder));
    const bankBannerHtml = () => (me() && !state.viewAs && bankWaiting(db.payout_details.find(x => x.id === me().id), me().id) ? `<button class="banner small setupban" data-act="bankgo"><span>${T('bk_banner')}</span><b>${T('xc_see')} ›</b></button>` : '');
    function greetHtml() {
      const m = me(); if (!m || !m.active || state.viewAs) return ''; const td = today(), sp = specialOn(td), art = k => (window.CUTE && window.CUTE.art[k]) || '';
      const bk = bankBannerHtml();
      if (sp) { const [h, t] = specialText(sp); return `<div class="card greet"><svg viewBox="0 0 48 48" aria-hidden="true">${art(sp.art)}</svg><span class="grow-l"><b>${esc(h)}</b><span class="muted small">${esc(t)}</span></span></div>` + bk; }
      return bk;
    }
    // For the greeting shown while the app opens next time: first name, language, and the words for the next seven days. Kept on this phone only.
    function saveHello() {
      try {
        if (!me()) { localStorage.removeItem('fs-hello'); return; }
        const d = {}, td = today();
        for (let i = 0; i < 7; i++) { const day = addDays(td, i), sp = specialOn(day); if (sp) d[day] = { h: specialText(sp)[0], s: specialText(sp)[1] }; }
        localStorage.setItem('fs-hello', JSON.stringify({ n: firstName(me()), l: lang(), d }));
      } catch (e) { /* private mode */ }
    }
    function photoStripHtml() {
      if (!photoOn()) return '';
      if (!me() || !me().active) return ''; const td = today(), ps = photosOn(td), show = ps.length ? ps : photosOn(addDays(td, -1));
      return `<button class="phstrip" data-act="photos">${msi('photo_camera')}<span class="grow-l"><b>${T('ph_title')}</b><span class="muted small">${ps.length ? T('ph_n', { n: ps.length }) : T(myPhoto(td) ? 'ph_n' : 'ph_add_first', { n: 0 })}</span></span><span class="phs-th">${show.slice(0, 3).map(p => phImg(p, 't', 'phs-i')).join('')}</span><b>›</b></button>`;
    }
    function photosModalHtml(m) {
      const td = today(), day = m.day || td, ps = photosOn(day), mine = myPhoto(day), big = m.full && db.photos.find(p => p.id === m.full), can = day === td && !state.viewAs;
      const head = `<div class="hdr"><h2>${T('ph_title')}</h2><button class="iconbtn" data-act="close" aria-label="${T('close')}">✕</button></div>`;
      if (big) return `${head}<button class="lnk" data-act="phfull" data-id="">‹ ${T('back')}</button><div class="phbig">${phImg(big, 'f', 'phbig-i')}${phStick(big, 'lg')}${phCap(big)}</div><div class="row nw">${avatar(big.user_id)}<span class="grow-l"><b>${esc(pname(big.user_id))}</b></span><button class="btn sm phlike" data-act="phlike" data-id="${big.id}" aria-pressed="${iLike(big)}" ${state.viewAs ? 'disabled' : ''}>${msi('favorite')}<span class="num">${likesN(big)}</span></button><button class="btn sm" data-act="phshare" data-id="${big.id}">${ico('share')}${T('share')}</button></div><span class="muted small">${esc(fmtDay(big.day))}${phBadge(big) ? ' · ' + esc(bName(phBadge(big).b)) : ''}</span>`;
      // Step 2 of adding: the chosen photo, a few words, a sticker, one big Post button.
      const dr = m.draft, st = can ? myStickers() : [], sel = m.sticker !== undefined ? m.sticker : (mine ? mine.sticker || '' : '');
      const stickRow = st.length ? `<span class="muted small">${T('ph_sticker')}</span><div class="phstk">${st.map(b => `<button type="button" class="phstk-b" data-act="phstick" data-k="${esc(b.k)}" aria-pressed="${sel === b.k}" aria-label="${esc(bName(b))}" title="${esc(bName(b))}"><svg viewBox="0 0 96 104" aria-hidden="true">${medalInner({ ...b, done: true }, tierOf(b, st), true)}</svg></button>`).join('')}</div>` : '';
      const words = v => `<label>${T('ph_cap')}<input class="inp" id="ph-cap" maxlength="140" value="${esc(v || '')}" autocomplete="off"></label>`;
      if (dr || m.edit) return `${head}<div class="phsteps"><b>${T(dr ? 'ph_step2' : 'ph_edit')}</b></div>
        <div class="phprev">${dr ? `<img class="phprev-i" src="${esc(dr.url)}" alt="">` : phImg(mine, 't', 'phprev-i')}</div>
        <div class="f">${words(m.cap !== undefined ? m.cap : (mine && !dr ? mine.caption : (mine ? mine.caption : '')))}${stickRow}
        ${m.err ? `<div class="banner small warn" role="alert">${esc(m.err)}</div>` : ''}
        <div class="actions"><button type="button" class="btn" data-act="phcancel">${T('cancel')}</button>${dr ? `<button type="button" class="btn primary" data-act="phpost" ${m.busy ? 'disabled' : ''}>${m.busy ? T('ph_sending') : T('ph_post')}</button>` : `<button type="button" class="btn primary" data-act="phsave">${T('save')}</button>`}</div>
        <span class="muted small">${T('ph_rules')}</span></div>`;
      const card = (p, i) => { const own = twin(p.user_id) === me().id && !state.viewAs; return `<div class="phcard" data-key="ph${p.id}"><button class="phpic" data-act="phfull" data-id="${p.id}" aria-label="${T('ph_open')}">${phImg(p, 't', 'phpic-i')}${phStick(p)}${phCap(p)}${i === 0 && likesN(p) > 0 ? `<span class="tag t-ok phbest">${T('ph_best')}</span>` : ''}</button><div class="row nw">${avatar(p.user_id)}<span class="grow-l"><b>${esc(pname(p.user_id))}</b></span><button class="btn sm phlike" data-act="phlike" data-id="${p.id}" aria-pressed="${iLike(p)}" aria-label="${T('ph_like')}" ${state.viewAs ? 'disabled' : ''}>${msi('favorite')}<span class="num">${likesN(p)}</span></button></div>${own && p.day === td ? `<div class="bar"><button class="btn sm" data-act="phedit">${msi('edit')}${T('ph_words')}</button><label class="btn sm filebtn">${msi('photo_camera')}${T('ph_other')}<input type="file" class="vh" accept="image/*" data-ch="phfile"></label></div>` : ''}${own || (isAdmin() && !state.viewAs) ? `<button class="lnk small" data-act="phdel" data-id="${p.id}">${T('ph_del')}</button>` : ''}</div>`; };
      const from = addDays(td, -60), days = [...new Set(db.photos.filter(p => p.day >= from && p.day !== day).map(p => p.day))].sort().reverse();
      const month = td.slice(0, 7), score = {}; db.photos.filter(p => p.day.slice(0, 7) === month).forEach(p => { const id = twin(p.user_id), x = score[id] = score[id] || { n: 0, l: 0 }; x.n++; x.l += likesN(p); });
      const top = Object.entries(score).sort((x, y) => y[1].l - x[1].l || y[1].n - x[1].n).slice(0, 3);
      return `${head}
        ${can && !mine ? `<label class="phdrop">${msi('photo_camera')}<b>${T('ph_add')}</b><span class="muted small">${T('ph_add_t')}</span><input type="file" class="vh" accept="image/*" data-ch="phfile"></label>${m.err ? `<div class="banner small warn" role="alert">${esc(m.err)}</div>` : ''}` : ''}
        <div class="bar"><button class="iconbtn" data-act="phnav" data-d="-1" aria-label="${T('prev')}">‹</button><b class="grow-l" style="justify-content:center">${esc(day === td ? T('today') : fmtDay(day))}</b><button class="iconbtn" data-act="phnav" data-d="1" aria-label="${T('next')}" ${day >= td ? 'disabled' : ''}>›</button></div>
        ${ps.length ? `<div class="phgrid">${ps.map(card).join('')}</div><span class="muted small">${T('ph_vote')}</span>` : `<p class="muted">${T(day === td ? 'ph_none_today' : 'ph_none')}</p>`}
        ${top.length ? `<h3>${T('ph_top')}</h3><div class="card f">${top.map(([id, x]) => `<div class="row nw">${avatar(id)}<span class="grow-l">${esc(pname(id))}</span><span class="muted small num">${T('ph_score', { n: x.n, l: x.l })}</span></div>`).join('')}</div>` : ''}
        ${days.length ? `<details class="sect" ${m.arch ? 'open' : ''}><summary>${T('ph_archive')} (${days.length})</summary><div class="pharch">${days.map(d => { const w = photosOn(d)[0]; return `<button class="pharch-b" data-act="phday" data-day="${d}">${phImg(w, 't', 'pharch-i')}<span class="small num">${esc(fmt(d, { day: 'numeric', month: 'short' }))}</span></button>`; }).join('')}</div></details>` : ''}`;
    }
    // A photo that could not be sent says why in the sheet itself, in plain words, and is written to the problem log for the office.
    function phFail(m, e) { const msg = String((e && e.message) || e || ''), off = msg === 'offline' || !navigator.onLine; console.error(e); m.err = off ? T('ph_offline') : T('ph_fail') + (msg ? ' (' + msg.slice(0, 120) + ')' : ''); try { if (!off) logErr('photo', msg || 'photo failed', (e && e.stack) || ''); } catch (x) { /* log later */ } fx.err(); if (state.modal === m) renderModal(); }
    const shrink = (img, max, q) => new Promise(res => { const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k)); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); c.toBlob(b => res({ blob: b, url: c.toDataURL('image/jpeg', q) }), 'image/jpeg', q); });
    return { B_ICON, METAL, M_SHAPE, PH, RIBBON, STICKER, THEMES, askCardHtml, bName, badgeAt, badgeModalHtml, badgeNote, badgeOut, badgePng, badgeSvg, bankWaiting, celeTimer, celebrateHtml, checkBadges, clearCele, cuteOf, firstRuns, game, greetHtml, holders, likesN, mPoly, medal, medalArt, medalInner, moodFace, moodKey, moodLineHtml, myPhoto, nf, phFail, phPath, photoPng, photoStripHtml, photosModalHtml, rateSkip, saveHello, saveSeen, seenKey, shrink, starsOf, tierOf, titleKey, titlesOf, wrapText, xml };
  };
})();
