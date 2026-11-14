// Friendly Schedule: reads pasted booking and review e-mails (10 platforms). Pure text work, no screen code.
// Loaded before app.js; app.js calls window.FSParse({ normPhone, parseWhen, LANG_CODES }) and gets the readers back.
(function () {
  'use strict';
  window.FSParse = function (deps) {
    const { normPhone, parseWhen, LANG_CODES } = deps;
    function mailText(raw) {
      let t = String(raw || '').replace(/\r\n?/g, '\n');
      const subj = (t.match(/^Subject:\s*([^\n]+)/im) || [])[1] || '';
      if (/^Content-Transfer-Encoding:\s*quoted-printable/im.test(t) || /=3D["']/.test(t)) {
        t = t.replace(/=\n/g, ''); const bytes = []; for (let i = 0; i < t.length; i++) { const h = t[i] === '=' ? t.slice(i + 1, i + 3) : ''; if (/^[0-9A-F]{2}$/i.test(h)) { bytes.push(parseInt(h, 16)); i += 2; } else { const c = t.charCodeAt(i); if (c < 128) bytes.push(c); else bytes.push(...new TextEncoder().encode(t[i])); } }
        try { t = new TextDecoder('utf-8').decode(new Uint8Array(bytes)); } catch (e) { /* keep as is */ }
      }
      if (/<(html|body|div|table|p|br)\b/i.test(t)) {
        const at = t.search(/<(!doctype|html)\b/i); if (at > 0) t = t.slice(at);
        t = t.replace(/<(head|style|script)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<(br|\/div|\/p|\/tr|\/td|\/h\d|\/li|\/span|\/b)\b[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&mdash;|&ndash;/gi, '-').replace(/&quot;/gi, '"').replace(/&#0?39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n));
        t = t.split('\n').map(x => x.trim()).filter(Boolean).join('\n'); if (subj) t = 'Subject: ' + subj + '\n' + t;
      }
      return t;
    }
    function parseBooking(raw) {
      const t = mailText(raw).replace(/\[[^\]]*\]\([^)]*\)/g, ' ').replace(/https?:\/\/\S+/g, ' ').replace(/\|/g, '\n').replace(/[ \t\u00a0]+/g, ' ').replace(/\n\s*\n+/g, '\n').replace(/^\s*(ticket-booking|calendar|users|single-person|globe|pin|currency)\s*$/gim, '').replace(/^(Booking time|Booking notification sent|Booked (?:at|on)|Please confirm the booking before)[^\n]*\n?[^\n]*$/gim, '').replace(/\n\s*([AaPp]\.?[Mm]\.?)(?=\s*(?:\n|$))/g, ' $1');
      const get = re => { const m = t.match(re); return m ? m[1].trim() : ''; };
      const src = /get\s?your\s?guide|\bGYG[A-Z0-9]{8,}\b/i.test(t) ? 'GetYourGuide' : /viator|tripadvisor/i.test(t) ? 'Viator' : /klook/i.test(t) ? 'Klook' : /trip\.com|ctrip|VBK system/i.test(t) ? 'Trip.com' : /airbnb|booked your experience|Hosted by/i.test(t) ? 'Airbnb' : /civitatis/i.test(t) ? 'Civitatis' : /freetour/i.test(t) ? 'FreeTour' : /tourradar/i.test(t) ? 'TourRadar' : /trekksoft/i.test(t) ? 'Website' : '';
      let ref = get(/\b(GYG[A-Z0-9]{8,})\b/) || get(/\b(BR-[0-9A-Z]{6,})\b/) || get(/\b(\d{4,6}-\d{12,14}-[A-Z0-9]{3,})\b/) || get(/Booking reference ID\s*:?\s*([A-Z0-9-]{5,})/i) || get(/Confirmation code\s*:?\s*([A-Z0-9]{6,})/i) || get(/(?:RESERVATION|BOOKING) NUMBER\s*:?\s*([A-Z0-9-]{5,})/i) || get(/(?:Booking (?:Reference\b|ID\b|number\b|No\b\.?|code\b)|Reference (?:number\b|no\b\.?)|Order (?:number\b|ID\b|No\b\.?)|Confirmation (?:number|code)|Voucher (?:number|code))\s*[:#]?\s*#?\s*([A-Z0-9][A-Z0-9-]{4,})/i) || get(/basket\s*#\s*(\d{5,}[A-Z0-9]*)/i) || get(/New order[^\n]*\n\s*#(\d{5,}[A-Z0-9]*)/i) || get(/(?:Ctrip )?order No\.?\s*:?\s*(\d{9,}[A-Z]*)/i) || get(/Booking Request\s*#(\d{4,}[A-Z0-9]*)/i) || get(/order[^#\n]{0,80}#\s?(\d{6,})/i);
      if (src === 'Viator' && /^\d{6,}[A-Z]*$/.test(ref)) ref = 'BR-' + ref;   // "Tripadvisor Experiences" mails drop the BR- prefix; the saved booking has it
      let title = get(/following booking has\s+(?:changed|been (?:cancell?ed|updated|amended))\.?\s*\n(?!\s*Reference)([^\n]{6,160})/i) || get(/following booking for (.+?) on (?:[A-Z][a-z]{2}, )?[A-Z][a-z]{2} \d{1,2}, \d{4}/) || get(/\n\s*(?:Canceled|Cancelled)\s*\n([^\n]{6,160})/) || get(/Customer:[^\n]*? Tour:\s*(.+?)\s+Date:/) || get(/(?:^|\n)\s*(?:Tour Name|Activity name|Product name|ACTIVITY|Tour|Product)\s*:[ \t]*\n?[ \t]*([^\n]+)/i) || get(/\n([^\n]{8,200})\n\s*Reference number\b/i) || get(/\n([^\n]{8,200})\n\s*Package\s*:/i) || get(/Tour Grade Description\s*:\s*([^\n]+)/i) || get(/^([^\n]{6,140}?) (?:Edited )?Tour Reservation (?:Previous )?Date of the Tour/m) || get(/booking\s*\(#[^)]*\)\s*for\s+(.+?)(?=\s+at \d{1,2}:\d{2}\s*[AP]M on|\s+Date of|\s*$)/i) || get(/\d+(?:&nbsp;|\s)*day tour\s*\n([^\n]+)/i) || get(/(?:^|\n)([^\n:]{6,120})\n\s*Tour Reservation\b/i) || get(/Booked product\s*\n\s*([^\n]+)/i) || get(/has been booked:?\s*\n\s*([^\n]+)/i) || get(/new reservation for ([^.\n]+)/i) || get(/order for (.+?) and issued/i) || get(/\n([^\n]+)\n\s*Hosted by/i) || get(/(?:Activity|Product|Experience)\s*:\s*([^\n]+)/i);
      title = title.replace(/\s+Reference number.*$/i, '').replace(/^\d{5,}-/, '').replace(/\t.*$/, '').trim();
      // GetYourGuide change mail: "Date  New" then the new date, then the old date struck through. The first date is the one that counts; the second is what it was.
      const dm = t.match(/(?:^|\n)\s*Date\s*\n\s*(?:New\s*\n\s*)?([^\n]*\d{4}[^\n]*)(?:\n\s*([^\n]*\d{4}[^\n]*))?/i), was = dm && dm[2] && parseWhen(dm[2]).date ? parseWhen(dm[2]) : null;
      let when = dm && parseWhen(dm[1]).date ? parseWhen(dm[1]) : parseWhen(get(/(?:Travel Date|Activity Date|Tour date|Date of (?:the )?(?:tour|activity|use)|Departure date|Date Request|Date and time)\s*:?\s*([^\n]+)/i) || get(/\bDate\s*:?\s*([^\n]+)/i) || get(/\bon (\d{4}-\d{2}-\d{2})\b/));
      if (!when.time) when.time = parseWhen(get(/(?:Tour Grade|Start time|Time|Hour|Option)\s*:?\s*([^\n]*\d{1,2}:\d{2}[^\n]*)/i)).time || parseWhen(get(/\bat (\d{1,2}:\d{2}\s*[AP]M) on \d{4}-/i)).time;
      // FreeTour change: "Previous Date of the Tour: ... New Date of the Tour: ..."; Klook change: "Date Request: <new> <old>".
      let was2 = was;
      const nd = parseWhen(get(/New Date of the Tour\s*:\s*([^\n]*)/i)), pd = parseWhen(get(/Previous Date of the Tour\s*:\s*([^\n]*)/i));
      if (nd.date) { when = nd; if (pd.date) was2 = pd; }
      else { const kd = t.match(/Date Request\s*:?\s*(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2})/i); if (kd) { when = Object.assign({}, when, { date: kd[1] }); was2 = { date: kd[2], time: '' }; } }
      // No year in the mail (Airbnb: "Thursday, November 12", "10:30 AM"): take the year in which that weekday fits, nearest to today. No weekday-and-date line (TourRadar "Friday, 25 Sep 2026") is read as a plain date.
      if (!when.date) {
        const wd = t.match(/\b(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day,?\s+(?:([A-Z][a-z]+)\s+(\d{1,2})|(\d{1,2})\s+([A-Z][a-z]+))(?:,?\s*(\d{4}))?/);
        if (wd) {
          const mon = String(wd[2] || wd[5]).slice(0, 3).toLowerCase(), mi = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(mon), dd = Number(wd[3] || wd[4]), wi = ['Sun', 'Mon', 'Tues', 'Wednes', 'Thurs', 'Fri', 'Satur'].indexOf(wd[1]);
          if (mi >= 0 && dd >= 1 && dd <= 31) {
            const ty = new Date().getFullYear(), ys = wd[6] ? [Number(wd[6])] : [ty - 1, ty, ty + 1].filter(y => new Date(y, mi, dd).getDay() === wi).sort((a, b) => Math.abs(new Date(a, mi, dd) - Date.now()) - Math.abs(new Date(b, mi, dd) - Date.now()));
            if (ys[0]) {
              when = Object.assign({}, when, { date: `${ys[0]}-${String(mi + 1).padStart(2, '0')}-${String(dd).padStart(2, '0')}` });
              if (!when.time) { const tm = t.slice(wd.index).match(/\b(\d{1,2}):(\d{2})\s*([AaPp][Mm])?/); if (tm) { let h = Number(tm[1]); if (/p/i.test(tm[3] || '') && h < 12) h += 12; if (/a/i.test(tm[3] || '') && h === 12) h = 0; when.time = `${String(h).padStart(2, '0')}:${tm[2]}`; } }
            }
          }
        }
      }
      let guest = get(/Lead travell?er(?: name)?\s*:?\s*([^\n]+)/i) || get(/(?:Booking Name|Lead participant|Main customer|Customer name|Customer(?=\s*:)|Contact (?:name|person)|Guest name|Booked by)\s*:?\s*([^\n]+)/i) || get(/^\s*([^\n]{2,40}?) booked your experience/im) || get(/^\s*([^\n]{2,40}?) (?:CANCELED|CANCELLED|RESCHEDULED|UPDATED) THEIR RESERVATION/m) || get(/\n([^\n]{2,40})\n\s*Identity verified/i) || get(/Your customer:\s*(.+?) has (?:cancell?ed|edited)/i) || get(/Traveler names?\s*:?\s*([^\n]+)/i);
      guest = guest.replace(/\s+(?:Booking E-?mail|E-?mail|Phone|Tel|Language|Adults|Tour:|Date:|Price)\b.*$/i, '').replace(/^\(\s*\)\s*/, '').replace(/^[\/\s-]+$/, '').replace(/\S+@\S+.*$/, '').replace(/\s*(Phone|Tel|Mobile)\b.*$/i, '').replace(/^\((?:MR|MRS|MS|MISS|DR)\)\s*/i, '').trim();
      if (/^[A-Z' -]+\/[A-Z' -]+$/.test(guest)) { const [sn, gn] = guest.split('/'); const cap = s => s.toLowerCase().replace(/\b\w/g, x => x.toUpperCase()); guest = `${cap(gn)} ${cap(sn)}`.trim(); }
      if (!guest) guest = get(/(?:^|\n)\s*Name\s*:\s*([^\n]+)/i);
      const native = get(/\bName\s*:\s*([^\n]+)/); if (native && /[^\u0000-\u024f]/.test(native) && !guest.includes(native)) guest = guest ? `${guest} (${native.trim()})` : native.trim();
      const num = re => { const m = t.match(re), n = m ? Number(m[1]) : 0; return n >= 1 && n <= 99 ? n : 0; };   // a head count is 1-99; a longer number is a booking code, not people
      let adults = num(/(\d+)\s*x?\s*Adults?\b/i) || num(/\bAdults?\s*:\s*(\d+)/i), children = num(/\b(?:Children|Kids|Minors)\s*:\s*(\d+)/i) + num(/(\d+)\s*x?\s*(?:Child|Children|Kids?)\b/i) + num(/(\d+)\s*x?\s*Youths?\b/i) + num(/(\d+)\s*x?\s*Infants?\b/i);
      if (!adults && !children && src === 'Airbnb') adults = num(/(\d+)\s+guests?\b/i);
      if (!adults && !children) adults = num(/(?:Travell?ers|Participants|Persons|People|Guests|Number of (?:participants|people|guests)|Booking Quantity|Quantity)\s*:?\s*(\d+)/i) || 1;
      const phs = [...t.matchAll(/(?:Phone|Mobile|Tel(?:ephone)?|WhatsApp)\s*(?:number)?\s*:?\s*(?:\([^)]*\))?\s*(?:[A-Z]{2}\s*)?(\+?\d[\d\s()*-]{6,}\d)/gi)].map(m => m[1]).filter(x => !x.includes('*')).map(x => x.replace(/[\s()-]/g, ''));
      const phone = normPhone(phs.find(x => x.startsWith('+')) || (phs[0] ? (phs[0].length > 10 && !/^5/.test(phs[0]) ? '+' + phs[0] : phs[0]) : ''));
      // The guest's email: the address on an "E-mail:" line first, else the first address that is not ours or the platform's own sender. Relay addresses (GetYourGuide, Viator, Airbnb, Apple) are the guest's and are kept.
      const notGuest = e => /\*|no-?reply|do-?not-?reply|notification|mailer|support@|bookings?@|info@|hello@|partner|supplier|friendly\.ge|friendlygeorg|trekksoft|@(?:www\.)?(?:freetour|klook|trip|viator|getyourguide|airbnb|civitatis|tourradar)\.com$|example/i.test(e);
      const mails = (t.match(/[\w.+*-]+@[\w-]+(?:\.[\w-]+)+/g) || []), labelled = get(/(?:Booking E-?mail|Customer e-?mail|Guest e-?mail|E-?mail(?: address)?)\s*:?\s*([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/i);
      const email = (labelled && !notGuest(labelled) ? labelled : '') || mails.find(e => !notGuest(e)) || '';
      const lv = (get(/(?:Tour Language|Guide language|Preferred language|Language)\s*:?\s*([^\n]+)/i) || '').toLowerCase(), lang = (Object.entries(LANG_CODES).find(([k]) => lv.includes(k)) || [])[1] || '';
      const pickup = get(/(?<!at )(?:Pick-?up(?: point| location| address)?|Meeting Point|Departure location|Hotel(?: name)?)\s*:?\s*([^\n]+)/i).replace(/\s*Open in Google Maps.*$/i, '').trim();
      const marks = []; if (/non[\s-]?refundable|no refund/i.test(t)) marks.push('nonref'); if (/wine tasting/i.test(t)) marks.push('wine'); if (/front seat/i.test(t)) marks.push('front_seat'); if (/\bPick-?up\b/i.test(t) && pickup && !/Meeting Point/i.test(t)) marks.push('pickup'); if (src === 'FreeTour') marks.push('freetour');
      const price = get(/Total \((?:USD|EUR|GEL)\)\s*:?\s*([^\n]+)/i) ? get(/Total \(((?:USD|EUR|GEL))\)/i) + ' ' + get(/Total \((?:USD|EUR|GEL)\)\s*:?\s*\$?€?([\d,.]+)/i) : get(/(?:Price|Net Rate|Total(?: price)?|Amount(?: paid)?|Sales Price)\s*:?\s*((?:USD|EUR|GEL|\$|€|₾)\s*\$?\s*[\d,.]+)/i);
      const pnum = Number(String(price).replace(/[^\d.,]/g, '').replace(/,(?=\d{3}\b)/g, '').replace(',', '.')) || null, pcur = /EUR|€/.test(price) ? 'EUR' : /GEL|₾/.test(price) ? 'GEL' : price ? 'USD' : '';
      // Only an explicit past-tense cancel counts: policy text such as "you can cancel" or "CANCELLATIONS" on a new booking must not.
      const head = t.slice(0, 700), status = /\bcancell?ed\b|cancel request|取消申请|已提交取消/i.test(head) ? 'cancel' : /(?:^|\n)\s*New booking\b|booked your experience|great news|You've received a/i.test(head) ? 'new' : /amend|reschedul|\bchanged\b|modif|has been updated|unable to update|Edited Tour Reservation|UPDATED THEIR RESERVATION|改期/i.test(head) ? 'change' : 'new';
      const kind = /private/i.test(title) ? 'private' : /group|shared|small-group|join-in/i.test(title) ? 'group' : /private tour/i.test(t) ? 'private' : /join-in|small group/i.test(t) || src === 'FreeTour' ? 'group' : '';
      const res = { src, ref, title, date: when.date, time: when.time, was: was2, guest, adults, children, phone, email: email.toLowerCase(), lang, pickup, marks, price, pnum, pcur, status, kind };
      // Website (TrekkSoft) order lines: "2 x Tour name (24 November, 2026, 10:30)", then "Guest 1 / First name / Last name / phone" blocks.
      const tk = t.match(/^\s*(\d{1,2})\s*x\s+(.+?)\s*\(([^()]*\d{4}[^()]*)\)\s*$/m);
      if (tk) {
        const w = parseWhen(tk[3]); res.title = tk[2].trim(); res.date = w.date || res.date; res.time = w.time || res.time; res.src = res.src || 'Website';
        res.kind = /private/i.test(res.title) ? 'private' : /group/i.test(res.title) ? 'group' : res.kind;
        const blocks = t.split(/\n\s*Guest\s+\d+\s*\n/i).slice(1), people = blocks.map(b => ({ name: [((b.match(/First name\s*:\s*([^\n]+)/i) || [])[1] || '').trim(), ((b.match(/Last name\s*:\s*([^\n]+)/i) || [])[1] || '').trim()].join(' ').trim(), phone: normPhone(((b.match(/Phone[^:\n]*:\s*(\+?[\d\s()-]{7,})/i) || [])[1] || '').replace(/[\s()-]/g, '')), email: ((b.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/) || [])[0] || '').toLowerCase(), child: /child|kid|infant/i.test(b) }));
        const n = (Number(tk[1]) >= 1 && Number(tk[1]) <= 99 ? Number(tk[1]) : 0) || people.length || 1, kids = people.filter(x => x.child).length;
        res.adults = n - kids; res.children = kids;
        if (people.length) { const lead = people.find(x => x.name) || people[0]; res.guest = lead.name || res.guest; res.phone = lead.phone || res.phone; res.email = lead.email || res.email; const others = people.filter(x => x !== lead && (x.name || x.phone)); if (others.length) res.others = others.map(x => [x.name, x.phone].filter(Boolean).join(' ')).join('; '); }
        const sums = [...t.matchAll(/\(\s*(USD|EUR|GEL)\s*([\d.,]+)\s*\)/gi)]; if (sums.length) { res.pnum = sums.reduce((s, m) => s + Number(m[2].replace(',', '')), 0); res.pcur = sums[0][1].toUpperCase(); res.price = `${res.pcur} ${res.pnum}`; }
      }
      return res;
    }

    // ---------- guest reviews pasted from a platform (GetYourGuide first). Admin only. ----------
    const RV_LABELS = [['guide', /^(?:the )?guide(?:'s)?(?: knowledge| quality)?$/i], ['language', /^language(?: skills)?$/i], ['value', /^value(?: for money)?$/i], ['pace', /^pace(?: of the tour)?$/i], ['accuracy', /^(?:accuracy|organi[sz]ation|as described|accuracy of (?:the )?(?:description|information))$/i], ['transport', /^transport(?:ation)?$/i]];
    function isReview(raw) {
      const t = String(raw || ''); const hits = RV_LABELS.filter(([, re]) => t.split('\n').some(l => re.test(l.replace(/[:\d★☆.\s/]+$/g, '').trim()))).length;
      if (/received a new review for your product|gave your experience [1-5] stars?/i.test(t)) return true;   // notification e-mails
      return /replied on|getyourguide traveler|show details|traveler type|travel date/i.test(t) && hits >= 2 || hits >= 4 || (/\bGYG[A-Z0-9]{8,}\b/.test(t) && hits >= 2);
    }
    function parseReview(raw) {
      const lines = mailText(String(raw || '')).replace(/https?:\/\/\S+/g, ' ').split('\n').map(x => x.replace(/[ \t ]+/g, ' ').trim()).filter(Boolean);
      const t = lines.join('\n'), get = re => { const m = t.match(re); return m ? m[1].trim() : ''; };
      const stars = x => { const n = (String(x).match(/★/g) || []).length; if (n) return n; const m = String(x).match(/\b([1-5](?:\.\d)?)\b/); return m ? Number(m[1]) : null; };
      // Notification e-mails. Airbnb: "<name> gave your experience 5 stars", stars, an optional quoted comment, the tour, "November 11 at 8:30 AM". GetYourGuide: "You have received a new review for your product <tour>." (no star rating in the mail).
      const monthDay = x => { const m = String(x).match(/([A-Z][a-z]+)\.? (\d{1,2})\b/); if (!m) return ''; const mi = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(m[1].slice(0, 3).toLowerCase()); if (mi < 0) return ''; const n = new Date(), y = new Date(n.getFullYear(), mi, Number(m[2])) > new Date(n.getTime() + 2 * 864e5) ? n.getFullYear() - 1 : n.getFullYear(); return `${y}-${String(mi + 1).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`; };
      const ab = t.match(/^(.+?) gave your experience ([1-5]) stars?/m);
      if (ab) {
        const i = lines.findIndex(l => l.startsWith(ab[0])), rest = lines.slice(i + 1).filter(l => !/^★+☆*$/.test(l)), q = /^["“]/;
        let comment = '', k = 0; if (rest[0] && q.test(rest[0])) { const buf = []; while (k < rest.length) { buf.push(rest[k]); if (/["”]$/.test(rest[k])) { k++; break; } k++; } comment = buf.join(' ').replace(/^["“]|["”]$/g, '').trim(); }
        const title = (rest[k] || '').replace(/\s*(?:\.\.\.|…)$/, '').trim(), dl = rest.find(l => /^[A-Z][a-z]+ \d{1,2} at \d/.test(l));
        return { platform: 'Airbnb', ref: '', reviewer: ab[1].trim(), country: '', reviewed_on: null, rating: Number(ab[2]), ratings: {}, comment, tour_title: title, option_name: '', travel_date: dl ? monthDay(dl) || null : null, traveler_type: '', replied_on: null };
      }
      const gn = t.match(/new review for your product (.+?)\.?\s*(?:\n|$)/i);
      if (gn) {
        const i = lines.findIndex(l => /new review for your product/i.test(l)), end = lines.findIndex((l, j) => j > i && /best regards|the getyourguide team|getyourguide (?:deutschland|receives)|become a supply partner/i.test(l)), body = lines.slice(i + 1, end > i ? end : undefined).filter(l => l.length > 3 && !/^(?:-+|hi supply partner|reply|respond|view |read |see |log in|get started)/i.test(l));
        return { platform: 'GetYourGuide', ref: get(/\b(GYG[A-Z0-9]{8,})\b/), reviewer: 'GetYourGuide traveler', country: '', reviewed_on: null, rating: null, ratings: {}, comment: body.join('\n'), tour_title: gn[1].trim(), option_name: '', travel_date: null, traveler_type: '', replied_on: null };
      }
      const ratings = {};
      lines.forEach((l, i) => { const bare = l.replace(/\s*[:\-]?\s*(?:[1-5](?:\.\d)?(?:\s*\/\s*5)?|★+☆*)\s*$/, '').trim(); const found = RV_LABELS.find(([, re]) => re.test(bare)); if (!found || ratings[found[0]] != null) return; const same = bare !== l ? stars(l.slice(bare.length)) : null, nxt = same == null && lines[i + 1] && /^(?:[1-5](?:\.\d)?(?:\s*\/\s*5)?|★+☆*)$/.test(lines[i + 1]) ? stars(lines[i + 1]) : null; const v = same != null ? same : nxt; if (v != null) ratings[found[0]] = v; });
      const vals = Object.values(ratings);
      let rating = null; const top = lines.slice(0, 6).find(l => /^(?:[1-5](?:\.\d)?(?:\s*\/\s*5)?|★{1,5}☆*)$/.test(l) || /^[1-5](?:\.\d)? (?:out of 5|stars?)$/i.test(l)); if (top) rating = stars(top); else rating = stars(get(/(?:Overall|Rating)\s*:?\s*([^\n]+)/i)) ; if (rating == null && vals.length) rating = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10;
      const ref = get(/\b(GYG[A-Z0-9]{8,})\b/), tw = get(/Travel date\s*:?\s*\n?([^\n]+)/i), travel = tw && parseWhen(tw).date ? parseWhen(tw).date : '';
      const rw = get(/(?:Reviewed(?: on)?|Review date|Submitted(?: on)?)\s*:?\s*\n?([^\n]+)/i), reviewed = rw && parseWhen(rw).date ? parseWhen(rw).date : (lines.map(l => parseWhen(l)).find(w => w.date && w.date !== travel) || {}).date || '';
      const rep = get(/Replied on\s*:?\s*\n?([^\n]+)/i), replied = rep && parseWhen(rep).date ? parseWhen(rep).date : '';
      const type = get(/Traveler type\s*:?\s*\n?([^\n]+)/i) || get(/^(Solo|Couple|Family(?: with [a-z ]+)?|Friends|Group of friends|Business)$/im);
      const labelRe = /^(?:show details|replied on|reply|travel date|traveler type|booking (?:reference|ref)|reference|option|activity|tour|reviewed|review date|submitted)\b/i, junk = l => RV_LABELS.some(([, re]) => re.test(l.replace(/[:\d★☆.\s/]+$/g, '').trim())) || labelRe.test(l) || /^[1-5](?:\.\d)?(?:\s*\/\s*5)?$|^★+☆*$/.test(l) || /^GYG[A-Z0-9]{8,}$/.test(l) || (parseWhen(l).date && l.length < 30);
      const text = lines.filter(l => !junk(l)); 
      const reviewer = (text.find(l => /getyourguide traveler/i.test(l)) || '').replace(/\s*[,·|].*$/, '') || (text.find(l => l.length <= 40 && !/[.!?]$/.test(l) && !/\b(?:tour|trip|walking|private|group)\b/i.test(l)) || '');
      const country = get(/(?:Country|From)\s*:?\s*([A-Za-z .'-]{3,40})/) || (text.find(l => /^[A-Z][A-Za-z .'-]{2,30}$/.test(l) && l !== reviewer && l.split(' ').length <= 3 && !/\b(?:tour|trip|walking|private|group)\b/i.test(l)) || '');
      const tour = get(/(?:Activity|Tour|Product)\s*:\s*([^\n]+)/i) || (text.find(l => /\b(?:tour|trip|walk|excursion|day)\b/i.test(l) && l.length <= 140 && l !== reviewer) || '');
      const option = get(/Option\s*:?\s*\n?([^\n]+)/i);
      const comment = text.filter(l => l !== reviewer && l !== country && l !== tour && l !== option && l !== type && l.length > 25).join('\n');
      return { platform: 'GetYourGuide', ref, reviewer: reviewer || 'GetYourGuide traveler', country, reviewed_on: reviewed || null, rating, ratings, comment, tour_title: tour, option_name: option, travel_date: travel || null, traveler_type: type, replied_on: replied || null };
    }
    return { mailText, parseBooking, isReview, parseReview, RV_LABELS };
  };
})();
