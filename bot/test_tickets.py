"""Run:  python -m unittest test_tickets   (no network, no Telegram needed)"""
import json
import unittest
from types import SimpleNamespace

import schedule as sch

ME = "11111111-1111-1111-1111-111111111111"


class Fake:
    def __init__(self):
        self.calls = []

    def http(self, method, url, body, headers):
        self.calls.append((method, url, body, headers))
        return "[]"


class TicketTests(unittest.TestCase):
    def setUp(self):
        self.f = Fake()
        self.c = sch.ScheduleClient("https://x.supabase.co", "KEY", http=self.f.http)

    def test_picture_goes_to_the_tickets_folder_as_jpeg(self):
        self.c.upload_shot(f"{ME}/abc-0.jpg", b"\xff\xd8jpeg")
        m, url, body, h = self.f.calls[0]
        self.assertEqual(m, "POST")
        self.assertTrue(url.startswith("https://x.supabase.co/storage/v1/object/tickets/" + ME))
        self.assertEqual(h["Content-Type"], "image/jpeg")
        self.assertEqual(body, b"\xff\xd8jpeg")

    def test_ticket_row_is_a_new_telegram_report(self):
        self.c.add_ticket(ME, "tid", "Pay is wrong", [f"{ME}/tid-0.jpg"])
        m, url, body, h = self.f.calls[0]
        row = json.loads(body)
        self.assertEqual((m, url.split("/rest/v1/")[1]), ("POST", "tickets"))
        self.assertEqual((row["source"], row["status"], row["user_id"]), ("telegram", "new", ME))

    def test_answer_notice_names_the_status_in_the_language(self):
        row = {"kind": "ticket_update", "lang": "ru", "params": {"title": "Оплата", "status": "done", "reason": "Исправлено"}}
        self.assertEqual(sch.notice_text(row), "Ваше сообщение «Оплата»: готово. Исправлено")
        row["lang"] = "en"
        self.assertIn("done", sch.notice_text(row))

    def test_pick_photo_takes_the_biggest_that_fits(self):
        try:
            import tickets_handlers as th
        except ImportError:
            self.skipTest("python-telegram-bot not installed")
        sizes = [SimpleNamespace(file_size=10_000), SimpleNamespace(file_size=300_000), SimpleNamespace(file_size=900_000)]
        self.assertEqual(th.pick_photo(sizes).file_size, 300_000)
        self.assertEqual(th.pick_photo([SimpleNamespace(file_size=900_000)]).file_size, 900_000)


if __name__ == "__main__":
    unittest.main()
