"""Run:  python -m unittest test_office   (no network, no Telegram needed; invented data only)"""
import json
import unittest
from datetime import date

import office as of
import schedule as sch

TODAY = date(2026, 11, 19)
ROWS = [{"date": "2026-11-20", "start_time": "08:30", "title": "Test 4x4", "kind": "group", "status": "confirmed", "pax": 7, "capacity": 6, "guide": None, "driver": "Test Driver", "flags": ["NO_GUIDE", "OVER_6_PER_CAR"]},
        {"date": "2026-11-20", "start_time": "15:00", "title": "Test walk", "kind": "group", "status": "confirmed", "pax": 2, "capacity": 10, "guide": "Test Guide", "driver": None, "flags": []},
        {"date": "2026-11-20", "start_time": "09:00", "title": "Test private", "kind": "private", "status": "confirmed", "pax": 2, "capacity": 0, "guide": "Test Guide", "driver": None, "flags": []},
        {"date": "2026-11-21", "start_time": "10:00", "title": "Other day", "kind": "group", "status": "confirmed", "pax": 1, "capacity": 0, "guide": "Test Guide", "flags": []}]


class Office(unittest.TestCase):
    def test_parse_day(self):
        self.assertEqual([of.parse_day(x, TODAY) for x in ("", "today", "завтра", "ხვალ", "24.11", "24.11.2026", "3.12", "18.11", "30.02", "15.12", "abc")],
                         [0, 0, 1, 1, 5, 5, 14, None, None, None, None])

    def test_admin_only(self):
        self.assertTrue(of.is_admin({"role": "admin"}))
        self.assertFalse(of.is_admin({"role": "guide"}))
        self.assertFalse(of.is_admin(None))

    def test_board(self):
        txt = of.board_text(ROWS, 1, TODAY, "en")
        self.assertTrue(txt.startswith("Tomorrow: 3 tours, 11 guests"))
        self.assertIn("08:30 Test 4x4: 7 guests, no guide, Test Driver | no guide, more than 6 per car", txt)
        self.assertNotIn("Other day", txt)
        self.assertEqual(of.board_text([], 0, TODAY, "ru"), "Сегодня: туров нет.")

    def test_seats(self):
        txt = of.seats_text(ROWS, 1, TODAY, "en")
        self.assertIn("08:30 Test 4x4: full (7 of 6)", txt)
        self.assertIn("15:00 Test walk: 8 free of 10", txt)
        self.assertNotIn("Test private", txt)
        self.assertIn("1 booked, no limit set", of.seats_text(ROWS, 2, TODAY, "en"))
        self.assertIn("групповых туров пока нет", of.seats_text(ROWS, 0, TODAY, "ru"))

    def test_refs(self):
        rows = [{"code": "TESTREF1", "found": False}, {"code": "TESTREF2", "found": True, "tour_date": "2026-11-20", "start_time": "15:00", "title": "Test walk", "status": "cancelled", "pax": 2}]
        self.assertEqual(of.refs_text(rows, "en"), "TESTREF1: NOT in the app\nTESTREF2: in the app, 2026-11-20 15:00, Test walk, 2 guests (cancelled)")
        self.assertEqual(of.clean_codes(["ABC12345,", "x", "AB'; drop", "BR-1234567"]), ["ABC12345", "BR-1234567"])

    def test_conflicts(self):
        self.assertEqual(of.conflicts_text([], "ka"), "მომდევნო 7 დღეში კონფლიქტი არ არის.")
        self.assertIn("- double, Test Guide, 2026-11-20", of.conflicts_text([{"kind": "double", "who": "Test Guide", "date": "2026-11-20", "detail": None, "tour_id": "x"}], "en"))

    def test_calls_use_read_only_functions(self):
        calls = []
        c = sch.ScheduleClient("https://x.supabase.co", "KEY", http=lambda m, u, b, h: calls.append((m, u.split("/rest/v1/")[1], json.loads(b))) or "[]")
        of.board(c, 1, 1); of.find_refs(c, ["TESTREF1"]); of.conflicts(c)
        self.assertEqual(calls, [("POST", "rpc/agent_board", {"d_from": 1, "d_to": 1}), ("POST", "rpc/agent_find_refs", {"codes": ["TESTREF1"]}), ("POST", "rpc/agent_conflicts", {"days": 7})])

    def test_three_languages_have_the_same_texts(self):
        for lang in ("ru", "ka"):
            self.assertEqual(set(of.TEXT[lang]), set(of.TEXT["en"]), lang)
            self.assertEqual(set(of.TEXT[lang]["flags"]), set(of.TEXT["en"]["flags"]), lang)


if __name__ == "__main__":
    unittest.main()
