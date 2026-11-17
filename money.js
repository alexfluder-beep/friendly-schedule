// Friendly Schedule: Money (its own module, 17 Nov). Back office > Money has four parts:
//   Overview  profit, where the money went, 12 months, tours, platforms, team cost, add-ons, losses (all worked out from bookings and tours)
//   Team      a running balance per guide and driver in every currency (USD is the main one): earned + corrections + expenses
//             - cash they kept - what we paid. "Pay" and "Took cash" write one row in staff_payments.
//   Guests    bookings that miss a price or a payment type, filled in on the spot; what each platform owes us this month
//   Setup     platform commission, add-on prices, and whether guides and drivers see their own balance
// Nothing here is bookkeeping or RS.ge (that is the separate accounting project); every number is a sum of rows you can open.
// Loaded before app.js; app.js calls window.FSMoney({...helpers}) once and gets back what it needs.
(function () {
  'use strict';
  window.FSMoney = function (d) {
    const { getMemo, setMemo, db, state, S, T, me, isAdmin, run, toast, logAct, render, msi, esc, nf, fmt, fmtDay, today, iso, opt, crew, pname, rules, rateOf, fxOn, manualRate, statKey, aliasOf, srcName, sourceOf, netOf, guestCur, live, statement, CURRENCIES, SOURCES,
      salaryHtml, payFor, extraPay, costOf, tourBookings, monthEnd, payFrom, avatar, shortName } = d;
    const STAFF_METHODS = ['cash', 'card', 'bank'], PAYS = ['prepaid', 'cash', 'unpaid'];
    const ADDONS = ['wine', 'front_seat', 'bear_food', 'private_room', 'stays', 'pickup', 'dropoff'];
    const NOT_PLATFORM = ['Direct', 'Website', 'FreeTour'];
    const r2 = v => Math.round(v * 100) / 100;
    const base = () => rules().currency || 'GEL';
    const gelRate = (cur, date) => (!cur || cur === 'GEL' ? 1 : (fxOn(cur, date || today()) || manualRate(cur) || 0));
    const toBase = (v, cur, date) => { const n = Number(v) || 0; if (!n) return 0; const r = rateOf(cur || base(), date || today()); return r ? n * r : null; };
    const cfg = () => (db.settings.find(s => s.id === 'money') || {}).value || {};
    const addonPrice = k => { const a = (cfg().addons || {})[k]; return a && Number(a.price) > 0 ? a : null; };
    const money = (v, c) => `${nf(Math.round(v))} ${esc(c || base())}`;
    const sign = (v, c) => `${v < 0 ? '−' : ''}${nf(Math.abs(Math.round(v)))} ${esc(c || base())}`;
    const moShift = (mo, n) => { const x = new Date(Number(mo.slice(0, 4)), Number(mo.slice(5, 7)) - 1 + n, 1); return iso(x).slice(0, 7); };
    const moName = (mo, short) => fmt(mo + '-01', short ? { month: 'short' } : { month: 'long', year: 'numeric' });
    const toursById = () => { const m = getMemo(); return m.tmapN === db.tours.length ? m.tmap : (m.tmapN = db.tours.length, m.tmap = new Map(db.tours.map(t => [t.id, t]))); };
    const loadedMo = () => (S.loadedFrom || '2000-01-01').slice(0, 7);

    // ---------- Commission (kept from the first Money screen) ----------
    function curPct(src) {
      const rs = (db.commission_rules || []).filter(x => srcName(x.platform) === srcName(src) && !x.tour_key && x.valid_from <= today()).sort((x, y) => y.valid_from.localeCompare(x.valid_from));
      if (rs.length) return Number(rs[0].percent) || 0;
      const m = String(rules().commission ?? 'GetYourGuide 25').match(new RegExp(String(src).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*[=:]?\\s*([\\d.]+)', 'i')); return m ? Number(m[1]) || 0 : 0;
    }
    // The commission of one booking: a rule for this tour wins, then a rule for the platform (newest "valid from" before the tour day), then the old text in Rules.
    function ruleCommission(b) {
      const rs = db.commission_rules; if (!rs || !rs.length) return null;
      const src = srcName(sourceOf(b) || b.source), t = toursById().get(b.tour_id); if (!src || !t) return null;
      const key = statKey(t.title), pick = list => list.filter(x => x.valid_from <= t.date).sort((x, y) => y.valid_from.localeCompare(x.valid_from))[0];
      const mine = rs.filter(x => srcName(x.platform) === src), one = pick(mine.filter(x => x.tour_key && x.tour_key === key)) || pick(mine.filter(x => !x.tour_key));
      return one ? Math.min(90, Number(one.percent) || 0) : null;
    }

    // ---------- Numbers of one month (memo, cleared when data changes) ----------
    function agg(mo) {
      const m = getMemo(), key = 'mnA_' + mo; if (m[key]) return m[key];
      const from = mo + '-01', to = monthEnd(mo), td = today();
      const o = { mo, tours: 0, later: 0, guests: 0, bks: 0, priced: 0, nopay: 0, paid: 0, fees: 0, net: 0, guide: 0, driver: 0, costs: 0, exp: 0, counted: 0, left: 0, cGuide: 0, cDriver: 0, cCosts: 0, noRate: new Set(), byTour: {}, bySrc: {}, addons: {}, people: {}, losses: [], old: mo < loadedMo() };
      const addP = (id, v) => { if (!id || !v) return; const p = o.people[id] = o.people[id] || { pay: 0, tours: 0 }; p.pay += v; p.tours++; };
      db.tours.filter(t => live(t) && t.date >= from && t.date <= to).forEach(t => {
        o.tours++; if (t.date > td) o.later++;
        const bs = tourBookings(t.id); let tp = 0, tn = 0, full = bs.length > 0;
        bs.forEach(b => {
          o.bks++; if (!b.payment) o.nopay++;
          const pax = Number(b.pax) || 1, src = srcName(sourceOf(b)) || T('mn_src_none'), s = o.bySrc[src] = o.bySrc[src] || { bks: 0, pax: 0, paid: 0, fees: 0, net: 0 };
          s.bks++; s.pax += pax;
          (b.marks || []).forEach(k => { if (!ADDONS.includes(k)) return; const a = o.addons[k] = o.addons[k] || { n: 0, pax: 0, val: 0 }; a.n++; a.pax += pax; const pr = addonPrice(k); if (pr) a.val += toBase(Number(pr.price) * (pr.per === 'booking' ? 1 : pax), pr.cur || base(), t.date) || 0; });
          const p = Number(b.price) || 0; if (!p) { if (srcName(sourceOf(b)) === 'FreeTour') { o.priced++; return; } full = false; return; }
          const r = rateOf(b.currency || guestCur(), t.date); if (!r) { o.noRate.add(b.currency || guestCur()); full = false; return; }
          o.priced++; const pv = p * r, nv = netOf(b) * r; tp += pv; tn += nv; s.paid += pv; s.net += nv; s.fees += pv - nv;
        });
        const g = t.guide_id ? payFor(t, 'guide') : 0, dr = t.driver_id ? payFor(t, 'driver') : 0, c = costOf(t.id).total;
        let ex = 0; (t.extra_guides || []).forEach(x => { const v = extraPay(t, x); ex += v; addP(x.id, v); });
        addP(t.guide_id, g); addP(t.driver_id, dr);
        const k = statKey(t.title), row = o.byTour[k] = o.byTour[k] || { key: k, title: aliasOf(t.title), tours: 0, pax: 0, paid: 0, net: 0, team: 0, costs: 0, gaps: 0 };
        row.tours++; row.pax += Number(t.pax) || 0; row.paid += tp; row.net += tn; row.team += g + dr + ex; row.costs += c; if (!full) row.gaps++;
        if (full && t.date <= td && tn - (g + dr + ex + c) < -0.5) o.losses.push({ t, net: tn, cost: g + dr + ex + c });
        o.guests += Number(t.pax) || 0; o.guide += g + ex; o.driver += dr; o.costs += c;
        if (full) { o.counted++; o.paid += tp; o.net += tn; o.cGuide += g + ex; o.cDriver += dr; o.cCosts += c; } else o.left++;
      });
      o.fees = o.paid - o.net;
      (db.expenses || []).filter(x => x.date >= from && x.date <= to).forEach(x => { const v = toBase(x.amount, x.currency, x.date); if (v === null) o.noRate.add(x.currency); else o.exp += v; });
      o.team = o.guide + o.driver; o.profit = o.net - o.cGuide - o.cDriver - o.cCosts - o.exp; o.margin = o.paid ? o.profit / o.paid : 0;
      m[key] = o; return o;
    }

    // ---------- Balance of one person: a running list from the first pay month, every currency apart ----------
    function ledger(id, upto) {
      const m = getMemo(), key = 'mnL_' + id + '_' + upto; if (m[key]) return m[key];
      const start = payFrom().slice(0, 7), td = today(), months = [], run = {};
      const add = (bag, cur, v) => { if (!v) return; bag[cur] = r2((bag[cur] || 0) + v); };
      for (let mo = start, i = 0; mo <= upto && i < 60; mo = moShift(mo, 1), i++) {
        const st = statement(id, mo), from = mo + '-01', to = monthEnd(mo), x = { mo, earned: st.total, base: st.base, adj: r2(st.total - st.base), tours: st.past.length, cash: {}, exp: {}, paid: {}, gave: {}, list: [] };
        const ev = x.events = [], E = (date, icon, label, sub, v, cur, k, pid) => { if (Math.abs(v) >= 0.005) ev.push({ date, icon, label, sub, v: r2(v), cur, k, pid }); };
        st.past.forEach(r => E(r.t.date, 'directions_walk', aliasOf(r.t.title), T('mn_ev_tour'), r.pay, base(), 'earn'));
        st.adj.forEach(a => E((a.created_at || mo + '-28').slice(0, 10), 'edit', a.note || T('correction'), T('correction'), Number(a.amount) || 0, base(), 'adj'));
        db.tours.filter(t => live(t) && t.date >= from && t.date <= to && t.date <= td && (t.guide_id === id || (!t.guide_id && t.driver_id === id))).forEach(t => {
          const per = {}; tourBookings(t.id).forEach(b => { if (b.payment === 'cash' || b.payment === 'unpaid') add(per, b.currency || guestCur(), Number(b.amount_due) || 0); });
          Object.entries(per).forEach(([c, v]) => { add(x.cash, c, v); E(t.date, 'payments', aliasOf(t.title), T('mn_ev_cash'), -v, c, 'cash'); });
        });
        st.fix.forEach(f => { add(x.cash, base(), Number(f.amount) || 0); E((f.created_at || mo + '-28').slice(0, 10), 'payments', String(f.note || '').replace(/^cash\|/, '') || T('mn_ev_cash'), T('mn_ev_cash'), -(Number(f.amount) || 0), base(), 'cash'); });
        (db.expenses || []).filter(e => e.user_id === id && e.date >= from && e.date <= to).forEach(e => { add(x.exp, e.currency || 'GEL', Number(e.amount) || 0); E(e.date, 'receipt_long', T('ex_k_' + e.kind), e.note || T('mn_ev_exp'), Number(e.amount) || 0, e.currency || 'GEL', 'exp'); });
        db.staff_payments.filter(p => p.user_id === id && (p.for_month || (p.paid_at || '').slice(0, 7)) === mo).forEach(p => { const v = Number(p.amount) || 0; if (v < 0) add(x.gave, p.currency, -v); else add(x.paid, p.currency, v); x.list.push(p); E(p.paid_at, v < 0 ? 'savings' : 'wallet', T(v < 0 ? 'mn_ev_gave' : 'mn_ev_paid'), [T('mt_' + p.method), p.note !== T(v < 0 ? 'mn_ev_gave' : 'mn_ev_paid') && p.note !== T('mn_gave_ph') ? p.note : ''].filter(Boolean).join(' · '), -v, p.currency, v < 0 ? 'gave' : 'paid', p.id); });
        const delta = {}; add(delta, base(), x.earned); Object.entries(x.exp).forEach(([c, v]) => add(delta, c, v)); Object.entries(x.gave).forEach(([c, v]) => add(delta, c, v));
        Object.entries(x.cash).forEach(([c, v]) => add(delta, c, -v)); Object.entries(x.paid).forEach(([c, v]) => add(delta, c, -v));
        x.open = { ...run }; Object.entries(delta).forEach(([c, v]) => add(run, c, v)); x.close = { ...run }; x.delta = delta;
        months.push(x);
      }
      const bal = months.length ? months[months.length - 1].close : {}, total = Object.entries(bal).reduce((n, [c, v]) => n + (toBase(v, c, td) || 0), 0);
      const out = { months, now: months[months.length - 1] || null, bal, total: r2(total), lastPay: db.staff_payments.filter(p => p.user_id === id && Number(p.amount) > 0).sort((a, b) => b.paid_at.localeCompare(a.paid_at))[0] || null };
      m[key] = out; return out;
    }
    const balLine = bal => Object.entries(bal).filter(([, v]) => Math.abs(v) >= 0.5).sort((a, b) => (a[0] === base() ? -1 : b[0] === base() ? 1 : a[0].localeCompare(b[0]))).map(([c, v]) => `<span class="num ${v < 0 ? 'neg' : ''}">${sign(v, c)}</span>`).join(' · ') || `<span class="num">0 ${esc(base())}</span>`;
    const cashOf = L => { const o = {}; Object.entries(L.now ? L.now.cash : {}).forEach(([c, v]) => { if (v) o[c] = v; }); return o; };

    // ---------- Small drawing helpers (plain HTML and CSS, no chart library) ----------
    const tile = (icon, label, value, sub, act, tab, cls) => `<button class="mn-tile ${cls || ''}" ${act ? `data-act="${act}" data-v="${tab}"` : 'disabled'}>${msi(icon)}<span class="mn-tl">${label}</span><b class="num">${value}</b>${sub ? `<span class="muted small">${sub}</span>` : ''}</button>`;
    const wfRow = (label, v, max, cls, minus) => `<div class="mn-wf ${cls || ''}"><span class="mn-wl">${label}</span><span class="mn-wb"><i style="width:${max ? Math.max(1, Math.min(100, Math.abs(v) / max * 100)) : 0}%"></i></span><b class="num">${minus && v ? '− ' : ''}${sign(v)}</b></div>`;
    const pctTxt = (a, b) => (b ? `${a >= b ? '+' : '−'}${Math.round(Math.abs(a - b) / Math.abs(b) * 100)}%` : '');

    function overviewHtml(mo) {
      const o = agg(mo), prev = agg(moShift(mo, -1)), c = base();
      if (o.old) return `<div class="card f"><span class="muted">${T('mn_old', { d: fmtDay(S.loadedFrom) })}</span></div>`;
      const team = teamRows(mo), owe = team.reduce((n, x) => n + Math.max(0, x.L.total), 0), cashT = {}; team.forEach(x => Object.entries(cashOf(x.L)).forEach(([k, v]) => { cashT[k] = (cashT[k] || 0) + v; }));
      const plat = Object.entries(o.bySrc).filter(([s]) => !NOT_PLATFORM.includes(s) && s !== T('mn_src_none')).reduce((n, [, s]) => n + s.net, 0), miss = o.bks - o.priced;
      const max = Math.max(o.paid, o.cGuide + o.cDriver + o.cCosts + o.exp, 1);
      const months = []; for (let i = 11; i >= 0; i--) { const k = moShift(mo, -i); if (k >= loadedMo()) months.push(agg(k)); }
      const tmx = Math.max(1, ...months.map(x => Math.max(x.net, Math.abs(x.profit))));
      const tours = Object.values(o.byTour).map(r => ({ ...r, profit: r.net - r.team - r.costs })).sort((a, b) => (a.gaps === a.tours) - (b.gaps === b.tours) || b.profit - a.profit);
      const srcs = Object.entries(o.bySrc).sort((a, b) => b[1].paid - a[1].paid || b[1].bks - a[1].bks);
      const ppl = Object.entries(o.people).sort((a, b) => b[1].pay - a[1].pay), pmx = Math.max(1, ...ppl.map(([, p]) => p.pay));
      return `<div class="card mn-hero ${o.profit < 0 ? 'loss' : ''}"><span class="muted">${T('mn_profit_of', { m: esc(moName(mo)) })}</span><b class="bignum num">${sign(o.profit, c)}</b>
          <span class="small">${T('mn_counted', { n: o.counted, t: o.tours })}${o.paid && o.margin > -1 ? ' · ' + T('mn_margin', { p: Math.round(o.margin * 100) }) : ''}${prev.paid && !prev.old ? ` · ${T('mn_vs_prev', { p: pctTxt(o.profit, prev.profit), m: esc(moName(prev.mo, true)) })}` : ''}${o.later ? ` · ${T('mn_later', { n: o.later })}` : ''}</span>
          ${o.left ? `<button class="lnk small mn-gap" data-act="mntab" data-v="guests">${msi('warning')}${T('mn_gap', { n: o.left, b: miss })}</button>` : ''}</div>
        <div class="mn-tiles">${tile('groups', T('mn_t_owe'), money(owe, c), T('mn_t_owe_s', { n: team.filter(x => x.L.total > 0.5).length }), 'mntab', 'team')}${tile('payments', T('mn_t_cash'), balLine(cashT), T('mn_t_cash_s'), 'mntab', 'team')}${tile('storefront', T('mn_t_plat'), money(plat, c), T('mn_t_plat_s'), 'mntab', 'guests')}${tile('edit', T('mn_t_miss'), nf(miss + o.nopay), T('mn_t_miss_s', { p: miss, t: o.nopay }), 'mntab', 'guests', miss + o.nopay ? 'warn' : '')}</div>
        <div class="card f"><b>${T('mn_where')}</b><span class="muted small">${T('mn_where_note', { n: o.counted })}</span>${wfRow(T('mn_w_paid'), o.paid, max, 'in')}${wfRow(T('mn_w_fees'), o.fees, max, 'out', 1)}${wfRow(T('mn_w_guides'), o.cGuide, max, 'out', 1)}${wfRow(T('mn_w_drivers'), o.cDriver, max, 'out', 1)}${o.cCosts ? wfRow(T('mn_w_costs'), o.cCosts, max, 'out', 1) : ''}${o.exp ? wfRow(T('mn_w_exp'), o.exp, max, 'out', 1) : ''}${wfRow(T('mn_w_profit'), o.profit, max, o.profit < 0 ? 'neg' : 'res')}
          ${o.noRate.size ? `<span class="muted small">${T('wf_norate', { c: esc([...o.noRate].join(', ')) })}</span>` : ''}</div>
        <div class="card f"><b>${T('mn_trend')}</b><div class="mn-trend">${months.map(x => `<button class="mn-tc ${x.mo === mo ? 'on' : ''}" data-act="mngo" data-v="${x.mo}" title="${esc(moName(x.mo))}: ${esc(sign(x.profit, c))}"><span class="num mn-tv ${x.profit < 0 ? 'neg' : ''}">${Math.abs(x.profit) >= 1000 ? (x.profit / 1000).toFixed(1) + 'k' : Math.round(x.profit)}</span><span class="mn-tp"><i class="g" style="height:${Math.round(x.net / tmx * 100)}%"></i><i class="p ${x.profit < 0 ? 'neg' : ''}" style="height:${Math.round(Math.abs(x.profit) / tmx * 100)}%"></i></span><span class="small muted">${esc(moName(x.mo, true))}</span></button>`).join('')}</div>
          <span class="muted small"><i class="mn-key g"></i>${T('mn_k_get')} <i class="mn-key p"></i>${T('mn_k_profit')}</span></div>
        <div class="card f"><b>${T('mn_tours')}</b><div class="tablewrap"><table><tr><th>${T('tour')}</th><th class="n">${T('tours_n')}</th><th class="n">${T('guests')}</th><th class="n">${T('mn_c_get')}</th><th class="n">${T('mn_c_team')}</th><th class="n">${T('mn_c_profit')}</th><th class="n">${T('mn_c_pg')}</th></tr>
          ${tours.map(r => `<tr class="${r.profit < 0 && !r.gaps ? 'neg' : ''}"><td>${esc(r.title)}${r.gaps ? ` <span class="tag t-warn" title="${esc(T('mn_gaps', { n: r.gaps }))}">${r.gaps}?</span>` : ''}</td><td class="n">${r.tours}</td><td class="n">${r.pax}</td><td class="n">${nf(Math.round(r.net))}</td><td class="n">${nf(Math.round(r.team + r.costs))}</td><td class="n"><b>${r.gaps === r.tours ? '—' : sign(r.profit, '')}</b></td><td class="n">${r.pax && r.gaps < r.tours ? nf(Math.round(r.profit / r.pax)) : '—'}</td></tr>`).join('') || `<tr><td colspan="7" class="muted">—</td></tr>`}</table></div><span class="muted small">${T('mn_tours_note', { c: esc(c) })}</span></div>
        ${o.losses.length ? `<div class="card f mn-loss"><b>${msi('warning')}${T('mn_losses', { n: o.losses.length })}</b>${o.losses.sort((a, b) => (a.net - a.cost) - (b.net - b.cost)).slice(0, 12).map(x => `<button class="exrow" data-act="opentour" data-id="${x.t.id}"><span class="grow-l"><span class="num small muted">${esc(fmtDay(x.t.date))}</span> <b>${esc(aliasOf(x.t.title))}</b> <span class="muted small">${T('ppl_n', { n: x.t.pax || 0 })}</span></span><span class="num small">${T('mn_c_get')} ${nf(Math.round(x.net))} · ${T('mn_c_team')} ${nf(Math.round(x.cost))}</span><b class="num neg">${sign(x.net - x.cost, c)}</b></button>`).join('')}</div>` : ''}
        <div class="card f"><b>${T('mn_teamcost')}</b><div class="stats"><div class="stat"><b class="num">${money(o.guide, c)}</b>${T('mn_w_guides')}</div><div class="stat"><b class="num">${money(o.driver, c)}</b>${T('mn_w_drivers')}</div><div class="stat"><b class="num">${o.guests ? money(o.team / o.guests, c) : '—'}</b>${T('mn_per_guest')}</div><div class="stat"><b class="num">${o.net ? Math.round((o.cGuide + o.cDriver) / o.net * 100) + '%' : '—'}</b>${T('mn_of_get')}</div></div>
          ${ppl.slice(0, 12).map(([id, p]) => `<div class="mn-pr"><span class="row nw">${avatar(id)}<span>${esc(pname(id))}</span></span><span class="mn-wb"><i style="width:${Math.round(p.pay / pmx * 100)}%"></i></span><span class="num small">${money(p.pay, c)} · ${T('mn_tours_n', { n: p.tours })}</span></div>`).join('')}</div>
        <div class="card f"><b>${T('mn_plat')}</b><div class="tablewrap"><table><tr><th>${T('mn_c_src')}</th><th class="n">${T('mn_c_bks')}</th><th class="n">${T('guests')}</th><th class="n">${T('mn_w_paid')}</th><th class="n">${T('mn_w_fees')}</th><th class="n">%</th></tr>
          ${srcs.map(([s, x]) => `<tr><td>${esc(s)}</td><td class="n">${x.bks}</td><td class="n">${x.pax}</td><td class="n">${nf(Math.round(x.paid))}</td><td class="n">${nf(Math.round(x.fees))}</td><td class="n">${x.paid ? Math.round(x.fees / x.paid * 100) + '%' : '—'}</td></tr>`).join('') || `<tr><td colspan="6" class="muted">—</td></tr>`}</table></div></div>
        <div class="card f"><b>${T('mn_addons')}</b>${ADDONS.filter(k => o.addons[k]).map(k => { const a = o.addons[k]; return `<div class="row small mn-ad"><span class="grow-l"><b>${T('mark_' + k)}</b></span><span class="num">${T('mn_ad_n', { n: a.n, g: a.pax })}</span><b class="num">${addonPrice(k) ? '≈ ' + money(a.val, c) : `<span class="muted">${T('mn_ad_noprice')}</span>`}</b></div>`; }).join('') || `<span class="muted small">—</span>`}
          <span class="muted small">${T('mn_ad_note')}</span></div>`;
    }

    // ---------- Team ----------
    function teamRows(mo) { return crew().map(p => ({ p, L: ledger(p.id, mo) })).filter(x => x.L.months.some(m => m.tours || Object.keys(m.delta).length) || Math.abs(x.L.total) >= 0.5).sort((a, b) => b.L.total - a.L.total); }
    // Recent activity like a bank app: newest first, grouped by day, + money that comes to the person, − cash kept and payouts.
    function feedHtml(L, limit) {
      const all = []; L.months.forEach(x => all.push(...x.events)); all.sort((a, b) => b.date.localeCompare(a.date) || (a.k === 'paid' ? -1 : 1));
      const list = all.slice(0, limit || 40); let day = '';
      const rows = list.map(e => { const h = e.date !== day ? `<div class="mn-day">${esc(fmtDay(e.date))}</div>` : ''; day = e.date;
        return `${h}<div class="mn-tx k-${e.k}"><span class="mn-ti">${msi(e.icon)}</span><span class="grow-l"><b>${esc(e.label)}</b><span class="muted small">${esc(e.sub || '')}</span></span><b class="num ${e.v < 0 ? 'out' : 'in'}">${e.v > 0 ? '+' : '−'}${money(Math.abs(e.v), e.cur)}</b>${e.pid && isAdmin() ? `<button class="iconbtn" data-act="mndel" data-id="${e.pid}" aria-label="${T('delete')}">${msi('delete')}</button>` : ''}</div>`; }).join('');
      return `<div class="mn-feed">${rows || `<span class="muted">${T('mn_feed_none')}</span>`}</div>${all.length > list.length ? `<button class="btn sm" data-act="mnfeed">${T('mn_more', { n: all.length - list.length })}</button>` : ''}`;
    }
    // This month in three numbers (earned, cash kept, paid), under the balance.
    function monthChips(L) {
      const x = L.now; if (!x) return ''; const c = base(), sum = o => Object.entries(o).reduce((n, [k, v]) => n + (toBase(v, k, today()) || 0), 0);
      const earn = x.earned + sum(x.exp) + sum(x.gave), cash = sum(x.cash), paid = sum(x.paid);
      return `<div class="mn-chips"><span><small>${T('mn_ch_in')}</small><b class="num">+${money(earn, c)}</b></span><span><small>${T('mn_ch_cash')}</small><b class="num">−${money(cash, c)}</b></span><span><small>${T('mn_ch_paid')}</small><b class="num">−${money(paid, c)}</b></span></div>`;
    }
    // The balance card: total in USD, one "account" per currency, then quick buttons.
    function bankCard(id, L, mine) {
      const c = base(), owe = L.total < -0.5, accs = Object.entries(L.bal).filter(([, v]) => Math.abs(v) >= 0.5);
      return `<div class="mn-bank ${owe ? 'owe' : ''}"><span class="mn-bt">${T(mine ? 'mn_me_t' : 'mn_bal_of', { n: esc(pname(id)) })}</span><b class="mn-bn num">${owe ? '−' : ''}${nf(Math.round(Math.abs(L.total)))} <small>${esc(c)}</small></b>
        <span class="mn-bs">${owe ? T(mine ? 'mn_me_owe_s' : 'mn_owes_us_s') : L.total > 0.5 ? T(mine ? 'mn_me_get_s' : 'mn_we_owe_s') : T('mn_settled')}${L.lastPay ? ' · ' + T('mn_last', { d: esc(fmtDay(L.lastPay.paid_at)) }) : ''}</span>
        ${accs.length > 1 || (accs[0] && accs[0][0] !== c) ? `<div class="mn-accs">${accs.map(([k, v]) => `<span class="mn-acc"><small>${esc(k)}</small><b class="num">${v < 0 ? '−' : ''}${nf(Math.round(Math.abs(v)))}</b></span>`).join('')}</div>` : ''}
        ${monthChips(L)}</div>`;
    }
    function payForm(id, L, kind) {
      const c = base(), owed = Math.max(0, Math.round(L.total)), cash = cashOf(L), ck = Object.keys(cash)[0] || 'GEL';
      const amt = kind === 'gave' ? Math.round(cash[ck] || 0) : owed, cur = kind === 'gave' ? ck : c, mo = state.moneyMo || today().slice(0, 7);
      return `<form class="f mn-payf" data-form="mnpay"><input type="hidden" name="user_id" value="${id}"><input type="hidden" name="kind" value="${kind}"><input type="hidden" name="for_month" value="${mo}">
        <b>${T(kind === 'gave' ? 'mn_gave_t' : 'mn_pay_t', { n: esc(pname(id)), m: esc(moName(mo)) })}</b>
        <div class="two"><label>${T('m_amount')}<input class="inp" name="amount" type="number" step="any" min="0" inputmode="decimal" required value="${amt || ''}"></label><label>${T('currency')}<select class="inp" name="currency">${CURRENCIES.map(k => opt(k, k, cur)).join('')}</select></label></div>
        <div class="two"><label>${T('mn_how')}<select class="inp" name="method">${STAFF_METHODS.map(k => opt(k, T('mt_' + k), kind === 'gave' ? 'cash' : 'bank')).join('')}</select></label><label>${T('date')}<input class="inp" name="paid_at" type="date" value="${today()}" required></label></div>
        <label>${T('m_note')}<input class="inp" name="note" placeholder="${esc(T(kind === 'gave' ? 'mn_gave_ph' : 'mn_pay_ph'))}"></label>
        <div class="actions"><button type="button" class="btn" data-act="mnclose">${T('cancel')}</button><button class="btn primary">${T(kind === 'gave' ? 'mn_gave_btn' : 'mn_pay_btn')}</button></div></form>`;
    }
    function teamHtml(mo) {
      const rows = teamRows(mo), c = base(), owe = rows.reduce((n, x) => n + Math.max(0, x.L.total), 0), they = rows.reduce((n, x) => n + Math.min(0, x.L.total), 0);
      return `<p class="muted small">${T('mn_team_text', { c: esc(c) })}</p>
        <div class="stats"><div class="stat"><b class="num">${money(owe, c)}</b>${T('mn_t_owe')}</div>${they ? `<div class="stat"><b class="num">${money(-they, c)}</b>${T('mn_they_owe')}</div>` : ''}</div>
        <div class="mn-team">${rows.map(({ p, L }) => {
          const open = state.mnOpen === p.id, pay = state.mnPay && state.mnPay.id === p.id ? state.mnPay.kind : '', cash = cashOf(L);
          return `<div class="card f mn-person ${open ? 'open' : ''}"><button class="mn-ph" data-act="mnopen" data-id="${p.id}" aria-expanded="${open}"><span class="row nw">${avatar(p.id)}<span class="grow-l"><b>${esc(p.name)}</b><span class="muted small">${T('role_' + p.role)}${L.lastPay ? ' · ' + T('mn_last', { d: esc(fmtDay(L.lastPay.paid_at)) }) : ''}</span></span></span>
              <span class="mn-pb"><b class="num ${L.total < -0.5 ? 'neg' : ''}">${L.total < -0.5 ? T('mn_owes_us', { v: money(-L.total, c) }) : L.total > 0.5 ? money(L.total, c) : T('mn_settled')}</b><span class="small">${balLine(L.bal)}</span></span>${msi(open ? 'keyboard_arrow_up' : 'keyboard_arrow_down')}</button>
            ${Object.keys(cash).length ? `<span class="small muted">${msi('payments')}${T('mn_holds', { v: balLine(cash) })}</span>` : ''}
            ${isAdmin() && !pay ? `<div class="bar"><button class="btn sm primary" data-act="mnpay" data-id="${p.id}" data-k="pay">${msi('wallet')}${T('mn_pay_btn')}</button>${Object.keys(cash).length ? `<button class="btn sm" data-act="mnpay" data-id="${p.id}" data-k="gave">${msi('savings')}${T('mn_gave_btn')}</button>` : ''}<button class="btn sm" data-act="statement" data-id="${p.id}" data-m="${mo}">${msi('receipt_long')}${T('mn_statement')}</button></div>` : ''}
            ${pay ? payForm(p.id, L, pay) : ''}
            ${open ? `${bankCard(p.id, L)}${feedHtml(L, state.mnFeed ? 400 : 25)}` : ''}</div>`;
        }).join('') || `<p class="muted">${T('mn_team_none')}</p>`}</div>`;
    }

    // ---------- Guests and platforms ----------
    function guestsHtml(mo) {
      const from = mo + '-01', to = monthEnd(mo), td = today(), c = base(), o = agg(mo), tmap = toursById();
      const ts = db.tours.filter(t => live(t) && t.date >= from && t.date <= to && t.date <= td).sort((a, b) => b.date.localeCompare(a.date) || (a.start_time || '').localeCompare(b.start_time || ''));
      const need = []; ts.forEach(t => tourBookings(t.id).forEach(b => { if (!Number(b.price) || !b.payment) need.push(b); }));
      const plat = need.filter(b => !b.payment && sourceOf(b) && !NOT_PLATFORM.includes(srcName(sourceOf(b))));
      const shown = need.slice(0, state.mnMore ? 400 : 40);
      const owe = Object.entries(o.bySrc).filter(([s]) => !NOT_PLATFORM.includes(s) && s !== T('mn_src_none')).sort((a, b) => b[1].net - a[1].net);
      return `<div class="card f"><b>${T('mn_owe_plat')}</b>${owe.map(([s, x]) => `<div class="row small mn-ad"><span class="grow-l"><b>${esc(s)}</b> <span class="muted">${T('mn_c_bks')}: ${x.bks}</span></span><b class="num">${money(x.net, c)}</b></div>`).join('') || `<span class="muted small">—</span>`}<span class="muted small">${T('mn_owe_plat_note')}</span></div>
        <div class="card f"><div class="bar"><b>${T('mn_fix_t', { n: need.length })}</b><span class="spacer"></span>${plat.length && isAdmin() ? `<button class="btn sm primary" data-act="mnprepaid" data-n="${plat.length}">${T('mn_fix_plat', { n: plat.length })}</button>` : ''}</div>
          <span class="muted small">${T('mn_fix_text')}</span>
          <div class="mn-fix">${shown.map(b => { const t = tmap.get(b.tour_id) || {}, cur = b.currency || guestCur(); return `<div class="mn-fr"><span class="grow-l"><span class="num small muted">${esc(fmtDay(t.date || ''))}</span> <b>${esc(aliasOf(t.title || ''))}</b><span class="small"> · ${esc(shortName(b.guest) || '—')} · ${T('ppl_n', { n: b.pax || 0 })}${sourceOf(b) ? ' · ' + esc(srcName(sourceOf(b))) : ''}</span></span>
              <input class="inp mn-fp" id="mnp-${b.id}" type="number" step="any" min="0" inputmode="decimal" placeholder="${T('mn_price')}" value="${esc(b.price ?? '')}" aria-label="${T('mn_price')}"><select class="inp mn-fc" id="mnc-${b.id}" aria-label="${T('currency')}">${CURRENCIES.map(k => opt(k, k, cur)).join('')}</select>
              <select class="inp mn-fy" id="mny-${b.id}" aria-label="${T('mn_paytype')}"><option value="">${T('mn_paytype')}</option>${PAYS.map(k => opt(k, T('mn_py_' + k), b.payment || '')).join('')}</select><button class="iconbtn okbtn" data-act="mnbk" data-id="${b.id}" aria-label="${T('save')}">${msi('check')}</button></div>`; }).join('') || `<span class="muted">${T('mn_fix_none')}</span>`}</div>
          ${need.length > shown.length ? `<button class="btn sm" data-act="mnmore">${T('mn_more', { n: need.length - shown.length })}</button>` : ''}</div>`;
    }

    // ---------- Setup ----------
    function setupHtml() {
      const a = cfg().addons || {};
      return `<form class="card f" data-form="mnaddons"><b>${T('mn_ad_t')}</b><span class="muted small">${T('mn_ad_text')}</span>
          ${ADDONS.map(k => { const x = a[k] || {}; return `<div class="mn-adr"><span class="grow-l"><b>${T('mark_' + k)}</b></span><input class="inp" name="p_${k}" type="number" step="any" min="0" inputmode="decimal" value="${esc(x.price ?? '')}" aria-label="${T('mn_price')}"><select class="inp" name="c_${k}">${CURRENCIES.map(c => opt(c, c, x.cur || 'GEL')).join('')}</select><select class="inp" name="w_${k}">${opt('guest', T('mn_per_g'), x.per || 'guest')}${opt('booking', T('mn_per_b'), x.per || 'guest')}</select></div>`; }).join('')}
          <button class="btn primary">${T('save')}</button></form>
        <form class="card f" data-form="mncfg"><b>${T('mn_see_t')}</b><label class="swrow"><input type="checkbox" name="staffSee" ${cfg().staffSee ? 'checked' : ''}><span>${T('mn_see')}</span></label><span class="muted small">${T('mn_see_note')}</span><button class="btn">${T('save')}</button></form>
        <div class="card f commtable"><b>${T('m_comm')}</b><span class="muted small">${T('m_comm_table')}</span>
          <div class="ctab">${SOURCES.map(sc => `<form class="crow" data-form="mcommrow"><input type="hidden" name="platform" value="${esc(sc)}"><span class="cname"><b>${esc(sc)}</b></span><label class="cpct"><input class="inp" name="percent" type="number" step="any" min="0" max="100" inputmode="decimal" value="${esc(curPct(sc))}" aria-label="${esc(sc)} %"><span class="muted">%</span></label><button class="btn sm">${T('confirm')}</button></form>`).join('')}</div></div>
        <details class="sect"><summary>${T('m_comm_more')}</summary><div class="card f"><span class="muted small">${T('m_comm_text')}</span>
          <div class="list">${db.commission_rules.slice().sort((a, b) => a.platform.localeCompare(b.platform) || (a.tour_key || '').localeCompare(b.tour_key || '') || b.valid_from.localeCompare(a.valid_from)).map(x => `<div class="exrow"><span class="grow-l"><b>${esc(x.platform)}</b> <span class="num">${esc(String(x.percent))}%</span><span class="muted small"> · ${x.tour_key ? esc(x.tour_key) : T('m_all_tours')} · ${T('m_from')} ${esc(fmtDay(x.valid_from))}${x.note ? ' · ' + esc(x.note) : ''}</span></span><button class="iconbtn" data-act="mdel" data-t="commission_rules" data-id="${x.id}" aria-label="${T('delete')}">${msi('delete')}</button></div>`).join('') || `<span class="muted">${T('m_comm_old', { t: String(rules().commission ?? 'GetYourGuide 25') })}</span>`}</div>
          <form class="f" data-form="mcomm"><div class="bar"><select class="inp" name="platform" required>${SOURCES.map(s => opt(s, s, '')).join('')}</select><select class="inp" name="tour_key"><option value="">${T('m_all_tours')}</option>${[...new Set(db.tours.map(t => statKey(t.title)).filter(Boolean))].sort().map(k => opt(k, k, '')).join('')}</select><input class="inp" name="percent" type="number" step="any" min="0" max="100" placeholder="%" required style="max-width:90px"><input class="inp" name="valid_from" type="date" value="${today()}" required></div><input class="inp" name="note" placeholder="${T('m_note')}"><button class="btn primary">${T('m_save')}</button></form></div></details>`;
    }

    function moneyHtml() {
      const mo = state.moneyMo || today().slice(0, 7), tab = state.mnTab || 'ov';
      const tabs = [['ov', 'balance', 'mn_tab_ov'], ['team', 'groups', 'mn_tab_team'], ['pay', 'wallet', 'mn_tab_pay'], ['guests', 'receipt_long', 'mn_tab_guests'], ['setup', 'settings', 'mn_tab_setup']];
      return `<div class="mn"><div class="bar mn-top"><div class="seg">${tabs.map(([k, ic, l]) => `<button data-act="mntab" data-v="${k}" aria-pressed="${tab === k}">${msi(ic)}${T(l)}${k === 'pay' && db.pay_disputes.some(q => q.status === 'open') ? ` <span class="badge">${db.pay_disputes.filter(q => q.status === 'open').length}</span>` : ''}</button>`).join('')}</div>
          ${tab !== 'setup' && tab !== 'pay' ? `<div class="seg"><button data-act="mmo" data-d="-1" aria-label="${T('prev')}">‹</button><button disabled>${esc(moName(mo))}</button><button data-act="mmo" data-d="1" aria-label="${T('next')}">›</button></div>` : ''}</div>
        ${tab === 'team' ? teamHtml(mo) : tab === 'pay' ? `<div class="mn-pay">${salaryHtml()}</div>` : tab === 'guests' ? guestsHtml(mo) : tab === 'setup' ? setupHtml() : overviewHtml(mo)}</div>`;
    }

    // Me > Pay: the person's own balance. Shown when the office has switched it on in Setup (the admin also sees it in "View as").
    function myMoneyHtml(id, mo) {
      if (!cfg().staffSee && !state.viewAs) return '';
      const L = ledger(id, mo || today().slice(0, 7)); if (!L.months.length) return '';
      return `<div class="mn-mine">${bankCard(id, L, true)}<div class="mn-qa"><button class="btn" data-act="expnew">${msi('receipt_long')}${T('ex_add')}</button><button class="btn" data-act="mnhow">${T('mn_me_how')}</button></div>
        ${state.mnHow ? `<div class="card f small">${T('mn_me_how_text', { c: esc(base()) })}</div>` : ''}
        <div class="card f"><b>${T('mn_feed')}</b>${feedHtml(L, state.mnFeed ? 400 : 20)}</div></div>`;
    }

    const acts = {
      mmo(el) { const mo = state.moneyMo || today().slice(0, 7); state.moneyMo = moShift(mo, Number(el.dataset.d)); state.mnPay = null; render(); },
      mngo(el) { state.moneyMo = el.dataset.v; render(); },
      mntab(el) { state.mnTab = el.dataset.v; state.mnPay = null; render(); window.scrollTo(0, 0); },
      mnopen(el) { state.mnOpen = state.mnOpen === el.dataset.id ? '' : el.dataset.id; render(); },
      mnpay(el) { if (!isAdmin()) return; state.mnPay = { id: el.dataset.id, kind: el.dataset.k }; render(); },
      mnclose() { state.mnPay = null; render(); },
      mnmore() { state.mnMore = 1; render(); },
      mnfeed() { state.mnFeed = 1; render(); },
      mnhow() { state.mnHow = !state.mnHow; render(); },
      mndel(el) { if (!isAdmin() || !confirm(T('m_del_ask'))) return; run(() => S.remove('staff_payments', el.dataset.id)).then(() => { setMemo({}); render(); }); },
      mdel(el) { if (!isAdmin() || !confirm(T('m_del_ask'))) return; run(() => S.remove(el.dataset.t, el.dataset.id)).then(() => { setMemo({}); render(); }); },
      async mnbk(el) {
        const b = db.bookings.find(x => x.id === el.dataset.id); if (!b || !isAdmin()) return;
        const p = document.getElementById('mnp-' + b.id), c = document.getElementById('mnc-' + b.id), y = document.getElementById('mny-' + b.id);
        const price = p && p.value !== '' ? Number(String(p.value).replace(',', '.')) : null;
        await run(() => S.save('bookings', { ...b, price: price === null || isNaN(price) ? b.price : price, currency: (c && c.value) || b.currency, payment: (y && y.value) || b.payment || null }), T('saved'));
        setMemo({}); render();
      },
      async mnprepaid(el) {
        if (!isAdmin() || !confirm(T('mn_fix_ask', { n: el.dataset.n }))) return;
        const mo = state.moneyMo || today().slice(0, 7), from = mo + '-01', to = monthEnd(mo), td = today(), rows = [];
        db.tours.filter(t => live(t) && t.date >= from && t.date <= to && t.date <= td).forEach(t => tourBookings(t.id).forEach(b => { if (!b.payment && sourceOf(b) && !NOT_PLATFORM.includes(srcName(sourceOf(b)))) rows.push({ ...b, payment: 'prepaid' }); }));
        await run(() => S.saveMany('bookings', rows), T('saved')); logAct(`Money: ${rows.length} platform bookings set to paid online (${mo})`); setMemo({}); render();
      },
      // An expense paid back on its own (outside a monthly payout) is a payout of that amount, so the balance stays right.
      async mnexppaid(el) {
        const x = (db.expenses || []).find(y => y.id === el.dataset.id); if (!x || !isAdmin()) return;
        const rate = gelRate(x.currency, today());
        await run(async () => { await S.save('staff_payments', { id: S.uid(), user_id: x.user_id, payee_name: null, amount: Number(x.amount) || 0, currency: x.currency || 'GEL', gel_rate: rate || null, gel_amount: rate ? r2((Number(x.amount) || 0) * rate) : null, method: 'cash', bank: null, tx_code: null, paid_at: today(), for_month: x.date.slice(0, 7), note: T('mn_exp_back'), created_by: me().id, created_at: new Date().toISOString() }); await S.save('expenses', { ...x, paid_back: true }); }, T('saved'));
        setMemo({}); render();
      },
    };
    const forms = {
      async mnpay(fd) {
        const who = fd.get('user_id'), kind = fd.get('kind'), cur = fd.get('currency') || base(), date = fd.get('paid_at') || today(), amount = Math.abs(Number(String(fd.get('amount') || '').replace(',', '.')) || 0), rate = gelRate(cur, date), mo = fd.get('for_month') || date.slice(0, 7);
        if (!amount) { toast(T('m_amount')); return; }
        const v = kind === 'gave' ? -amount : amount;
        await S.save('staff_payments', { id: S.uid(), user_id: who, payee_name: null, amount: v, currency: cur, gel_rate: rate || null, gel_amount: rate ? r2(v * rate) : null, method: fd.get('method') || 'bank', bank: null, tx_code: null, paid_at: date, for_month: mo, note: String(fd.get('note') || '').trim() || (kind === 'gave' ? T('mn_gave_ph') : null), created_by: me().id, created_at: new Date().toISOString() });
        setMemo({});
        if (kind !== 'gave' && ledger(who, mo).total <= 0.5) { const open = (db.expenses || []).filter(e => e.user_id === who && !e.paid_back && e.date.slice(0, 7) <= mo).map(e => ({ ...e, paid_back: true })); if (open.length) await S.saveMany('expenses', open); }
        logAct(`Money: ${kind === 'gave' ? 'cash from' : 'paid'} ${pname(who)} ${amount} ${cur} for ${mo}`); state.mnPay = null; setMemo({}); toast(T('saved')); render();
      },
      async mnaddons(fd) {
        const addons = {}; ADDONS.forEach(k => { const p = Number(String(fd.get('p_' + k) || '').replace(',', '.')) || 0; if (p > 0) addons[k] = { price: p, cur: fd.get('c_' + k) || 'GEL', per: fd.get('w_' + k) || 'guest' }; });
        await S.save('settings', { id: 'money', value: { ...cfg(), addons } }); setMemo({}); logAct('Money: add-on prices'); toast(T('saved')); render();
      },
      async mncfg(fd) { await S.save('settings', { id: 'money', value: { ...cfg(), staffSee: fd.get('staffSee') === 'on' } }); toast(T('saved')); render(); },
      async mcommrow(fd) {
        const pl = fd.get('platform'), pc = Math.min(90, Math.max(0, Number(fd.get('percent')) || 0)); if (pc === curPct(pl)) { toast(T('saved')); return; }
        const same = (db.commission_rules || []).find(x => srcName(x.platform) === srcName(pl) && !x.tour_key && x.valid_from === today());
        await S.save('commission_rules', same ? { ...same, percent: pc } : { id: S.uid(), platform: pl, tour_key: null, percent: pc, valid_from: today(), note: null, created_by: me().id, created_at: new Date().toISOString() });
        setMemo({}); logAct(`Commission ${pl} ${pc}% from today`); toast(T('saved')); render();
      },
      async mcomm(fd) {
        await S.save('commission_rules', { id: S.uid(), platform: fd.get('platform'), tour_key: fd.get('tour_key') || null, percent: Number(fd.get('percent')) || 0, valid_from: fd.get('valid_from') || today(), note: fd.get('note') || null, created_by: me().id, created_at: new Date().toISOString() });
        setMemo({}); logAct(`Commission rule ${fd.get('platform')} ${fd.get('percent')}%`); render();
      },
    };
    return { moneyHtml, myMoneyHtml, ruleCommission, agg, ledger, acts, forms };
  };
})();
