"""Run:  python -m unittest test_schedule   (no network, no Telegram needed)"""
import json
import unittest
from datetime import date

import schedule as sch

ME, ZURA = "11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222"


class FakeDb:
    def __init__(self):
        self.calls = []
        self.profiles = [{"id": ME, "name": "Mariam", "lang": "en", "role": "guide", "link_code": "123456", "telegram_id": None, "active": True, "mute": []},
                         {"id": ZURA, "name": "Zura", "lang": "ru", "role": "driver", "link_code": None, "telegram_id": 777, "active": True, "mute": []}]
        self.tours = [{"id": "t1", "date": "2026-11-11", "date_to": None, "start_time": "08:00", "end_time": "19:00", "title": "Kazbegi 4x4 group", "pax": 6, "pickup": "Europe Square", "guide_id": ME, "driver_id": ZURA},
                      {"id": "t2", "date": "2026-11-09", "date_to": "2026-11-12", "start_time": "07:00", "end_time": None, "title": "Svaneti 4 days", "pax": 3, "pickup": None, "guide_id": ME, "driver_id": None}]
        self.notes = [{"id": "n1", "user_id": ZURA, "kind": "tour_cancelled", "params": {"title": "Kazbegi 4x4 group", "date": "2026-11-11", "reason": "Heavy rain"}, "created_at": "x", "tg_sent": False},
                      {"id": "n2", "user_id": ME, "kind": "something_new", "params": {}, "created_at": "y", "tg_sent": False}]

    def http(self, method, url, body, headers):
        self.calls.append((method, url, json.loads(body) if body else None))
        assert headers["apikey"] == "KEY"
        table = url.split("/rest/v1/")[1].split("?")[0]
        q = url.split("?", 1)[1] if "?" in url else ""
        if table == "profiles" and method == "GET":
            if "link_code=eq.123456" in q:
                return json.dumps([p for p in self.profiles if p["link_code"] == "123456"])
            if "telegram_id=eq.555" in q:
                return json.dumps([p for p in self.profiles if p["telegram_id"] == 555])
            return json.dumps(self.profiles)
        if table == "profiles" and method == "PATCH":
            for p in self.profiles:
                if ("id=eq." + p["id"]) in q:
                    p.update(json.loads(body))
            return "[]"
        if table == "tours":
            return json.dumps(self.tours)
        if table == "time_off":
            return json.dumps([{"date_from": "2026-11-15", "date_to": "2026-11-15", "type": "dayoff", "status": "approved"}])
        if table == "notifications" and method == "GET":
            return json.dumps([n for n in self.notes if not n["tg_sent"]])
        if table == "notifications" and method == "PATCH":
            for n in self.notes:
                if n["id"] in q:
                    n["tg_sent"] = True
            return "[]"
        return "[]"


class ScheduleTest(unittest.TestCase):
    def setUp(self):
        self.db = FakeDb()
        self.c = sch.ScheduleClient("https://x.supabase.co", "KEY", http=self.db.http)

    def test_link_by_code(self):
        self.assertIsNone(self.c.link("12", 555))
        self.assertIsNone(self.c.link("000000", 555))
        p = self.c.link("123 456", 555)
        self.assertEqual(p["name"], "Mariam")
        self.assertEqual(self.db.profiles[0]["telegram_id"], 555)
        self.assertIsNone(self.db.profiles[0]["link_code"])      # the code works once
        self.assertEqual(self.c.profile(555)["id"], ME)

    def test_week_has_no_guest_data(self):
        text = sch.week_text(self.c, {"id": ME, "lang": "en"}, today=date(2026, 11, 10))
        self.assertIn("Wed 11.11", text)
        self.assertIn("08:00–19:00 Kazbegi 4x4 group · 6 guests · with Zura", text)
        self.assertIn("Meeting point: Europe Square", text)
        self.assertIn("Svaneti 4 days", text.split("Tue 10.11")[1].split("Wed 11.11")[0])   # multi-day tour shows on each day
        self.assertIn("Day off", text.split("Sun 15.11")[1])
        self.assertIn("No tours.", text.split("Fri 13.11")[1].split("Sat 14.11")[0])
        self.assertNotIn("+995", text)

    def test_tomorrow_in_russian(self):
        text = sch.tomorrow_text(self.c, {"id": ZURA, "lang": "ru"}, today=date(2026, 11, 10))
        self.assertTrue(text.startswith("Завтра"))
        self.assertIn("Ср 11.11", text)

    def test_notices(self):
        rows = self.c.pending_notices()
        self.assertEqual([r["telegram_id"] for r in rows], [777, None])
        self.assertEqual(sch.notice_text(rows[0]), "Тур отменён: Kazbegi 4x4 group, Ср 11.11. Heavy rain")
        self.assertEqual(sch.notice_text(rows[1]), "New notice in Friendly Schedule.")
        self.c.mark_sent([r["id"] for r in rows])
        self.assertEqual(self.c.pending_notices(), [])


if __name__ == "__main__":
    unittest.main()
