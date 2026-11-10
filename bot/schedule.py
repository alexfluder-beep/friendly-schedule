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
        "n_default": "New notice in Friendly Schedule.",
    },
    "ru": {
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
        "n_default": "Новое уведомление в Friendly Schedule.",
    },
    "ka": {
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
            "date": "lte." + date_to, "select": "id,date,date_to,start_time,end_time,title,pax,pickup,guide_id,driver_id",
            "order": "date.asc,start_time.asc"})
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
    return tr(lang, key, title=p.get("title", ""), date=p.get("date", ""), time=p.get("time", ""), reason=p.get("reason", "")).rstrip(". ")
