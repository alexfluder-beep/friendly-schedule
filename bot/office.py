"""Office questions for the crew Telegram bot (19 Nov 2026). Admins only.

  /board [today|tomorrow|DD.MM]   every tour of the day on one line: time, tour, guests, guide, driver, warnings
  /ref CODE [CODE ...]            is this booking code in the app? (codes from platform e-mails)
  /conflicts                      double bookings, people on time off, holidays, 4x4 without a 4x4 car (next 7 days)
  /seats DD.MM                    free seats on the group tours of that day

It reads the same read-only database functions as Claude's daily checks (agent_board, agent_find_refs, agent_conflicts),
through the bot's existing connection (SCHEDULE_URL / SCHEDULE_SERVICE_KEY), so nothing new has to be set up.
No guest names, phones or e-mails are shown: tours carry counts, staff names and warnings only.
Only the standard library is used.
"""
from __future__ import annotations

import re
from datetime import date, timedelta

import schedule as sch

TEXT = {
    "en": {
        "only_admin": "This is for the office (admins) only.",
        "board_title": "{day}: {n} tours, {pax} guests",
        "board_none": "{day}: no tours.",
        "board_far": "I can show today and the next 14 days. Example: /board tomorrow or /board 24.11",
        "ref_ask": "Send the booking codes after the command, for example: /ref ABC12345 BR-1234567",
        "ref_found": "{code}: in the app, {date} {time}, {title}, {pax} guests{status}",
        "ref_missing": "{code}: NOT in the app",
        "conf_none": "No conflicts in the next 7 days.",
        "conf_title": "Conflicts in the next 7 days:",
        "seats_ask": "Which day? Example: /seats 24.11",
        "seats_title": "{day}: free seats",
        "seats_none": "{day}: no group tours planned yet.",
        "seats_line": "{time} {title}: {free} free of {cap}",
        "seats_full": "{time} {title}: full ({pax} of {cap})",
        "seats_nocap": "{time} {title}: {pax} booked, no limit set",
        "no_guide": "no guide", "no_driver": "no driver", "guests": "guests",
        "today": "Today", "tomorrow": "Tomorrow",
        "flags": {"NO_GUIDE": "no guide", "OVER_6_PER_CAR": "more than 6 per car", "SABADURI_OVER_15": "Sabaduri over 15", "WALK_OVER_10": "walk over 10: second guide", "PAX_MISMATCH": "guest count differs from bookings"},
        "error": "The schedule did not answer. Try again in a minute.",
    },
    "ru": {
        "only_admin": "Это только для офиса (администраторов).",
        "board_title": "{day}: туров {n}, гостей {pax}",
        "board_none": "{day}: туров нет.",
        "board_far": "Показываю сегодня и следующие 14 дней. Пример: /board tomorrow или /board 24.11",
        "ref_ask": "Напишите коды броней после команды, например: /ref ABC12345 BR-1234567",
        "ref_found": "{code}: есть в приложении, {date} {time}, {title}, гостей {pax}{status}",
        "ref_missing": "{code}: НЕТ в приложении",
        "conf_none": "Конфликтов на 7 дней нет.",
        "conf_title": "Конфликты на 7 дней:",
        "seats_ask": "Какой день? Пример: /seats 24.11",
        "seats_title": "{day}: свободные места",
        "seats_none": "{day}: групповых туров пока нет.",
        "seats_line": "{time} {title}: свободно {free} из {cap}",
        "seats_full": "{time} {title}: мест нет ({pax} из {cap})",
        "seats_nocap": "{time} {title}: забронировано {pax}, лимит не задан",
        "no_guide": "нет гида", "no_driver": "нет водителя", "guests": "гостей",
        "today": "Сегодня", "tomorrow": "Завтра",
        "flags": {"NO_GUIDE": "нет гида", "OVER_6_PER_CAR": "больше 6 на машину", "SABADURI_OVER_15": "Сабадури больше 15", "WALK_OVER_10": "прогулка больше 10: второй гид", "PAX_MISMATCH": "число гостей не совпадает с бронями"},
        "error": "Расписание не ответило. Попробуйте через минуту.",
    },
    "ka": {
        "only_admin": "ეს მხოლოდ ოფისისთვისაა (ადმინისტრატორები).",
        "board_title": "{day}: ტური {n}, სტუმარი {pax}",
        "board_none": "{day}: ტურები არ არის.",
        "board_far": "ვაჩვენებ დღეს და მომდევნო 14 დღეს. მაგალითი: /board tomorrow ან /board 24.11",
        "ref_ask": "ბრძანების შემდეგ დაწერეთ ჯავშნის კოდები, მაგალითად: /ref ABC12345 BR-1234567",
        "ref_found": "{code}: აპშია, {date} {time}, {title}, სტუმარი {pax}{status}",
        "ref_missing": "{code}: აპში არ არის",
        "conf_none": "მომდევნო 7 დღეში კონფლიქტი არ არის.",
        "conf_title": "კონფლიქტები მომდევნო 7 დღეში:",
        "seats_ask": "რომელი დღე? მაგალითი: /seats 24.11",
        "seats_title": "{day}: თავისუფალი ადგილები",
        "seats_none": "{day}: ჯგუფური ტური ჯერ არ არის.",
        "seats_line": "{time} {title}: თავისუფალია {free} / {cap}",
        "seats_full": "{time} {title}: სავსეა ({pax} / {cap})",
        "seats_nocap": "{time} {title}: დაჯავშნილია {pax}, ლიმიტი არ არის",
        "no_guide": "გიდი არ არის", "no_driver": "მძღოლი არ არის", "guests": "სტუმარი",
        "today": "დღეს", "tomorrow": "ხვალ",
        "flags": {"NO_GUIDE": "გიდი არ არის", "OVER_6_PER_CAR": "მანქანაში 6-ზე მეტი", "SABADURI_OVER_15": "საბადური 15-ზე მეტი", "WALK_OVER_10": "ტური 10-ზე მეტი: მეორე გიდი", "PAX_MISMATCH": "სტუმრების რიცხვი ჯავშნებს არ ემთხვევა"},
        "error": "განრიგმა არ უპასუხა. სცადეთ ერთ წუთში.",
    },
}
CODE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9\-_/.#]{3,39}$")


def t(lang: str, key: str, **kw):
    v = TEXT.get(lang, TEXT["en"]).get(key, TEXT["en"].get(key, key))
    return v.format(**kw) if kw and isinstance(v, str) else v


def is_admin(profile: dict | None) -> bool:
    return bool(profile) and profile.get("role") == "admin"


def parse_day(arg: str, today: date) -> int | None:
    """'' / today -> 0, tomorrow -> 1, '24.11' or '24.11.2026' -> days from today (0..14), else None."""
    a = (arg or "").strip().lower()
    if a in ("", "today", "сегодня", "დღეს"):
        return 0
    if a in ("tomorrow", "завтра", "ხვალ"):
        return 1
    m = re.match(r"^(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?$", a)
    if not m:
        return None
    y = int(m.group(3)) if m.group(3) else today.year
    y = y + 2000 if y < 100 else y
    try:
        d = date(y, int(m.group(2)), int(m.group(1)))
    except ValueError:
        return None
    if not m.group(3) and d < today:          # 05.01 typed in December means next January
        try:
            d = date(y + 1, d.month, d.day)
        except ValueError:
            return None
    n = (d - today).days
    return n if 0 <= n <= 14 else None


def day_name(n: int, today: date, lang: str) -> str:
    if n == 0:
        return t(lang, "today")
    if n == 1:
        return t(lang, "tomorrow")
    return sch.day_label((today + timedelta(days=n)).isoformat(), lang)


def flag_text(flags: list, lang: str) -> str:
    names = t(lang, "flags")
    return ", ".join(names.get(f, f) for f in flags or [])


def board_text(rows: list, n: int, today: date, lang: str) -> str:
    day = day_name(n, today, lang)
    rows = [r for r in rows if r.get("date") == (today + timedelta(days=n)).isoformat()]
    if not rows:
        return t(lang, "board_none", day=day)
    out = [t(lang, "board_title", day=day, n=len(rows), pax=sum(int(r.get("pax") or 0) for r in rows))]
    for r in sorted(rows, key=lambda x: x.get("start_time") or ""):
        line = f"{r.get('start_time') or '--:--'} {r.get('title')}: {r.get('pax') or 0} {t(lang, 'guests')}, {r.get('guide') or t(lang, 'no_guide')}"
        line += f", {r.get('driver')}" if r.get("driver") else ""
        if r.get("status") and r.get("status") != "confirmed":
            line += f" ({r['status']})"
        if r.get("flags"):
            line += " | " + flag_text(r["flags"], lang)
        out.append(line)
    return "\n".join(out)


def refs_text(rows: list, lang: str) -> str:
    out = []
    for r in rows:
        if r.get("found"):
            st = f" ({r['status']})" if r.get("status") and r.get("status") != "confirmed" else ""
            out.append(t(lang, "ref_found", code=r.get("code"), date=r.get("tour_date") or "", time=r.get("start_time") or "", title=r.get("title") or "", pax=r.get("pax") or 0, status=st))
        else:
            out.append(t(lang, "ref_missing", code=r.get("code")))
    return "\n".join(out)


def conflicts_text(rows: list, lang: str) -> str:
    if not rows:
        return t(lang, "conf_none")
    lines = [t(lang, "conf_title")]
    for r in rows[:30]:
        parts = [str(v) for k, v in r.items() if v not in (None, "", [], False) and k not in ("id", "tour_id", "user_id")]
        lines.append("- " + ", ".join(parts))
    return "\n".join(lines)


def seats_text(rows: list, n: int, today: date, lang: str) -> str:
    day = day_name(n, today, lang)
    d = (today + timedelta(days=n)).isoformat()
    groups = [r for r in rows if r.get("date") == d and r.get("kind") != "private" and r.get("status") != "cancelled"]
    if not groups:
        return t(lang, "seats_none", day=day)
    out = [t(lang, "seats_title", day=day)]
    for r in sorted(groups, key=lambda x: x.get("start_time") or ""):
        cap, pax = int(r.get("capacity") or 0), int(r.get("pax") or 0)
        kw = {"time": r.get("start_time") or "--:--", "title": r.get("title"), "pax": pax, "cap": cap}
        out.append(t(lang, "seats_nocap", **kw) if cap <= 0 else t(lang, "seats_full", **kw) if pax >= cap else t(lang, "seats_line", free=cap - pax, **kw))
    return "\n".join(out)


# --- database calls (read only), added to the bot's existing ScheduleClient ---
def board(client: "sch.ScheduleClient", d_from: int, d_to: int) -> list:
    return client._call("POST", "rpc/agent_board", body={"d_from": d_from, "d_to": d_to})


def find_refs(client: "sch.ScheduleClient", codes: list) -> list:
    return client._call("POST", "rpc/agent_find_refs", body={"codes": codes})


def conflicts(client: "sch.ScheduleClient", days: int = 7) -> list:
    return client._call("POST", "rpc/agent_conflicts", body={"days": days})


def clean_codes(args: list) -> list:
    return [a.strip(",;") for a in args if CODE.match(a.strip(",;"))][:50]
