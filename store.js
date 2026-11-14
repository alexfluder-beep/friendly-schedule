// Data layer. Demo mode keeps everything in this browser; Supabase mode uses the hosted database with live updates.
(() => {
  'use strict';
  const CFG = window.APP_CONFIG || {};
  const TABLES = ['profiles', 'expenses', 'tours', 'bookings', 'clients', 'client_ratings', 'tour_ratings', 'payout_details', 'log', 'change_requests', 'pay_adjustments', 'personal_dates', 'usage', 'offers', 'time_off', 'holidays', 'tasks', 'notifications', 'settings', 'invites', 'pay_disputes', 'tour_costs', 'photos', 'thanks', 'badge_likes', 'tickets', 'guest_reviews', 'commission_rules', 'payments', 'staff_payments', 'tour_tips'];
  const ADMIN_ONLY = ['commission_rules', 'payments', 'staff_payments'];   // the database shows these to admins only; other phones do not ask
  const DEMO_KEY = 'fs-demo-v18';
  const db = {}; TABLES.forEach(t => db[t] = []);
  const listeners = [];
  let sb = null, me = null;
  const mode = CFG.supabaseUrl && CFG.supabaseKey ? 'supabase' : 'demo';

  const uid = () => (crypto.randomUUID ? crypto.randomUUID() :
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* storage unavailable */ } }
  };
  const emit = (table, row, type, remote) => listeners.forEach(f => f(table, row, type, !!remote));
  function applyLocal(table, row, type) {
    const a = db[table]; if (!a || !row) return;
    const i = a.findIndex(r => r.id === row.id);
    if (type === 'DELETE') { if (i >= 0) a.splice(i, 1); }
    else if (i >= 0) a[i] = { ...a[i], ...row };
    else a.push(row);
    if (table === 'profiles' && me && row.id === me.id && type !== 'DELETE') me = { ...me, ...row };
  }
  let demoTimer = null;
  const persistDemo = () => { if (mode !== 'demo') return; clearTimeout(demoTimer); demoTimer = setTimeout(() => ls.set(DEMO_KEY, JSON.stringify(db)), 400); };

  // ---------- offline: the last loaded data is kept on the phone, changes wait in an outbox ----------
  const idb = {
    db: null,
    open() { return new Promise((res, rej) => { if (idb.db) return res(idb.db); const r = indexedDB.open('friendly-schedule', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => { idb.db = r.result; res(idb.db); }; r.onerror = () => rej(r.error); }); },
    async get(k) { try { const d = await idb.open(); return await new Promise(res => { const q = d.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); }); } catch (e) { return undefined; } },
    async set(k, v) { try { const d = await idb.open(); await new Promise(res => { const tx = d.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = res; tx.onerror = res; }); } catch (e) { /* no storage: the app still works online */ } }
  };
  let outbox = [], cacheTimer = null, subscribed = false;
  const saveCache = () => { if (mode !== 'supabase' || !me || !me.active) return; clearTimeout(cacheTimer); cacheTimer = setTimeout(() => { idb.set('cache', { me, db, at: new Date().toISOString(), delCursor: store.delCursor || null, loadedFrom: store.loadedFrom || null }); idb.set('outbox', outbox); }, 2500); };
  const isNetErr = e => !navigator.onLine || /fetch|network|load failed|abort|timed? ?out/i.test(String((e && e.message) || e) + ' ' + ((e && e.name) || ''));
  // Weak internet: a request that hangs is stopped after 15 seconds, and the change waits on the phone instead.
  // Data counter (Me > Settings): requests and bytes received per day, kept on this phone only.
  // Bytes are counted after the browser has unpacked the answer, so the real network use is lower (about a third).
  const TR_KEY = 'fs-traffic', pad2 = n => String(n).padStart(2, '0');
  function trafficAdd(requests, bytes) {
    try {
      const n = new Date(), d = n.getFullYear() + '-' + pad2(n.getMonth() + 1) + '-' + pad2(n.getDate());
      const t = JSON.parse(localStorage.getItem(TR_KEY) || '{}'), x = t[d] || (t[d] = { n: 0, b: 0 });
      x.n += requests; x.b += bytes;
      const ks = Object.keys(t).sort(); while (ks.length > 40) delete t[ks.shift()];
      localStorage.setItem(TR_KEY, JSON.stringify(t));
    } catch (e) { /* private mode: no counter */ }
  }
  const slowFetch = (url, o) => {
    const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 30000);
    if (o && o.signal) o.signal.addEventListener('abort', () => ac.abort(), { once: true });
    return fetch(url, { ...(o || {}), signal: ac.signal }).then(r => {
      trafficAdd(1, 0);
      try { r.clone().blob().then(b => trafficAdd(0, b.size)).catch(() => {}); } catch (e) { /* ignore */ }
      return r;
    }).finally(() => clearTimeout(tm));
  };
  async function sendOp(o) {
    const q = o.op === 'remove' ? sb.from(o.table).delete().eq('id', o.id) : o.insert ? sb.from(o.table).insert(o.row) : sb.from(o.table).update(o.row).eq('id', o.row.id);
    const { error } = await q; if (error) throw error;
  }
  // A waiting change is written to the phone straight away (not a moment later), so closing the app right after a tap cannot lose it.
  function queue(o) { outbox.push(o); store.pending = outbox.length; idb.set('outbox', outbox); saveCache(); askBackgroundSync(); }
  // Where the browser allows it (Android, Chrome and Edge on a computer), it wakes the app's helper when the internet is back, even with the app closed.
  function askBackgroundSync() { try { if ('serviceWorker' in navigator) navigator.serviceWorker.ready.then(r => { if (r.sync) r.sync.register('fs-outbox').catch(() => {}); }).catch(() => {}); } catch (e) { /* not supported */ } }

  // ---------- demo seed (sample team and tours, not real people) ----------
  const p2 = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  function seedDemo() {
    const today = new Date(); const day = n => { const d = new Date(today); d.setDate(d.getDate() + n); return iso(d); };
    const mon = -((today.getDay() + 6) % 7);
    const P = (name, role, color) => ({ id: uid(), name, role, color, lang: 'en', active: true, phone: role === 'admin' ? '' : '+9955000000' + String(Math.floor(Math.random() * 90) + 10), languages: role === 'guide' ? 'EN, RU' : '' });
    const admin = P('Sample Admin', 'admin', '#0b6e7a');
    const g1 = { ...P('Nino (sample)', 'guide', '#6243bd'), telegram: 'nino_sample' }, g2 = P('Dato (sample)', 'guide', '#a8500c'), g3 = P('Mariam (sample)', 'guide', '#1c7439');
    const d1 = P('Zura (sample)', 'driver', '#2f6f73'), d2 = P('Gela (sample)', 'driver', '#3b5bbd');
    db.profiles = [admin, g1, g2, g3, d1, d2];
    const Tr = (off, s, e, title, kind, cap, pax, g, d, extra = {}) => ({ id: uid(), date: day(mon + off), start_time: s, end_time: e, title, kind, capacity: cap, pax, adults: pax, children: 0, date_to: null, guide_pay: null, driver_pay: null, pickup_url: null, language: 'EN', pickup: '', notes: '', status: 'confirmed', guide_id: g ? g.id : null, driver_id: d ? d.id : null, external_id: null, ...extra });
    db.tours = [];
    // Nino works 8 days in a row to show the rest-day warning
    for (let i = -3; i <= 4; i++) db.tours.push(Tr(i, '10:30', '14:30', 'Brutal Tbilisi group', 'group', 10, 3 + ((i + 9) % 5), g1, null));
    db.tours.push(
      Tr(0, '08:00', '19:00', 'Kazbegi 4x4 group', 'group', 6, 5, g2, d1, { pickup: 'Europe Square, open parking next to the old tram cafe', pickup_url: 'https://maps.app.goo.gl/BB644YvAVizZHyBe6' }),
      Tr(1, '09:00', '20:00', 'Kakheti, Signagi, Bodbe', 'private', 4, 2, g3, d2, { language: 'RU', notes: '+wine' }),
      Tr(2, '08:00', '19:00', 'Kazbegi 4x4 group', 'group', 6, 8, g2, d1, { pickup: 'Rustaveli metro' }),
      Tr(3, '11:00', '14:00', 'Old Tbilisi Walking Tour', 'group', 10, 6, g3, null),
      Tr(4, '09:00', '18:00', 'David Gareji + Signagi', 'private', 4, 3, g2, d2),
      Tr(5, '10:00', '16:00', 'Wine cellars by request', 'custom', 6, 4, g3, d1, { notes: 'Customised: two family cellars, lunch in Sighnaghi' }),
      Tr(5, '10:00', '13:00', 'Mtskheta half-day', 'private', 4, 2, null, null),
      Tr(8, '08:00', '19:00', 'Kazbegi 4x4 group', 'group', 6, 2, g2, d1)
    );
    const k = db.tours.find(t => t.title === 'Kakheti, Signagi, Bodbe'), sb2 = db.tours.find(t => t.title === 'Wine cellars by request');
    db.tours.push(Tr(10, '08:00', '18:00', 'Svaneti 3 days', 'private', 4, 3, g3, d2, { date_to: day(mon + 12), adults: 2, children: 1 }));
    const c1 = { id: uid(), name: 'Sample Guest', phone: '+995500000001', email: null, notes: null }, c2 = { id: uid(), name: 'Sample Family', phone: '+995500000002', email: null, notes: null };
    db.clients = [c1, c2];
    Object.assign(sb2, { adults: 3, children: 1 });
    db.bookings = [
      { id: uid(), tour_id: k.id, client_id: c1.id, guest: 'Sample Guest', adults: 2, children: 0, pax: 2, phone: c1.phone, ref: 'DEMO-001', notes: '', marks: ['wine', 'front_seat'], source: 'GetYourGuide', payment: 'prepaid', amount_due: null },
      { id: uid(), tour_id: sb2.id, client_id: c2.id, guest: 'Sample Family', adults: 3, children: 1, pax: 4, phone: c2.phone, ref: 'DEMO-002', notes: 'Drop-off at the airport', marks: ['wine', 'private_room', 'dropoff'], source: 'Direct', payment: 'cash', amount_due: 450 }
    ];
    const mk = (t, c, a, ch, extra) => ({ id: uid(), tour_id: t.id, client_id: c.id, guest: c.name, adults: a, children: ch, pax: a + ch, phone: c.phone, ref: null, notes: '', marks: [], source: null, payment: null, amount_due: null, ...extra });
    const c3 = { id: uid(), name: 'Sample Couple', phone: '+995500000003', email: null, notes: null }, c4 = { id: uid(), name: 'Sample Friends', phone: '+995500000004', email: 'friends@example.com', notes: null };
    db.clients.push(c3, c4);
    db.tours.filter(t => t.title === 'Kazbegi 4x4 group').forEach((t, i) => { db.bookings.push(mk(t, c3, 2, 0, { ref: 'GYGDEMO' + i, marks: i === 0 ? ['front_seat', 'stays'] : ['front_seat'], payment: 'prepaid', pickup_addr: i === 0 ? 'Stepantsminda, guest house near the main square' : null }), mk(t, c4, t.pax - 2, 0, { ref: 'BR-10000' + i, marks: ['pickup'], payment: 'cash', amount_due: 180 })); });
    const c5 = { id: uid(), name: 'Sample Backpackers', phone: '+995500000005', email: null, notes: null }; db.clients.push(c5);
    const walk = db.tours.find(t => t.title === 'Old Tbilisi Walking Tour'); if (walk) db.bookings.push(mk(walk, c5, 2, 0, { source: 'FreeTour', ref: 'FT-DEMO' }));
    d1.vehicle = 'delica'; d2.vehicle = 'own'; g2.vehicle = 'own';
    db.client_ratings = [{ id: uid(), client_id: c1.id, user_id: g3.id, rating: 'good', note: 'Easy-going, on time', created_at: new Date().toISOString() }];
    db.settings = [{ id: 'rules', value: { pay: { guide_private: 120, guide_group: 100, guide_custom: 150, driver_private: 150, driver_group: 130, driver_custom: 170 }, currency: 'GEL' } }];
    db.time_off = [
      { id: uid(), user_id: g3.id, date_from: day(mon + 6), date_to: day(mon + 6), type: 'dayoff', status: 'approved', note: '', created_at: new Date().toISOString(), decided_by: admin.id },
      { id: uid(), user_id: g1.id, date_from: day(mon + 9), date_to: day(mon + 12), type: 'dayoff', status: 'pending', note: 'Family trip', created_at: new Date().toISOString(), decided_by: null },
      { id: uid(), user_id: d2.id, date_from: day(mon + 2), date_to: day(mon + 3), type: 'sick', status: 'approved', note: '', created_at: new Date().toISOString(), decided_by: null }
    ];
    db.holidays = [{ id: uid(), name: 'Team dinner (sample)', date_from: day(mon + 4), date_to: day(mon + 4), kind: 'event', notes: '' }];
    db.tour_ratings = []; db.tickets = []; db.payout_details = []; db.log = []; db.pay_adjustments = []; db.usage = []; db.offers = [];
    db.personal_dates = [{ id: uid(), user_id: g1.id, title: 'Birthday (sample)', date: day(mon + 3), yearly: true }];
    db.change_requests = [{ id: uid(), tour_id: db.tours.find(t => t.title === 'David Gareji + Signagi').id, user_id: g2.id, patch: { start_time: '08:30' }, cant: false, message: 'Guests asked to start earlier', status: 'pending', created_at: new Date().toISOString(), decided_by: null }];
    const kz = db.tours.find(t => t.title === 'Kazbegi 4x4 group');
    db.tasks = [
      { id: uid(), title: 'Check 4x4 tyres and fuel before Kazbegi', notes: '', due_date: kz.date, assignees: [g2.id, d1.id], status: 'open', tour_id: kz.id, created_by: admin.id, done_by: null, done_at: null },
      { id: uid(), title: 'Collect lunch vouchers from office', notes: '', due_date: day(1), assignees: [g3.id], status: 'open', tour_id: null, created_by: admin.id, done_by: null, done_at: null }
    ];
    db.notifications = [{ id: uid(), user_id: admin.id, kind: 'off_requested', params: { name: g1.name, from: day(mon + 9), to: day(mon + 12) }, read: false, created_at: new Date().toISOString() }];
    persistDemo();
  }

  // ---------- supabase ----------
  function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('load ' + src)); document.head.appendChild(s); }); }
  // Only the last 13 months and everything ahead are loaded at start; older tours are fetched when asked for.
  const windowStart = () => { const d = new Date(); d.setMonth(d.getMonth() - 13); d.setDate(1); return iso(d); };
  function query(t, since) {
    // Pages of 1000 need a fixed order, or rows get skipped or repeated between pages (guides then miss tours in their stats).
    if (t === 'tours' && since) return sb.from('tours').select('*').gte('date', since).order('id');
    if (t === 'bookings' && since) return sb.from('bookings').select('*, tours!inner(date)').gte('tours.date', since).order('id');
    if (t === 'tours' || t === 'bookings' || t === 'clients' || t === 'client_ratings') return sb.from(t).select('*').order('id');
    if (t === 'usage') return sb.from('usage').select('*').gte('day', iso(new Date(Date.now() - 45 * 864e5)));
    if (t === 'log') return sb.from('log').select('*').order('at', { ascending: false }).limit(500);
    if (t === 'notifications') return sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(200);
    return sb.from(t).select('*');
  }
  async function fetchTable(t, since) {
    let from = 0, rows = [];
    for (;;) {
      if ((t === 'log' || t === 'notifications') && from > 0) break;
      const { data, error } = await query(t, since).range(from, from + 999);
      if (error) { if (isNetErr(error)) throw error; console.error(t, error.message); return null; }
      rows = rows.concat(data); if (data.length < 1000) break; from += 1000;
    }
    if (rows.length > 1000 && rows[0] && rows[0].id != null) { const seen = new Set(); rows = rows.filter(r => !seen.has(r.id) && seen.add(r.id)); }
    if (t === 'bookings') rows.forEach(r => { delete r.tours; });
    return rows;
  }
  async function loadAll(since) {
    const began = new Date(Date.now() - 60000).toISOString();   // a minute earlier, so nothing deleted during the load is missed
    since = since || windowStart(); store.loadedFrom = since;
    // All tables are asked for at the same time (one after another took many seconds on a slow phone); the screen changes only when all have arrived.
    const got = await Promise.all(TABLES.map(t => (ADMIN_ONLY.includes(t) && !(me && me.role === 'admin') ? Promise.resolve([]) : fetchTable(t, since)))); TABLES.forEach((t, i) => { db[t] = got[i] || []; });
    store.syncedAt = store.fullAt = new Date().toISOString(); store.delCursor = began;
  }
  // "Only the changes": tours, bookings and guests carry an updated_at stamp (set by the database). After the first full load
  // only rows changed since the newest stamp we hold are fetched, and deleted ids come from deleted_rows. Null = not possible, load everything.
  const BIG = ['tours', 'bookings', 'clients'];
  const newest = () => { let m = ''; for (const t of BIG) for (const r of db[t]) if (r.updated_at && r.updated_at > m) m = r.updated_at; return m; };
  async function pageAll(q) { let from = 0, rows = []; for (;;) { const { data, error } = await q().range(from, from + 999); if (error) { if (isNetErr(error)) throw error; return null; } rows = rows.concat(data); if (data.length < 1000) return rows; from += 1000; } }
  async function delta() {
    const cur = newest(); if (!cur || !store.delCursor || !db.clients.length) return null;
    const since = new Date(new Date(cur).getTime() - 5000).toISOString(), began = new Date(Date.now() - 60000).toISOString();
    const [a, b, c, gone] = await Promise.all([...BIG.map(t => pageAll(() => sb.from(t).select('*').gte('updated_at', since).order('updated_at').order('id'))), pageAll(() => sb.from('deleted_rows').select('tbl,row_id').gt('at', store.delCursor).order('id'))]);
    if (!a || !b || !c || !gone) return null;
    let changed = false;
    [a, b, c].forEach((rows, i) => {
      if (!rows.length) return; const t = BIG[i], at = new Map(db[t].map((r, k) => [r.id, k]));
      rows.forEach(r => { const k = at.get(r.id); if (k === undefined) { db[t].push(r); changed = true; } else if (db[t][k].updated_at !== r.updated_at) { db[t][k] = r; changed = true; } });
    });
    gone.forEach(g => { if (!BIG.includes(g.tbl)) return; const k = db[g.tbl].findIndex(r => String(r.id) === g.row_id); if (k >= 0) { db[g.tbl].splice(k, 1); changed = true; } });
    store.delCursor = began; return changed;
  }
  function subscribe() {
    if (subscribed) return; subscribed = true;
    sb.channel('all-changes').on('postgres_changes', { event: '*', schema: 'public' }, p => {
      if (!db[p.table]) return;
      const type = p.eventType, row = type === 'DELETE' ? p.old : p.new;
      applyLocal(p.table, row, type); emit(p.table, row, type, true); saveCache();
    }).subscribe(status => { store.live = status === 'SUBSCRIBED'; if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') store.pulse(); });
  }
  // Safety net for live updates, three priorities. The live connection already pushes every change by itself; these only repair a missed message.
  //  TOP (quick check every 7 min while live): the schedule from yesterday to 7 days ahead (tours, bookings, their guests), my tasks, notices, change requests.
  //  MEDIUM (every 30 min while live): people (guide and driver edits), time off, holidays, settings.
  //  LOW (full check every 60 min while live, or when the app is opened after 30 min away): every changed tour/booking/guest, photos, thanks, disputes, adjustments, invites.
  //  Old tours, payments, analytics, badges and ratings only arrive with the live connection or the full check. Weather is kept 24 hours on the phone and exchange rates load once a day.
  const TOP = ['tasks', 'notifications', 'change_requests'], MED = ['profiles', 'time_off', 'holidays', 'settings'];
  const COLD = ['invites', 'pay_disputes', 'pay_adjustments', 'photos', 'thanks'];
  const sig = rows => rows.map(r => JSON.stringify(r)).sort().join('|');
  let pulsing = false;
  const ageOf = k => (store[k] ? Date.now() - new Date(store[k]).getTime() : 1e9);
  async function refreshNear() {   // yesterday .. 3 days ahead; returns true when something changed
    const lo = new Date(), hi = new Date(); lo.setDate(lo.getDate() - 1); hi.setDate(hi.getDate() + 7); const a = iso(lo), z = iso(hi);
    const tours = await pageAll(() => sb.from('tours').select('*').gte('date', a).lte('date', z).order('id')); if (!tours) return false;
    const ids = tours.map(t => t.id), bookings = [];
    for (let i = 0; i < ids.length; i += 100) { const part = await pageAll(() => sb.from('bookings').select('*').in('tour_id', ids.slice(i, i + 100)).order('id')); if (!part) return false; bookings.push(...part); }
    const oldT = db.tours.filter(t => t.date >= a && t.date <= z), oldIds = new Set(oldT.map(t => t.id)), oldB = db.bookings.filter(b => oldIds.has(b.tour_id) || ids.includes(b.tour_id));
    let changed = false;
    if (sig(oldT) !== sig(tours)) { db.tours = db.tours.filter(t => !(t.date >= a && t.date <= z)).concat(tours); changed = true; }
    if (sig(oldB) !== sig(bookings)) { const keep = new Set([...oldIds, ...ids]); db.bookings = db.bookings.filter(b => !keep.has(b.tour_id)).concat(bookings); changed = true; }
    const have = new Set(db.clients.map(c => c.id)), need = [...new Set(bookings.map(b => b.client_id).filter(c => c && !have.has(c)))];
    for (let i = 0; i < need.length; i += 100) { const { data } = await sb.from('clients').select('*').in('id', need.slice(i, i + 100)); if (data && data.length) { db.clients = db.clients.concat(data); changed = true; } }
    return changed;
  }
  // How often the checks run for this person while the live connection works. Admin: top 7 min, medium 30, full 60. A guide or driver with a tour today or tomorrow
  // keeps a fast top check (guide 7 min, driver 10); with nothing on, it is slower (guide 20, driver 30). Drivers also get the slow tables less often (full every 2 hours).
  function gaps() {
    const live = store.live, r = me && me.role;
    if (!live) return { top: 140000, med: 300000, full: 600000, back: 120000, backTop: 45000 };
    if (r === 'admin' || !me) return { top: 420000, med: 1800000, full: 3600000, back: 1800000, backTop: 180000 };
    const a = iso(new Date()), t = new Date(); t.setDate(t.getDate() + 1); const z = iso(t);
    const busy = db.tours.some(x => x.date >= a && x.date <= z && x.status !== 'cancelled' && (x.guide_id === me.id || x.driver_id === me.id));
    const drv = r === 'driver', top = drv ? (busy ? 600000 : 1800000) : (busy ? 420000 : 1200000);
    return { top, med: drv ? 3600000 : 1800000, full: drv ? 7200000 : 3600000, back: drv ? 3600000 : 1800000, backTop: Math.round(top / 3) };
  }
  async function pulse(kind) {
    const full = kind !== 'quick';
    if (mode !== 'supabase') { store.syncedAt = new Date().toISOString(); return false; }
    if (pulsing || !me || !me.active || store.offline || store.syncing || outbox.length || !navigator.onLine) return false;
    pulsing = true; let changed = false;
    try {
      if (full) {
        const d = new Date(); d.setDate(d.getDate() - 2); const cut = iso(d);
        const dl = await delta(); if (dl) changed = true;
        const tours = dl === null ? await fetchTable('tours', cut) : null, bookings = dl === null ? await fetchTable('bookings', cut) : null;
        if (tours && bookings) {
          const oldT = db.tours.filter(t => t.date >= cut), hot = new Set([...oldT, ...tours].map(t => t.id)), oldB = db.bookings.filter(b => hot.has(b.tour_id));
          if (sig(oldT) !== sig(tours)) { db.tours = db.tours.filter(t => t.date < cut).concat(tours); changed = true; }
          if (sig(oldB) !== sig(bookings)) { db.bookings = db.bookings.filter(b => !hot.has(b.tour_id)).concat(bookings); changed = true; }
          const have = new Set(db.clients.map(c => c.id)), need = [...new Set(bookings.map(b => b.client_id).filter(c => c && !have.has(c)))];
          for (let i = 0; i < need.length; i += 100) { const { data } = await sb.from('clients').select('*').in('id', need.slice(i, i + 100)); if (data && data.length) { db.clients = db.clients.concat(data); changed = true; } }
        }
      } else if (await refreshNear()) changed = true;
      const medDue = full || ageOf('medAt') > gaps().med, list = full ? TOP.concat(MED, COLD) : medDue ? TOP.concat(MED) : TOP, fresh = await Promise.all(list.map(t => fetchTable(t))); // the small tables load side by side, not one after another
      list.forEach((t, i) => { const rows = fresh[i]; if (rows && sig(rows) !== sig(db[t])) { db[t] = rows; changed = true; } });
      const mine = db.profiles.find(p => p.id === me.id); if (mine) me = { ...me, ...mine };
      store.syncedAt = new Date().toISOString(); if (full) store.fullAt = store.syncedAt; if (medDue) store.medAt = store.syncedAt;
      if (changed) { saveCache(); emit(null, null, 'BULK', true); }
    } catch (e) { if (isNetErr(e)) { store.offline = true; emit(null, null, 'STATE', true); } else console.error('pulse', e); }
    finally { pulsing = false; }
    return changed;
  }
  if (mode === 'supabase') {
    // While the live connection works: top check every 7 minutes (medium every 30, full every 60). Without it the old fast timing comes back (2.5 and 10 minutes).
    const age = ageOf;
    const due = () => { if (document.hidden) return; if (age('fullAt') > gaps().full) pulse(); else if (age('syncedAt') > gaps().top) pulse('quick'); };
    setInterval(due, 60000);
    // The connection looked down: try again every 30 seconds and when the app is opened again.
    setInterval(() => { if (store.offline && navigator.onLine && !document.hidden && me) store.sync(); }, 30000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && store.offline && navigator.onLine && me) store.sync(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) return; if (age('fullAt') > gaps().back) pulse(); else if (age('syncedAt') > gaps().backTop) pulse('quick'); });
  }
  async function afterLogin(user) {
    const { data: p, error: pe } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
    // Shown on the waiting screen, so a set-up problem can be told apart from a person who simply has no access yet.
    store.loginNote = pe ? 'Profile could not be read: ' + (pe.message || pe.code || 'error') : !p ? 'No profile row for this account' : !p.active ? `Profile found: role ${p.role}, not active` : '';
    me = p || { id: user.id, name: user.email, role: 'guide', active: false, lang: null };
    me.email = user.email;
    if (me.active) { let d = null; try { d = await delta(); } catch (e) { if (isNetErr(e)) throw e; } if (d === null) await loadAll(); else store.syncedAt = store.fullAt = new Date().toISOString(); me = { ...(db.profiles.find(x => x.id === user.id) || me), email: user.email }; subscribe(); saveCache(); }
  }

  function demoStale(months) {
    const d = new Date(); d.setMonth(d.getMonth() - months); const cut = iso(d), last = {}, tm = {};
    db.tours.forEach(x => { tm[x.id] = x; });
    db.bookings.forEach(b => { const x = tm[b.tour_id]; if (!x || !b.client_id) return; const e = x.date_to || x.date; if (!last[b.client_id] || e > last[b.client_id]) last[b.client_id] = e; });
    return db.clients.filter(c => !c.anonymised_at && last[c.id] && last[c.id] < cut).map(c => c.id);
  }
  const store = {
    trafficGet: () => { try { return JSON.parse(localStorage.getItem(TR_KEY) || '{}'); } catch (e) { return {}; } },
    mode, db, TABLES, uid, ls, offline: false, warming: false, pending: 0, failed: 0, cachedAt: null, loadedFrom: null, syncedAt: null, live: false, pulse,
    // Older years for reports and statistics.
    async loadOlder(since) { if (mode !== 'supabase' || store.offline || !store.loadedFrom || since >= store.loadedFrom) return; await loadAll(since); emit(null, null, 'BULK'); },
    // Full booking history of one client, including tours older than the loaded window.
    async fetchClient(id) {
      if (mode !== 'supabase' || store.offline) return 0;
      const { data, error } = await sb.from('bookings').select('*, tours(*)').eq('client_id', id).limit(500);
      if (error || !data) return 0; let added = 0;
      for (const r of data) { const t = r.tours; delete r.tours; if (t && !db.tours.some(x => x.id === t.id)) { db.tours.push(t); added++; } if (!db.bookings.some(x => x.id === r.id)) { db.bookings.push(r); added++; } }
      return added;
    },
    get me() { return me; },
    onChange(f) { listeners.push(f); },
    authEvent: null,
    async init() {
      if (mode === 'demo') {
        let ok = false;
        try { const raw = ls.get(DEMO_KEY); if (raw) { const d = JSON.parse(raw); TABLES.forEach(t => db[t] = d[t] || []); ok = db.profiles.length > 0; } } catch (e) { ok = false; }
        if (!ok) seedDemo();
        store.syncedAt = new Date().toISOString();
        if (ls.get('fs-demo-out')) { me = null; return; }
        const as = ls.get('fs-demo-as');
        me = db.profiles.find(p => p.id === as) || db.profiles.find(p => p.role === 'admin') || db.profiles[0];
        return;
      }
      await loadScript('vendor/supabase.js');
      sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { global: { fetch: slowFetch } });
      sb.auth.onAuthStateChange((ev) => { if (store.authEvent) store.authEvent(ev); });
      outbox = (await idb.get('outbox')) || []; store.pending = outbox.length;
      const useCache = async () => { const c = await idb.get('cache'); if (!c || !c.me) return false; me = c.me; TABLES.forEach(t => db[t] = (c.db && c.db[t]) || []); store.offline = true; store.cachedAt = c.at; store.delCursor = c.delCursor || null; store.loadedFrom = c.loadedFrom || null; return true; };
      window.addEventListener('online', () => store.sync());
      window.addEventListener('pagehide', () => { if (outbox.length) idb.set('outbox', outbox); });
      try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) { /* older browser */ }   // ask the browser not to clear what is saved on this device
      window.addEventListener('offline', () => { store.offline = true; emit(null, null, 'STATE', true); });
      if (!navigator.onLine && await useCache()) return;
      // Quick start: someone who used the app on this phone before sees the saved copy at once, and fresh data is fetched behind it.
      // Until it arrives the app behaves as offline (a change made in that second waits in the outbox), but says "loading", not "offline".
      if (await useCache()) { store.warming = true; store.sync().catch(e => console.error('warm start', e)).finally(() => { store.warming = false; emit(null, null, 'STATE', true); }); return; }
      try {
        const { data: { session }, error } = await sb.auth.getSession();
        // A token that could not be refreshed because of a weak connection is not a sign-out: work from the saved copy and try again later.
        if (!session && error && await useCache()) return;
        if (session) { await afterLogin(session.user); if (outbox.length) await store.sync(); }
      } catch (e) { if (!(isNetErr(e) && await useCache())) throw e; }
    },
    // Called when the connection returns: send waiting changes in order, then reload fresh data.
    async sync() {
      if (mode !== 'supabase' || store.syncing) return; store.syncing = true;
      try {
        const { data: { session }, error } = await sb.auth.getSession();
        if (!session && error) throw error;   // could not reach the server to renew the sign-in: stay signed in, offline
        if (!session) { store.offline = false; me = null; await idb.set('cache', null); emit(null, null, 'STATE', true); return; }   // signed out: the saved copy goes too
        while (outbox.length) { try { await sendOp(outbox[0]); } catch (e) { if (isNetErr(e)) throw e; console.error('sync skipped', outbox[0], e.message); store.failed = (store.failed || 0) + 1; } outbox.shift(); store.pending = outbox.length; }
        await idb.set('outbox', outbox);
        await afterLogin(session.user); store.offline = false; emit(null, null, 'STATE', true);
      } catch (e) { store.offline = true; emit(null, null, 'STATE', true); }
      finally { store.syncing = false; if (!store.offline && me && outbox.length) setTimeout(() => store.sync(), 50); }   // a change queued while the fresh data was loading goes out now
    },
    remember(k, v) { return idb.set(k, v); }, recall(k) { return idb.get(k); },   // small notes kept on the device (the language for the helper, the folder for the offline copy)
    get waiting() { return outbox.slice(); },                                          // changes not sent yet, for the offline copy
    demoViewAs(id) { me = db.profiles.find(p => p.id === id) || me; ls.set('fs-demo-as', me.id); emit('profiles', me, 'UPDATE'); },
    demoReset() { ls.del(DEMO_KEY); ls.del('fs-demo-as'); TABLES.forEach(t => db[t] = []); seedDemo(); me = db.profiles[0]; emit('profiles', me, 'UPDATE'); },
    async signIn(email, password) { if (mode === 'demo') { ls.del('fs-demo-out'); me = db.profiles.find(p => p.role === 'admin' && p.active !== false) || db.profiles[0]; return; } const { data, error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw error; await afterLogin(data.user); },
    async signUp(name, email, password) { if (mode === 'demo') { await store.signIn(); return true; } const { data, error } = await sb.auth.signUp({ email, password, options: { data: { name } } }); if (error) throw error; if (data.session) await afterLogin(data.user); return !!data.session; },
    async resetPassword(email) { if (mode === 'demo') return; const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }); if (error) throw error; },
    async setPassword(password) { const { error } = await sb.auth.updateUser({ password }); if (error) throw error; },
    async signOut() {
      if (mode === 'demo') { ls.set('fs-demo-out', '1'); me = null; return; }
      await sb.auth.signOut(); me = null; TABLES.forEach(t => db[t] = []);
      // nothing about guests or the team stays on a phone after sign-out
      await idb.set('cache', null); outbox = []; store.pending = 0; await idb.set('outbox', []); subscribed = false; try { sb.removeAllChannels(); } catch (e) { /* no channel yet */ }
    },
    async mergeClients(target, others) {
      if (mode !== 'demo') { const { error } = await sb.rpc('merge_clients', { target, others }); if (error) throw error; await pulse(); return; }
      db.bookings.forEach(b => { if (others.includes(b.client_id)) b.client_id = target; }); db.client_ratings.forEach(r => { if (others.includes(r.client_id)) r.client_id = target; });
      db.clients = db.clients.filter(c => !others.includes(c.id)); persistDemo();
    },
    // Problem log: errors and lost connections from every phone, so the admin can see what went wrong and when.
    async reportErrors(rows) { if (mode === 'demo') { db.app_errors = [...rows, ...(db.app_errors || [])].slice(0, 300); return; } const { error } = await sb.from('app_errors').insert(rows); if (error) throw error; },
    async fetchErrors() { if (mode === 'demo') return (db.app_errors || []).slice(); const { data, error } = await sb.from('app_errors').select('*').order('at', { ascending: false }).limit(300); if (error) throw error; return data || []; },
    async clearErrors() { if (mode === 'demo') { db.app_errors = []; return; } const { error } = await sb.from('app_errors').delete().lt('at', new Date().toISOString()); if (error) throw error; },
    // Returning guests: only counts come back, never the old bookings themselves.
    async guestVisits(ids, uid) {
      if (mode !== 'demo') { if (store.offline) return []; const { data, error } = await sb.rpc('guest_visits', { ids }); if (error) throw error; return data || []; }
      return [];   // in the demo the app counts from its own sample data
    },
    async repeatGuests(uid) {
      if (mode !== 'demo') { if (store.offline) return 0; const { data, error } = await sb.rpc('my_repeat_guests'); if (error) throw error; return data || 0; }
      const td = iso(new Date()), tm = {}, seen = {}; db.tours.forEach(t => { tm[t.id] = t; });
      db.bookings.forEach(b => { const t = tm[b.tour_id]; if (!t || !b.client_id || t.status === 'cancelled' || t.date > td || !(t.guide_id === uid || t.driver_id === uid)) return; (seen[b.client_id] = seen[b.client_id] || new Set()).add(t.id); });
      return Object.values(seen).filter(s => s.size >= 2).length;
    },
    async myCounts(uid) {
      if (mode !== 'demo') { if (store.offline) return {}; const { data, error } = await sb.rpc('my_counts'); if (error) throw error; return data || {}; }
      const tm = {}, bad = new Set(db.client_ratings.filter(r => r.rating === 'trouble').map(r => r.client_id)), td = iso(new Date()); db.tours.forEach(t => { tm[t.id] = t; });
      let noshow = 0; const tr = new Set();
      db.bookings.forEach(b => { const t = tm[b.tour_id]; if (!t || t.status === 'cancelled' || t.date > td || !(t.guide_id === uid || t.driver_id === uid)) return; if (b.attendance === 'noshow') noshow++; if (bad.has(b.client_id)) tr.add(t.id); });
      return { noshow, trouble: tr.size };
    },
    // Privacy clean-up. In the hosted database this runs on the server, because old tours are not loaded on the phone.
    async staleGuests(months) {
      if (mode === 'demo') return demoStale(months).length;
      const { data, error } = await sb.rpc('stale_guests', { months }); if (error) throw error; return (data || []).length;
    },
    async purgeGuests(months) { if (mode === 'demo') return store.eraseGuests(demoStale(months)); const { data, error } = await sb.rpc('purge_old_guests', { months }); if (error) throw error; if (data) { await store.refresh('clients'); await store.refresh('bookings'); } return data || 0; },
    async eraseGuests(ids) {
      if (!ids.length) return 0;
      if (mode === 'demo') {
        const set = new Set(ids), at = new Date().toISOString();
        db.bookings.forEach(b => { if (set.has(b.client_id)) Object.assign(b, { guest: 'Guest', phone: null, notes: null, ref: null }); });
        db.client_ratings.forEach(r => { if (set.has(r.client_id)) r.note = null; });
        db.clients.forEach(c => { if (set.has(c.id)) Object.assign(c, { name: 'Guest', phone: null, email: null, notes: null, anonymised_at: at }); });
        emit(null, null, 'BULK'); persistDemo(); return ids.length;
      }
      const { data, error } = await sb.rpc('erase_guests', { ids }); if (error) throw error;
      await store.refresh('clients'); await store.refresh('bookings'); return data || 0;
    },
    // Removing a person: their sign-in is closed and private details are wiped; the name stays on past tours and pay reports.
    async removePerson(id) {
      if (mode === 'demo') {
        const used = db.tours.some(t => t.guide_id === id || t.driver_id === id);
        ['payout_details'].forEach(t => { db[t] = db[t].filter(r => r.id !== id); });
        ['personal_dates', 'time_off', 'notifications'].forEach(t => { db[t] = db[t].filter(r => r.user_id !== id); });
        if (used) applyLocal('profiles', { id, active: false, left_at: new Date().toISOString(), phone: null, avatar: null }, 'UPDATE'); else applyLocal('profiles', { id }, 'DELETE');
        emit(null, null, 'BULK'); persistDemo(); return;
      }
      const { error } = await sb.rpc('admin_remove_person', { uid: id }); if (error) throw error;
      for (const t of ['profiles', 'payout_details', 'personal_dates', 'time_off']) await store.refresh(t);
    },
    async save(table, row) {
      const exists = db[table].some(r => r.id === row.id);
      applyLocal(table, row, 'UPSERT'); emit(table, row, 'UPSERT');
      if (mode === 'demo') { persistDemo(); return; }
      // update and insert are separate on purpose: the security rules differ for each
      const op = { op: 'save', table, row, insert: !exists };
      if (store.offline || !navigator.onLine) { queue(op); return; }
      try { await sendOp(op); saveCache(); } catch (error) { if (isNetErr(error)) { store.offline = true; queue(op); emit(null, null, 'STATE', true); return; } await store.refresh(table); throw error; }
    },
    async saveMany(table, rows) {
      const seen = new Map(); rows.forEach(r => seen.set(r.id, { ...(seen.get(r.id) || {}), ...r })); rows = [...seen.values()];   // one row per ID, or the database refuses the whole batch
      rows.forEach(r => applyLocal(table, r, 'UPSERT')); emit(table, null, 'BULK');
      if (mode === 'demo') { persistDemo(); return; }
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await sb.from(table).upsert(rows.slice(i, i + 200));
        if (error) { await store.refresh(table); throw error; }
      }
    },
    async remove(table, id) {
      applyLocal(table, { id }, 'DELETE'); emit(table, { id }, 'DELETE');
      if (mode === 'demo') { persistDemo(); return; }
      const op = { op: 'remove', table, id };
      if (store.offline || !navigator.onLine) { queue(op); return; }
      try { await sendOp(op); saveCache(); } catch (error) { if (isNetErr(error)) { store.offline = true; queue(op); emit(null, null, 'STATE', true); return; } await store.refresh(table); throw error; }
    },
    // ---- team photos: the pictures live in a private storage folder, the table row holds who, when and the likes ----
    get authId() { return me ? me.id : null; },
    async addPhoto(row, thumb, full, thumbUrl) {
      if (mode === 'demo') { applyLocal('photos', { ...row, data: thumbUrl }, 'UPSERT'); emit('photos', row, 'UPSERT'); persistDemo(); return; }
      if (store.offline || !navigator.onLine) throw new Error('offline');
      const base = `${row.user_id}/${row.id}`, opt = { upsert: true, contentType: 'image/jpeg', cacheControl: '31536000' };
      let r = await sb.storage.from('photos').upload(base + '-f.jpg', full, opt); if (r.error) throw r.error;
      r = await sb.storage.from('photos').upload(base + '-t.jpg', thumb, opt); if (r.error) throw r.error;
      const { error } = await sb.from('photos').upsert(row); if (error) throw error;
      applyLocal('photos', row, 'UPSERT'); emit('photos', row, 'UPSERT'); saveCache();
    },
    // ---- problem reports: the row holds the text and status; small still pictures live in the private "tickets" folder ----
    async addTicket(row, blobs) {
      if (mode === 'demo') { applyLocal('tickets', { ...row, shots: [] }, 'UPSERT'); emit('tickets', row, 'UPSERT'); persistDemo(); return; }
      if (store.offline || !navigator.onLine) throw new Error('offline');
      const paths = [];
      for (let i = 0; i < blobs.length; i++) { const p = `${row.user_id}/${row.id}-${i}.jpg`, r = await sb.storage.from('tickets').upload(p, blobs[i], { upsert: true, contentType: 'image/jpeg' }); if (r.error) throw r.error; paths.push(p); }
      const full = { ...row, shots: paths }; const { error } = await sb.from('tickets').insert(full); if (error) throw error;
      applyLocal('tickets', full, 'UPSERT'); emit('tickets', full, 'UPSERT'); saveCache();
    },
    async ticketUrls(paths) {
      if (mode === 'demo' || !paths.length) return {};
      const { data, error } = await sb.storage.from('tickets').createSignedUrls(paths, 3600); if (error) throw error;
      const out = {}; (data || []).forEach(x => { if (x.signedUrl && !x.error) out[x.path] = x.signedUrl; }); return out;
    },
    async photoUrls(paths) {
      if (mode === 'demo' || !paths.length) return {};
      const { data, error } = await sb.storage.from('photos').createSignedUrls(paths, 6 * 3600); if (error) throw error;
      const out = {}; (data || []).forEach(x => { if (x.signedUrl && !x.error) out[x.path] = x.signedUrl; }); return out;
    },
    async likePhoto(id) {
      const row = db.photos.find(x => x.id === id); if (!row || !me) return;
      const toggle = () => { const l = Array.isArray(row.likes) ? row.likes : []; return l.includes(me.id) ? l.filter(x => x !== me.id) : [...l, me.id]; };
      if (mode === 'demo') { applyLocal('photos', { id, likes: toggle() }, 'UPSERT'); emit('photos', row, 'UPSERT'); persistDemo(); return; }
      applyLocal('photos', { id, likes: toggle() }, 'UPSERT'); emit('photos', row, 'UPSERT');            // shown at once, the server answer follows
      const { data, error } = await sb.rpc('photo_like', { p: id }); if (error) { await store.refresh('photos'); throw error; }
      if (Array.isArray(data)) { applyLocal('photos', { id, likes: data }, 'UPSERT'); emit('photos', row, 'UPSERT'); }
    },
    async removePhoto(row) {
      if (mode !== 'demo') { const base = `${row.user_id}/${row.id}`; await sb.storage.from('photos').remove([base + '-f.jpg', base + '-t.jpg']); }
      await store.remove('photos', row.id);
    },
    async refresh(table) {
      if (mode !== 'supabase') return;
      const rows = await fetchTable(table, store.loadedFrom || windowStart()).catch(() => null);
      if (rows) { db[table] = rows; emit(table, null, 'BULK'); }
    },
    async removePushSubscription(endpoint) { if (mode !== 'supabase') return; await sb.from('push_subscriptions').delete().eq('endpoint', endpoint); },
    async savePushSubscription(sub) {
      if (mode !== 'supabase') return;
      const j = sub.toJSON();
      const { error } = await sb.from('push_subscriptions').upsert({ user_id: me.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: 'endpoint' });
      if (error) throw error;
    }
  };
  window.Store = store;
})();
