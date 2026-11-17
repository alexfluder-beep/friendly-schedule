"""Shortcuts for guides and drivers (17 Nov): open tours, take, day off, sick, date parsing.
Run:  python -m unittest test_shortcuts   (no network, no Telegram needed). Invented data only."""
import json
import unittest
from datetime import date

import schedule as sch

ME, BOSS = "11111111-1111-1111-1111-111111111111", "99999999-9999-9999-9999-999999999999"


class Db:
    def __init__(self):
        self.posts = []
        self.open = [{"id": "o1", "date": "2026-11-20", "date_to": None, "start_time": "09:00", "title": "Kazbegi 4x4 group", "pax": 5, "language": "EN", "guide_id": None, "driver_id": "d", "status": "confirmed"},
                     {"id": "o2", "date": "2026-11-21", "date_to": None, "start_time": "11:00", "title": "Tbilisi walking tour", "pax": 8, "language": "EN", "guide_id": None, "driver_id": None, "status": "confirmed"},
                     {"id": "o3", "date": "2026-11-22", "date_to": None, "start_time": "08:00", "title": "Gareji 4x4", "pax": 2, "language": "RU", "guide_id": None, "driver_id": None, "status": "confirmed"}]
        self.mine = [{"id": "m1", "date": "2026-11-22", "date_to": None, "start_time": "10:00", "end_time": None, "title": "Mtskheta", "pax": 2, "pickup": None, "guide_id": ME, "driver_id": None, "extra_guides": []}]
        self.off = []
        self.reqs = []

    def http(self, method, url, body, headers):
        table = url.split("/rest/v1/")[1].split("?")[0]
        q = url.split("?", 1)[1] if "?" in url else ""
        data = json.loads(body) if body else None
        if method == "POST":
            self.posts.append((table, data))
            if table == "change_requests":
                self.reqs.append(data)
            if table == "time_off":
                self.off.append(data)
            return json.dumps([data])
        if table == "tours" and "id=eq." in q:
            tid = q.split("id=eq.")[1].split("&")[0]
            return json.dumps([t for t in self.open if t["id"] == tid])
        if table == "tours" and ("guide_id=is.null" in q or "driver_id=is.null" in q):
            role = "guide_id" if "guide_id=is.null" in q else "driver_id"
            return json.dumps([t for t in self.open if not t[role]])
        if table == "tours":
            return json.dumps(self.mine if "extra_guides" not in q or "or=" in q else [])
        if table == "time_off":
            lte = q.split("date_from=lte.")[1].split("&")[0] if "date_from=lte." in q else "9999"
            return json.dumps([{"date_from": o["date_from"], "date_to": o["date_to"], "type": o["type"], "status": o["status"]} for o in self.off if o["date_from"] <= lte])
        if table == "change_requests":
            return json.dumps([{"tour_id": r["tour_id"], "id": "r"} for r in self.reqs if r["status"] == "pending" and ("tour_id=eq." not in q or ("tour_id=eq." + r["tour_id"]) in q)])
        if table == "profiles":
            return json.dumps([{"id": BOSS}])
        return "[]"


class ShortcutTest(unittest.TestCase):
    def setUp(self):
        self.db = Db()
        self.c = sch.ScheduleClient("https://x.supabase.co", "KEY", http=self.db.http)
        self.me = {"id": ME, "name": "Mariam", "lang": "en", "role": "guide"}

    def test_open_tours_skip_busy_days(self):
        ids = [t["id"] for t in self.c.open_tours(self.me, today=date(2026, 11, 18))]
        self.assertEqual(ids, ["o1", "o2"])            # o3 is on a day she already works

    def test_driver_never_gets_walking_tours(self):
        drv = {**self.me, "role": "driver"}
        ids = [t["id"] for t in self.c.open_tours(drv, today=date(2026, 11, 18))]
        self.assertNotIn("o2", ids)

    def test_take_once_and_tell_the_office(self):
        self.assertEqual(self.c.take(self.me, "o1"), "ok")
        req = self.db.reqs[0]
        self.assertEqual(req["patch"], {"guide_id": ME})
        self.assertEqual(req["status"], "pending")
        self.assertTrue(any(t == "notifications" and d["kind"] == "creq_new" and d["user_id"] == BOSS for t, d in self.db.posts))
        self.assertEqual(self.c.take(self.me, "o1"), "twice")
        self.assertEqual(self.c.open_tours(self.me, today=date(2026, 11, 18))[0]["id"], "o2")   # an asked tour leaves the list

    def test_day_off_waits_sick_counts(self):
        self.assertEqual(self.c.day_off(self.me, "2026-12-24", "2026-12-25", "family"), "ok")
        self.assertEqual(self.db.off[0]["status"], "pending")
        self.assertEqual(self.c.day_off(self.me, "2026-12-25", "2026-12-25"), "twice")
        self.assertEqual(self.c.day_off(self.me, "2026-11-18", "2026-11-18", "", "sick"), "ok")
        self.assertEqual(self.db.off[1]["status"], "approved")
        kinds = [d["kind"] for t, d in self.db.posts if t == "notifications"]
        self.assertEqual(kinds, ["off_requested", "sick_reported"])

    def test_parse_days(self):
        td = date(2026, 11, 18)
        self.assertEqual(sch.parse_days("24.12", td), ("2026-12-24", "2026-12-24", ""))
        self.assertEqual(sch.parse_days("24.12-26.12 family", td), ("2026-12-24", "2026-12-26", "family"))
        self.assertEqual(sch.parse_days("2.1", td), ("2027-01-02", "2027-01-02", ""))       # January means next year
        self.assertEqual(sch.parse_days("2026-12-30 – 2027-01-02", td), ("2026-12-30", "2027-01-02", ""))
        self.assertIsNone(sch.parse_days("tomorrow", td))
        self.assertIsNone(sch.parse_days("31.02", td))

    def test_menu_texts_in_three_languages(self):
        for lang in ("en", "ru", "ka"):
            for k in ("b_week", "b_open", "b_off", "b_sick", "open_title", "take_ok", "off_ok", "sick_ok"):
                self.assertNotEqual(sch.tr(lang, k), k)


if __name__ == "__main__":
    unittest.main()
