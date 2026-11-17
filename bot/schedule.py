"""Bridge between the crew Telegram bot and Friendly Schedule (the team scheduling app).

What it gives the bot:
  /link CODE   connect a Telegram account to a person in the schedule (the code is shown in the app: Me > Telegram bot)
  /week        my tours and days off for the next 7 days
  /tomorrow    my tours tomorrow
  a loop that forwards schedule notices (new tour, change, cancellation, evening reminder, Sunday check) to Telegram

No guest names or phones ever leave the database through this module: messages carry the tour, time, meeting point,
guest count and the colleague on the tour. Guest lists stay in the app.

Settings (bot .env):
  SCHEDULE_URL=https://<project>.supabase.co
  SCHEDULE_SERVICE_KEY=<service_role key>      # stays on the bot server only, never in the web app
  SCHEDULE_APP_URL=https://<account>.github.io/<repository>/

Only the standard library is used, so nothing is added to requirements.txt.
"""
from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timedelta

WEEKDAYS = {
    "en": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    "ru": ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
    "ka": ["ორშ", "სამ", "ოთხ", "ხუთ", "პარ", "შაბ", "კვი"],
}
TEXT = {
    "en": {
        "menu": "Choose what you need:", "b_week": "📅 My week", "b_tomorrow": "Tomorrow", "b_open": "🙋 Open tours", "b_off": "🏖 Day off", "b_sick": "🤒 I am sick today", "b_bug": "🐞 Report a problem",
        "open_none": "No open tours for you in the next 14 days.", "open_title": "Tours that still need a {role} (next 14 days). Tap one to ask for it; the office approves:",
        "take_btn": "Take: {line}", "take_ok": "Sent. The office will confirm: {title}, {date}.", "take_twice": "You already asked for this tour.", "take_gone": "This tour is no longer open.",
        "off_ask": "Which day? Send the date like 24.12 or a range like 24.12-26.12. Add a reason after a space if you want.", "off_bad": "I did not understand the date. Example: 24.12 or 24.12-26.12",
        "off_ok": "Day off requested: {range}. The office will answer here and in the app.", "off_twice": "You already have time off on these days.", "off_past": "This date is in the past.",
        "sick_ask": "Mark today as a sick day? The office is told at once.", "sick_yes": "Yes, I am sick today", "sick_ok": "Get well soon. Today is marked as a sick day and the office is told.",
        "role_guide": "guide", "role_driver": "driver",
        "week": "Your next 7 days", "tomorrow": "Tomorrow", "none": "No tours.", "off": "Day off", "sick": "Sick day",
        "guests": "guests", "meet": "Meeting point", "with": "with", "open": "Open schedule",
        "linked": "Connected. Hello, {name}! Schedule notices will come here.",
        "bad_code": "This code does not work. Open the app: Me > Telegram bot, and send the new code.",
        "not_linked": "Connect first: open the app, Me > Telegram bot, and send me /link with the code.",
        "n_tour_assigned": "New tour for you: {title}, {date} {time}",
        "n_tour_removed": "You are no longer on: {title}, {date}",
        "n_tour_changed": "Tour changed: {title} is now {date} {time}",
        "n_tour_cancelled": "Tour cancelled: {title}, {date}. {reason}",
        "n_tour_restored": "Tour is back on: {title}, {date}",
        "n_tour_tomorrow": "Tomorrow: {title}, {time}",
        "n_week_check": "Sunday check: look at your schedule for next week and confirm it in the app.",
                "n_ticket_new": "New problem report: {title}",
        "n_ticket_update": "Your report \"{title}\": {status}. {reason}",
        "st_new": "new", "st_seen": "seen", "st_planned": "planned", "st_working": "in work", "st_done": "done", "st_wontdo": "not planned",
        "bug_help": "Write /bug and what is wrong, for example: /bug the pay on my tour card is wrong. You can add a photo or a short video with the same text as the caption.",
        "bug_ok": "Thank you. Report {num} is received. The answer comes here and in the app.",
        "bug_fail": "Could not save the report. Please try again later or use the app.",
        "n_default": "New notice in Friendly Schedule.",
    },
    "ru": {
        "menu": "Выберите, что нужно:", "b_week": "📅 Моя неделя", "b_tomorrow": "Завтра", "b_open": "🙋 Свободные туры", "b_off": "🏖 Выходной", "b_sick": "🤒 Я заболел(а)", "b_bug": "🐞 Сообщить о проблеме",
        "open_none": "Свободных туров для вас на ближайшие 14 дней нет.", "open_title": "Туры, где ещё нужен {role} (ближайшие 14 дней). Нажмите, чтобы попросить тур; офис подтвердит:",
        "take_btn": "Взять: {line}", "take_ok": "Отправлено. Офис подтвердит: {title}, {date}.", "take_twice": "Вы уже просили этот тур.", "take_gone": "Этот тур уже занят.",
        "off_ask": "Какой день? Отправьте дату, например 24.12, или период 24.12-26.12. Можно добавить причину через пробел.", "off_bad": "Не понял дату. Пример: 24.12 или 24.12-26.12",
        "off_ok": "Выходной запрошен: {range}. Офис ответит здесь и в приложении.", "off_twice": "На эти дни у вас уже есть выходной.", "off_past": "Эта дата уже прошла.",
        "sick_ask": "Отметить сегодня как больничный? Офис узнает сразу.", "sick_yes": "Да, я болею сегодня", "sick_ok": "Выздоравливайте. Сегодня отмечено как больничный, офис в курсе.",
        "role_guide": "гид", "role_driver": "водитель",
        "week": "Ваши ближайшие 7 дней", "tomorrow": "Завтра", "none": "Туров нет.", "off": "Выходной", "sick": "Больничный",
        "guests": "гостей", "meet": "Место встречи", "with": "с", "open": "Открыть расписание",
        "linked": "Готово. Привет, {name}! Уведомления о расписании будут приходить сюда.",
        "bad_code": "Этот код не подходит. Откройте приложение: Я > Telegram-бот, и отправьте новый код.",
        "not_linked": "Сначала подключитесь: в приложении Я > Telegram-бот, затем отправьте мне /link и код.",
        "n_tour_assigned": "Новый тур для вас: {title}, {date} {time}",
        "n_tour_removed": "Вы больше не на туре: {title}, {date}",
        "n_tour_changed": "Тур изменён: {title}, теперь {date} {time}",
        "n_tour_cancelled": "Тур отменён: {title}, {date}. {reason}",
        "n_tour_restored": "Тур снова в силе: {title}, {date}",
        "n_tour_tomorrow": "Завтра: {title}, {time}",
        "n_week_check": "Воскресная проверка: посмотрите расписание на следующую неделю и подтвердите в приложении.",
                "n_ticket_new": "Новое сообщение о проблеме: {title}",
        "n_ticket_update": "Ваше сообщение «{title}»: {status}. {reason}",
        "st_new": "новое", "st_seen": "прочитано", "st_planned": "в планах", "st_working": "в работе", "st_done": "готово", "st_wontdo": "не планируем",
        "bug_help": "Напишите /bug и что не так, например: /bug оплата в карточке моего тура неверная. Можно добавить фото или короткое видео с тем же текстом в подписи.",
        "bug_ok": "Спасибо. Сообщение {num} принято. Ответ придёт сюда и в приложение.",
        "bug_fail": "Не удалось сохранить сообщение. Попробуйте позже или через приложение.",
        "n_default": "Новое уведомление в Friendly Schedule.",
    },
    "ka": {
        "menu": "აირჩიეთ, რა გჭირდებათ:", "b_week": "📅 ჩემი კვირა", "b_tomorrow": "ხვალ", "b_open": "🙋 თავისუფალი ტურები", "b_off": "🏖 დასვენება", "b_sick": "🤒 დღეს ავად ვარ", "b_bug": "🐞 პრობლემის შეტყობინება",
        "open_none": "მომდევნო 14 დღეში თქვენთვის თავისუფალი ტური არ არის.", "open_title": "ტურები, სადაც ჯერ კიდევ საჭიროა {role} (მომდევნო 14 დღე). შეეხეთ ტურს მოსათხოვად; ოფისი დაადასტურებს:",
        "take_btn": "აღება: {line}", "take_ok": "გაიგზავნა. ოფისი დაადასტურებს: {title}, {date}.", "take_twice": "ეს ტური უკვე მოითხოვეთ.", "take_gone": "ეს ტური აღარ არის თავისუფალი.",
        "off_ask": "რომელი დღე? გამოგზავნეთ თარიღი, მაგ. 24.12, ან პერიოდი 24.12-26.12. მიზეზი შეგიძლიათ დაამატოთ სივრცის შემდეგ.", "off_bad": "თარიღი ვერ გავიგე. მაგალითი: 24.12 ან 24.12-26.12",
        "off_ok": "დასვენება მოთხოვნილია: {range}. ოფისი აქ და აპში გიპასუხებთ.", "off_twice": "ამ დღეებში უკვე გაქვთ დასვენება.", "off_past": "ეს თარიღი უკვე გავიდა.",
        "sick_ask": "მოვნიშნოთ დღე ავადმყოფობის დღედ? ოფისი მაშინვე გაიგებს.", "sick_yes": "დიახ, დღეს ავად ვარ", "sick_ok": "გამოჯანმრთელდით. დღე მონიშნულია ავადმყოფობის დღედ, ოფისმა იცის.",
        "role_guide": "გიდი", "role_driver": "მძღოლი",
        "week": "თქვენი მომდევნო 7 დღე", "tomorrow": "ხვალ", "none": "ტურები არ არის.", "off": "დასვენების დღე", "sick": "ბიულეტენი",
        "guests": "სტუმარი", "meet": "შეხვედრის ადგილი", "with": "ერთად:", "open": "განრიგის გახსნა",
        "linked": "მზადაა. გამარჯობა, {name}! განრიგის შეტყობინებები აქ მოვა.",
        "bad_code": "ეს კოდი არ მუშაობს. გახსენით აპი: მე > Telegram-ბოტი, და გამოგზავნეთ ახალი კოდი.",
        "not_linked": "ჯერ დაუკავშირდით: აპში მე > Telegram-ბოტი, შემდეგ გამომიგზავნეთ /link და კოდი.",
        "n_tour_assigned": "ახალი ტური თქვენთვის: {title}, {date} {time}",
        "n_tour_removed": "ამ ტურზე აღარ ხართ: {title}, {date}",
        "n_tour_changed": "ტური შეიცვალა: {title}, ახლა {date} {time}",
        "n_tour_cancelled": "ტური გაუქმდა: {title}, {date}. {reason}",
        "n_tour_restored": "ტური აღდგა: {title}, {date}",
        "n_tour_tomorrow": "ხვალ: {title}, {time}",
        "n_week_check": "კვირის შემოწმება: ნახეთ მომდევნო კვირის განრიგი და დაადასტურეთ აპში.",
                "n_ticket_new": "ახალი შეტყობინება პრობლემაზე: {title}",
        "n_ticket_update": "თქვენი შეტყობინება «{title}»: {status}. {reason}",
        "st_new": "ახალი", "st_seen": "ნანახია", "st_planned": "დაგეგმილია", "st_working": "მუშავდება", "st_done": "მზადაა", "st_wontdo": "არ ვგეგმავთ",
        "bug_help": "დაწერეთ /bug და რა არის არასწორი, მაგალითად: /bug ჩემი ტურის ბარათზე ანაზღაურება არასწორია. შეგიძლიათ დაამატოთ ფოტო ან მოკლე ვიდეო იგივე ტექსტით წარწერაში.",
        "bug_ok": "მადლობა. შეტყობინება {num} მიღებულია. პასუხი მოვა აქ და აპში.",
        "bug_fail": "შეტყობინების შენახვა ვერ მოხერხდა. სცადეთ მოგვიანებით ან აპიდან.",
        "n_default": "ახალი შეტყობინება Friendly Schedule-ში.",
    },
}


def tr(lang: str, key: str, **kw) -> str:
    table = TEXT.get(lang) or TEXT["en"]
    text = table.get(key) or TEXT["en"].get(key) or key
    try:
        return text.format(**{k: ("" if v is None else v) for k, v in kw.items()}).strip()
    except (KeyError, IndexError):
        return text


def day_label(d: str, lang: str) -> str:
    y, m, dd = (int(x) for x in d.split("-"))
    wd = (WEEKDAYS.get(lang) or WEEKDAYS["en"])[date(y, m, dd).weekday()]
    return f"{wd} {dd:02d}.{m:02d}"


class ScheduleClient:
    """Small REST client for the schedule database. `http` can be replaced in tests."""

    def __init__(self, url: str, service_key: str, http=None, timeout: int = 15):
        self.base = url.rstrip("/") + "/rest/v1/"
        self.key = service_key
        self.timeout = timeout
        self.http = http or self._http

    def _http(self, method: str, url: str, body: bytes | None, headers: dict) -> str:
        req = urllib.request.Request(url, data=body, method=method, headers=headers)
        with urllib.request.urlopen(req, timeout=self.timeout) as r:  # noqa: S310 (fixed https host from settings)
            return r.read().decode("utf-8")

    def _call(self, method: str, table: str, params: dict | None = None, body: dict | None = None) -> list:
        url = self.base + table + ("?" + urllib.parse.urlencode(params or {}, safe="(),.*:!") if params else "")
        headers = {"apikey": self.key, "Authorization": "Bearer " + self.key, "Content-Type": "application/json",
                   "Prefer": "return=representation"}
        raw = self.http(method, url, json.dumps(body).encode("utf-8") if body is not None else None, headers)
        return json.loads(raw) if raw else []

    # --- people ---
    def link(self, code: str, tg_id: int) -> dict | None:
        """Connect a Telegram account by the one-time code from the app. Returns the profile or None."""
        code = "".join(ch for ch in str(code) if ch.isdigit())
        if len(code) != 6:
            return None
        rows = self._call("GET", "profiles", {"link_code": "eq." + code, "active": "is.true", "select": "id,name,lang,role"})
        if len(rows) != 1:
            return None
        self._call("PATCH", "profiles", {"telegram_id": "eq." + str(int(tg_id))}, {"telegram_id": None})   # one account, one person
        self._call("PATCH", "profiles", {"id": "eq." + rows[0]["id"]}, {"telegram_id": int(tg_id), "link_code": None})
        return rows[0]

    def profile(self, tg_id: int) -> dict | None:
        rows = self._call("GET", "profiles", {"telegram_id": "eq." + str(int(tg_id)), "active": "is.true", "select": "id,name,lang,role"})
        return rows[0] if rows else None

    # --- schedule ---
    def tours(self, profile_id: str, date_from: str, date_to: str) -> list:
        """Confirmed tours of one person that touch the given dates (multi-day tours included)."""
        rows = self._call("GET", "tours", {
            "or": f"(guide_id.eq.{profile_id},driver_id.eq.{profile_id})", "status": "eq.confirmed",
            "date": "lte." + date_to, "select": "id,date,date_to,start_time,end_time,title,pax,pickup,guide_id,driver_id,extra_guides",
            "order": "date.asc,start_time.asc"})
        try:   # tours where this person is one of several guides (extra_guides); a problem here must never hide the main list
            more = self._call("GET", "tours", {
                "extra_guides": 'cs.[{"id":"%s"}]' % profile_id, "status": "eq.confirmed", "date": "lte." + date_to,
                "select": "id,date,date_to,start_time,end_time,title,pax,pickup,guide_id,driver_id,extra_guides", "order": "date.asc,start_time.asc"})
            seen = {t["id"] for t in rows}; rows = list(rows) + [t for t in (more or []) if t["id"] not in seen]
            rows.sort(key=lambda t: (t["date"], t.get("start_time") or ""))
        except Exception:
            pass
        return [t for t in rows if (t.get("date_to") or t["date"]) >= date_from]

    def names(self, ids: list) -> dict:
        ids = sorted({i for i in ids if i})
        if not ids:
            return {}
        rows = self._call("GET", "profiles", {"id": "in.(" + ",".join(ids) + ")", "select": "id,name"})
        return {r["id"]: r["name"] for r in rows}

    def time_off(self, profile_id: str, date_from: str, date_to: str) -> list:
        rows = self._call("GET", "time_off", {"user_id": "eq." + profile_id, "status": "neq.declined",
                                              "date_from": "lte." + date_to, "select": "date_from,date_to,type,status"})
        return [o for o in rows if o["date_to"] >= date_from]

    # --- problem reports ---
    def admins(self) -> list:
        return [r["id"] for r in self._call("GET", "profiles", {"role": "eq.admin", "active": "is.true", "select": "id"})]

    def add_ticket(self, profile_id: str, ticket_id: str, body: str, shots: list) -> dict:
        row = {"id": ticket_id, "user_id": profile_id, "source": "telegram", "body": body[:2000], "shots": shots, "status": "new"}
        return (self._call("POST", "tickets", body=row) or [row])[0]

    def upload_shot(self, path: str, data: bytes) -> None:
        """Store one small JPEG in the private tickets folder. Never a video."""
        url = self.base.replace("/rest/v1/", "/storage/v1/object/tickets/") + urllib.parse.quote(path)
        headers = {"apikey": self.key, "Authorization": "Bearer " + self.key, "Content-Type": "image/jpeg", "x-upsert": "true"}
        self.http("POST", url, data, headers)

    def notify(self, user_ids: list, kind: str, params: dict) -> None:
        for uid in user_ids:
            self._call("POST", "notifications", body={"user_id": uid, "kind": kind, "params": params, "read": False})

    # --- shortcuts for guides and drivers (17 Nov): every one creates the same request the app makes; the office approves in the app ---
    NO_CAR = ("walking", "walk ", "night tour", "free tour", "brutal tbilisi", "old tbilisi")

    def open_tours(self, profile: dict, today: date | None = None, days: int = 14) -> list:
        """Confirmed tours in the next days that still need this person's role, on days the person is free."""
        today = today or date.today()
        role = "driver_id" if profile.get("role") == "driver" else "guide_id"
        d0, d1 = today.isoformat(), (today + timedelta(days=days)).isoformat()
        rows = self._call("GET", "tours", {role: "is.null", "status": "eq.confirmed", "date": "gte." + d0, "and": f"(date.lte.{d1})",
                                           "select": "id,date,date_to,start_time,title,pax,language,guide_id,driver_id", "order": "date.asc,start_time.asc"})
        if role == "driver_id":
            rows = [t for t in rows if not any(w in (t.get("title") or "").lower() for w in self.NO_CAR)]
        busy = {t["date"] for t in self.tours(profile["id"], d0, d1)}
        for o in self.time_off(profile["id"], d0, d1):
            d = date.fromisoformat(o["date_from"])
            while d.isoformat() <= o["date_to"]:
                busy.add(d.isoformat()); d += timedelta(days=1)
        asked = {r["tour_id"] for r in self._call("GET", "change_requests", {"user_id": "eq." + profile["id"], "status": "eq.pending", "select": "tour_id"})}
        return [t for t in rows if t["date"] not in busy and t["id"] not in asked]

    def take(self, profile: dict, tour_id: str) -> str:
        """Ask for an open tour. Returns 'ok', 'twice' or 'gone'."""
        role = "driver_id" if profile.get("role") == "driver" else "guide_id"
        ts = self._call("GET", "tours", {"id": "eq." + tour_id, "select": "id,title,date,status,guide_id,driver_id"})
        if not ts or ts[0].get("status") != "confirmed" or ts[0].get(role):
            return "gone"
        if self._call("GET", "change_requests", {"user_id": "eq." + profile["id"], "tour_id": "eq." + tour_id, "status": "eq.pending", "select": "id"}):
            return "twice"
        t = ts[0]
        self._call("POST", "change_requests", body={"tour_id": tour_id, "user_id": profile["id"], "patch": {role: profile["id"]}, "cant": False, "swap_with": None,
                                                    "agreed": False, "message": "Telegram", "status": "pending"})
        self.notify(self.admins(), "creq_new", {"name": profile["name"], "title": t["title"], "date": t["date"], "tour": tour_id})
        return "ok"

    def day_off(self, profile: dict, date_from: str, date_to: str, note: str = "", kind: str = "dayoff") -> str:
        """Ask for time off ('dayoff', waits for the office) or report a sick day ('sick', counted at once like in the app)."""
        if self.time_off(profile["id"], date_from, date_to):
            return "twice"
        self._call("POST", "time_off", body={"user_id": profile["id"], "date_from": date_from, "date_to": date_to, "type": kind,
                                             "status": "approved" if kind == "sick" else "pending", "note": (note or "")[:300] or None})
        self.notify(self.admins(), "sick_reported" if kind == "sick" else "off_requested", {"name": profile["name"], "from": date_from, "to": date_to})
        return "ok"

    # --- notices ---
    def pending_notices(self, limit: int = 40) -> list:
        """Schedule notices not yet sent to Telegram, each with the receiver's telegram_id and language."""
        rows = self._call("GET", "notifications", {"tg_sent": "is.false", "order": "created_at.asc", "limit": str(limit),
                                                   "select": "id,user_id,kind,params,created_at"})
        if not rows:
            return []
        people = self._call("GET", "profiles", {"id": "in.(" + ",".join(sorted({r["user_id"] for r in rows})) + ")",
                                                "select": "id,telegram_id,lang,mute,active"})
        by = {p["id"]: p for p in people}
        for r in rows:
            p = by.get(r["user_id"]) or {}
            r["telegram_id"], r["lang"] = (p.get("telegram_id") if p.get("active") else None), (p.get("lang") or "en")
        return rows

    def mark_sent(self, ids: list) -> None:
        if ids:
            self._call("PATCH", "notifications", {"id": "in.(" + ",".join(ids) + ")"}, {"tg_sent": True})


# ---------- messages (plain text; the caller adds the "Open schedule" button) ----------

def tour_line(t: dict, me: str, names: dict, lang: str) -> str:
    when = (t.get("start_time") or "") + (("–" + t["end_time"]) if t.get("end_time") else "")
    other = t.get("driver_id") if t.get("guide_id") == me else t.get("guide_id")
    parts = [f"{when} {t['title']}".strip(), f"{t.get('pax') or 0} {tr(lang, 'guests')}"]
    if other and names.get(other):
        parts.append(f"{tr(lang, 'with')} {names[other]}")
    line = " · ".join(parts)
    if t.get("pickup"):
        line += f"\n   {tr(lang, 'meet')}: {t['pickup']}"
    return line


def format_days(tours: list, offs: list, me: str, names: dict, lang: str, start: date, days: int, title_key: str) -> str:
    out = [tr(lang, title_key)]
    for i in range(days):
        d = (start + timedelta(days=i)).isoformat()
        todays = [t for t in tours if t["date"] <= d <= (t.get("date_to") or t["date"])]
        off = next((o for o in offs if o["date_from"] <= d <= o["date_to"]), None)
        out.append("")
        out.append(day_label(d, lang))
        if off:
            out.append("  " + tr(lang, "sick" if off.get("type") == "sick" else "off"))
        for t in todays:
            out.append("  " + tour_line(t, me, names, lang))
        if not todays and not off:
            out.append("  " + tr(lang, "none"))
    return "\n".join(out)


def week_text(client: ScheduleClient, profile: dict, today: date | None = None, days: int = 7, title_key: str = "week") -> str:
    today = today or date.today()
    lang, me = profile.get("lang") or "en", profile["id"]
    a, b = today.isoformat(), (today + timedelta(days=days - 1)).isoformat()
    tours = client.tours(me, a, b)
    names = client.names([t.get("guide_id") for t in tours] + [t.get("driver_id") for t in tours])
    return format_days(tours, client.time_off(me, a, b), me, names, lang, today, days, title_key)


def tomorrow_text(client: ScheduleClient, profile: dict, today: date | None = None) -> str:
    return week_text(client, profile, (today or date.today()) + timedelta(days=1), 1, "tomorrow")


def notice_text(row: dict) -> str:
    """Text of one schedule notice in the receiver's language. Unknown kinds get a neutral line."""
    lang, p = row.get("lang") or "en", dict(row.get("params") or {})
    if p.get("date"):
        try:
            p["date"] = day_label(str(p["date"])[:10], lang)
        except (ValueError, IndexError):
            pass
    key = "n_" + str(row.get("kind"))
    table = TEXT.get(lang) or TEXT["en"]
    if key not in table and key not in TEXT["en"]:
        return tr(lang, "n_default")
    status = tr(lang, "st_" + str(p.get("status"))) if p.get("status") else ""
    return tr(lang, key, title=p.get("title", ""), date=p.get("date", ""), time=p.get("time", ""), reason=p.get("reason", ""), status=status).rstrip(". ")


def parse_days(text: str, today: date | None = None) -> tuple | None:
    """'24.12', '24.12.2026', '24.12-26.12', '2026-12-24' (and a reason after a space) -> (from, to, reason). A day before today means next year."""
    import re
    today = today or date.today()
    m = re.match(r"\s*(\d{4}-\d\d-\d\d|\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?)(?:\s*[-–]\s*(\d{4}-\d\d-\d\d|\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?))?\s*(.*)$", text or "")
    if not m:
        return None

    def one(x: str) -> date | None:
        try:
            if "-" in x:
                return date.fromisoformat(x)
            p = re.split(r"[./]", x)
            y = int(p[2]) if len(p) > 2 else today.year
            y = y + 2000 if y < 100 else y
            d = date(y, int(p[1]), int(p[0]))
            return d.replace(year=d.year + 1) if len(p) < 3 and d < today - timedelta(days=1) else d
        except (ValueError, IndexError):
            return None
    a = one(m.group(1)); b = one(m.group(2)) if m.group(2) else a
    if not a or not b or b < a or (b - a).days > 31:
        return None
    return a.isoformat(), b.isoformat(), m.group(3).strip()


def open_line(t: dict, lang: str) -> str:
    return f"{day_label(t['date'], lang)} {t.get('start_time') or ''} {t.get('title') or ''}".replace("  ", " ").strip()[:60]
