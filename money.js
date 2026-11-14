// Friendly Schedule: Money (admin only). Commission rules, payments in, payments to staff, missing payments.
// Loaded before app.js; app.js calls window.FSMoney({...helpers}) once and gets back what it needs.
(function () {
  'use strict';
  window.FSMoney = function (d) {
    const { getMemo, setMemo, db, state, S, T, me, isAdmin, run, toast, logAct, render, msi, esc, nf, fmt, fmtDay, today, iso, opt, crew, pname, rules, rateOf, fxOn, manualRate, statKey, aliasOf, srcName, sourceOf, netOf, guestCur, live, statement, CURRENCIES, SOURCES } = d;
  const PAY_KINDS = ['tour', 'addon', 'tip', 'refund'], PAY_METHODS = ['cash', 'card', 'online', 'platform'], STAFF_METHODS = ['cash', 'card', 'bank'];
  const gelRate = (cur, date) => (!cur || cur === 'GEL' ? 1 : (fxOn(cur, date || today()) || manualRate(cur) || 0));
  const toursById = () => { const m = getMemo(); return m.tmapN === db.tours.length ? m.tmap : (m.tmapN = db.tours.length, m.tmap = new Map(db.tours.map(t => [t.id, t]))); };
  // The commission of one booking: a rule for this tour wins, then a rule for the platform (newest "valid from" before the tour day), then the old text in Rules.
  function ruleCommission(b) {
    const rs = db.commission_rules; if (!rs || !rs.length) return null;
    const src = srcName(sourceOf(b) || b.source), t = toursById().get(b.tour_id); if (!src || !t) return null;
    const key = statKey(t.title), pick = list => list.filter(x => x.valid_from <= t.date).sort((x, y) => y.valid_from.localeCompare(x.valid_from))[0];
    const mine = rs.filter(x => srcName(x.platform) === src), one = pick(mine.filter(x => x.tour_key && x.tour_key === key)) || pick(mine.filter(x => !x.tour_key));
    return one ? Math.min(90, Number(one.percent) || 0) : null;
  }
  const payGel = x => (x.gel_amount != null && x.gel_amount !== '' ? Number(x.gel_amount) : (Number(x.amount) || 0) * gelRate(x.currency, x.paid_at)) * (x.kind === 'refund' ? -1 : 1);
  function moneyRows(mo) {
    const recBy = {}; db.payments.forEach(p => { const tid = p.tour_id || (db.bookings.find(b => b.id === p.booking_id) || {}).tour_id; if (tid) recBy[tid] = (recBy[tid] || 0) + payGel(p); });
    const bkBy = {}; db.bookings.forEach(b => { (bkBy[b.tour_id] = bkBy[b.tour_id] || []).push(b); });
    return db.tours.filter(t => live(t) && t.date.slice(0, 7) === mo).sort((a, b) => a.date.localeCompare(b.date) || (a.start_time || '').localeCompare(b.start_time || '')).map(t => {
      const bs = (bkBy[t.id] || []).filter(b => b.attendance !== 'cancelled'), exp = bs.reduce((n, b) => n + netOf(b) * gelRate(b.currency || guestCur(), t.date), 0), rec = recBy[t.id] || 0, pax = bs.reduce((n, b) => n + (Number(b.pax) || 0), 0);
      return { t, exp: Math.round(exp), rec: Math.round(rec), left: Math.round(exp - rec), pax, miss: t.date <= today() && exp > 0 && exp - rec > 1 };
    });
  }
  function moneyHtml() {
    const mo = state.moneyMo || today().slice(0, 7), rows = moneyRows(mo), miss = rows.filter(x => x.miss), sum = k => rows.reduce((n, x) => n + x[k], 0);
    const inMo = x => (x.paid_at || '').slice(0, 7) === mo, outs = db.staff_payments.filter(x => x.for_month === mo || (!x.for_month && inMo(x))), outSum = outs.reduce((n, x) => n + payGel(x), 0);
    const people = crew(), earnedOf = id => statement(id, mo).total * (rateOf(rules().currency || 'GEL', mo + '-15') ? gelRate(rules().currency || 'GEL', mo + '-15') : 1);
    const earned = people.reduce((n, p) => n + earnedOf(p.id), 0), tid = state.moneyTour || '';
    const tags = x => esc([T('mt_' + x.method), x.bank, x.tx_code].filter(Boolean).join(' · '));
    const del = (t, id) => `<button class="iconbtn" data-act="mdel" data-t="${t}" data-id="${id}" aria-label="${T('delete')}">${msi('delete')}</button>`;
    const cur = (name, v) => `<select class="inp" name="${name}">${CURRENCIES.map(c => opt(c, c, v || 'GEL')).join('')}</select>`;
    const money = v => `${nf(Math.round(v))} GEL`;
    return `<div class="bar"><div class="seg"><button data-act="mmo" data-d="-1">‹</button><button disabled>${esc(fmt(mo + '-01', { month: 'long', year: 'numeric' }))}</button><button data-act="mmo" data-d="1">›</button></div></div>
      <div class="tsum num"><div>${T('m_exp')}: <b>${money(sum('exp'))}</b> · ${T('m_rec')}: <b>${money(sum('rec'))}</b></div><div>${T('m_staff_earned')}: <b>${money(earned)}</b> · ${T('m_staff_paid')}: <b>${money(outSum)}</b></div></div>
      <div class="card f"><b>${T('m_missing')}</b>${miss.length ? `<div class="tablewrap"><table><tr><th>${T('m_date')}</th><th>${T('m_tour')}</th><th class="n">${T('m_exp')}</th><th class="n">${T('m_rec')}</th><th class="n">${T('m_balance')}</th><th></th></tr>${miss.map(x => `<tr><td>${esc(fmtDay(x.t.date))}</td><td>${esc(aliasOf(x.t.title))}</td><td class="n">${nf(x.exp)}</td><td class="n">${nf(x.rec)}</td><td class="n"><b>${nf(x.left)}</b></td><td><button class="btn sm" data-act="mpaytour" data-id="${x.t.id}">+</button></td></tr>`).join('')}</table></div>` : `<span class="muted">${T('m_none_missing')}</span>`}</div>
      <div class="card f"><b>${T('m_add_pay')}</b><form class="f" data-form="mpay" id="m-pay"><label>${T('m_tour')}<select class="inp" name="tour_id" required><option value="">—</option>${rows.map(x => opt(x.t.id, `${fmtDay(x.t.date)} · ${aliasOf(x.t.title)}`, tid)).join('')}</select></label>
        <div class="bar"><select class="inp" name="kind">${PAY_KINDS.map(k => opt(k, T('k_' + k), 'tour')).join('')}</select><input class="inp" name="amount" type="number" step="any" placeholder="${T('m_amount')}" required style="max-width:120px">${cur('currency')}<select class="inp" name="method">${PAY_METHODS.map(k => opt(k, T('mt_' + k), 'cash')).join('')}</select></div>
        <div class="bar"><input class="inp" name="bank" placeholder="${T('m_bank')}" style="max-width:160px"><input class="inp" name="tx_code" placeholder="${T('m_code')}" style="max-width:180px"><input class="inp" name="paid_at" type="date" value="${today()}" required><input class="inp" name="gel_rate" type="number" step="any" placeholder="${T('m_rate')}" style="max-width:170px"></div>
        <input class="inp" name="note" placeholder="${T('m_note')}"><button class="btn primary">${T('m_save')}</button></form></div>
      <div class="card f"><b>${T('m_in_list')}</b><div class="list">${db.payments.filter(inMo).sort((a, b) => b.paid_at.localeCompare(a.paid_at)).map(x => { const t = toursById().get(x.tour_id); return `<div class="exrow"><span class="grow-l"><b class="num">${esc(nf(Number(x.amount) || 0))} ${esc(x.currency)}</b>${x.currency !== 'GEL' ? ` <span class="muted small num">(${money(payGel(x))})</span>` : ''}<span class="muted small"> · ${T('k_' + x.kind)} · ${esc(fmtDay(x.paid_at))}${t ? ' · ' + esc(aliasOf(t.title)) : ''} · ${tags(x)}${x.note ? ' · ' + esc(x.note) : ''}</span></span>${del('payments', x.id)}</div>`; }).join('') || `<span class="muted">—</span>`}</div></div>
      <div class="card f"><b>${T('m_add_staff')}</b><form class="f" data-form="mstaff"><div class="bar"><select class="inp" name="user_id">${people.map(p => opt(p.id, p.name, '')).join('')}<option value="">${T('m_other')}</option></select><input class="inp" name="payee_name" placeholder="${T('m_payee')}" style="max-width:170px"><input class="inp" name="amount" type="number" step="any" placeholder="${T('m_amount')}" required style="max-width:120px">${cur('currency')}<select class="inp" name="method">${STAFF_METHODS.map(k => opt(k, T('mt_' + k), 'bank')).join('')}</select></div>
        <div class="bar"><input class="inp" name="bank" placeholder="${T('m_bank')}" style="max-width:160px"><input class="inp" name="tx_code" placeholder="${T('m_code')}" style="max-width:180px"><input class="inp" name="paid_at" type="date" value="${today()}" required><input class="inp" name="for_month" type="month" value="${mo}" required><input class="inp" name="gel_rate" type="number" step="any" placeholder="${T('m_rate')}" style="max-width:170px"></div>
        <input class="inp" name="note" placeholder="${T('m_note')}"><button class="btn primary">${T('m_save')}</button></form></div>
      <div class="card f"><b>${T('m_staff_bal')}</b><div class="tablewrap"><table><tr><th>${T('name')}</th><th class="n">${T('m_staff_earned')}</th><th class="n">${T('m_staff_paid')}</th><th class="n">${T('m_open')}</th></tr>${people.map(p => { const e = earnedOf(p.id), o = outs.filter(x => x.user_id === p.id).reduce((n, x) => n + payGel(x), 0); return e || o ? `<tr><td>${esc(p.name)}</td><td class="n">${nf(Math.round(e))}</td><td class="n">${nf(Math.round(o))}</td><td class="n"><b>${nf(Math.round(e - o))}</b></td></tr>` : ''; }).join('')}</table></div>
        <div class="list">${outs.sort((a, b) => b.paid_at.localeCompare(a.paid_at)).map(x => `<div class="exrow"><span class="grow-l"><b>${esc(x.user_id ? pname(x.user_id) : (x.payee_name || '—'))}</b> <span class="num">${esc(nf(Number(x.amount) || 0))} ${esc(x.currency)}</span>${x.currency !== 'GEL' ? ` <span class="muted small num">(${money(payGel(x))})</span>` : ''}<span class="muted small"> · ${esc(fmtDay(x.paid_at))} · ${tags(x)}${x.note ? ' · ' + esc(x.note) : ''}</span></span>${del('staff_payments', x.id)}</div>`).join('')}</div></div>
      <div class="card f"><b>${T('m_comm')}</b><span class="muted small">${T('m_comm_text')}</span>
        <div class="list">${db.commission_rules.slice().sort((a, b) => a.platform.localeCompare(b.platform) || (a.tour_key || '').localeCompare(b.tour_key || '') || b.valid_from.localeCompare(a.valid_from)).map(x => `<div class="exrow"><span class="grow-l"><b>${esc(x.platform)}</b> <span class="num">${esc(String(x.percent))}%</span><span class="muted small"> · ${x.tour_key ? esc(x.tour_key) : T('m_all_tours')} · ${T('m_from')} ${esc(fmtDay(x.valid_from))}${x.note ? ' · ' + esc(x.note) : ''}</span></span>${del('commission_rules', x.id)}</div>`).join('') || `<span class="muted">${T('m_comm_old', { t: String(rules().commission ?? 'GetYourGuide 25') })}</span>`}</div>
        <form class="f" data-form="mcomm"><div class="bar"><select class="inp" name="platform" required>${SOURCES.map(s => opt(s, s, '')).join('')}</select><select class="inp" name="tour_key"><option value="">${T('m_all_tours')}</option>${[...new Set(db.tours.map(t => statKey(t.title)).filter(Boolean))].sort().map(k => opt(k, k, '')).join('')}</select><input class="inp" name="percent" type="number" step="any" min="0" max="100" placeholder="%" required style="max-width:90px"><input class="inp" name="valid_from" type="date" value="${today()}" required></div><input class="inp" name="note" placeholder="${T('m_note')}"><button class="btn primary">${T('m_save')}</button></form></div>`;
  }
    const acts = {
    mmo(el) { const mo = state.moneyMo || today().slice(0, 7), d = new Date(Number(mo.slice(0, 4)), Number(mo.slice(5, 7)) - 1 + Number(el.dataset.d), 1); state.moneyMo = iso(d).slice(0, 7); render(); },
    mpaytour(el) { state.moneyTour = el.dataset.id; render(); setTimeout(() => { const f = document.getElementById('m-pay'); if (f) f.scrollIntoView({ block: 'center' }); }, 50); },
    mdel(el) { if (!isAdmin() || !confirm(T('m_del_ask'))) return; run(() => S.remove(el.dataset.t, el.dataset.id)).then(render); },
    };
    const forms = {
    async mpay(fd) {
      const cur = fd.get('currency') || 'GEL', date = fd.get('paid_at') || today(), amount = Number(fd.get('amount')) || 0, rate = Number(fd.get('gel_rate')) || gelRate(cur, date);
      if (!amount || !rate) { toast(T('m_no_rate')); return; }
      await S.save('payments', { id: S.uid(), booking_id: null, tour_id: fd.get('tour_id') || null, kind: fd.get('kind') || 'tour', amount, currency: cur, gel_rate: rate, gel_amount: Math.round(amount * rate * 100) / 100, method: fd.get('method') || 'cash', bank: fd.get('bank') || null, tx_code: fd.get('tx_code') || null, received_by: null, paid_at: date, note: fd.get('note') || null, created_by: me().id, created_at: new Date().toISOString() });
      state.moneyTour = ''; logAct(`Payment in ${amount} ${cur}`); render();
    },
    async mstaff(fd) {
      const cur = fd.get('currency') || 'GEL', date = fd.get('paid_at') || today(), amount = Number(fd.get('amount')) || 0, rate = Number(fd.get('gel_rate')) || gelRate(cur, date);
      if (!amount || !rate) { toast(T('m_no_rate')); return; }
      const who = fd.get('user_id') || null, payee = String(fd.get('payee_name') || '').trim(); if (!who && !payee) { toast(T('m_payee')); return; }
      await S.save('staff_payments', { id: S.uid(), user_id: who, payee_name: who ? null : payee, amount, currency: cur, gel_rate: rate, gel_amount: Math.round(amount * rate * 100) / 100, method: fd.get('method') || 'bank', bank: fd.get('bank') || null, tx_code: fd.get('tx_code') || null, paid_at: date, for_month: fd.get('for_month') || date.slice(0, 7), note: fd.get('note') || null, created_by: me().id, created_at: new Date().toISOString() });
      logAct(`Payment to ${who ? pname(who) : payee}: ${amount} ${cur}`); render();
    },
    async mcomm(fd) {
      await S.save('commission_rules', { id: S.uid(), platform: fd.get('platform'), tour_key: fd.get('tour_key') || null, percent: Number(fd.get('percent')) || 0, valid_from: fd.get('valid_from') || today(), note: fd.get('note') || null, created_by: me().id, created_at: new Date().toISOString() });
      setMemo({}); logAct(`Commission rule ${fd.get('platform')} ${fd.get('percent')}%`); render();
    },
    };
    return { moneyHtml, ruleCommission, acts, forms };
  };
})();
