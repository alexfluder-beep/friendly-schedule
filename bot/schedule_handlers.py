"""Telegram handlers for the schedule bridge. Add to bot.py:

    import schedule_handlers
    ...
    in build_app(), after the other handlers:      schedule_handlers.register(app)
    in post_init(app):                             app.bot_data["schedule_task"] = asyncio.create_task(schedule_handlers.notice_loop(app))

Nothing happens (and nothing breaks) while SCHEDULE_URL / SCHEDULE_SERVICE_KEY are empty.
"""
from __future__ import annotations

import asyncio
import logging
import os

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import Application, CommandHandler, ContextTypes

import schedule as sch

log = logging.getLogger("crewbot.schedule")
APP_URL = os.environ.get("SCHEDULE_APP_URL", "").strip()


def client() -> sch.ScheduleClient | None:
    url, key = os.environ.get("SCHEDULE_URL", "").strip(), os.environ.get("SCHEDULE_SERVICE_KEY", "").strip()
    return sch.ScheduleClient(url, key) if url and key else None


def open_button(lang: str) -> InlineKeyboardMarkup | None:
    return InlineKeyboardMarkup([[InlineKeyboardButton(sch.tr(lang, "open"), url=APP_URL)]]) if APP_URL else None


async def cmd_link(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    c = client()
    if not c or not update.effective_user:
        return
    code = "".join(ctx.args or [])
    p = await asyncio.to_thread(c.link, code, update.effective_user.id)
    lang = (p or {}).get("lang") or "en"
    await update.effective_message.reply_text(sch.tr(lang, "linked", name=p["name"]) if p else sch.tr("en", "bad_code"), reply_markup=open_button(lang) if p else None)


async def _mine(update: Update, fn) -> None:
    c = client()
    if not c or not update.effective_user:
        return
    p = await asyncio.to_thread(c.profile, update.effective_user.id)
    if not p:
        await update.effective_message.reply_text(sch.tr("en", "not_linked"))
        return
    text = await asyncio.to_thread(fn, c, p)
    await update.effective_message.reply_text(text, reply_markup=open_button(p.get("lang") or "en"))


async def cmd_week(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    await _mine(update, sch.week_text)


async def cmd_tomorrow(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    await _mine(update, sch.tomorrow_text)


def register(app: Application) -> None:
    app.add_handler(CommandHandler("link", cmd_link))
    app.add_handler(CommandHandler("week", cmd_week))
    app.add_handler(CommandHandler("tomorrow", cmd_tomorrow))


async def send_pending(app: Application) -> int:
    """Forward schedule notices to Telegram. A notice is marked sent even when the person has no Telegram linked,
    so the queue never grows; people without Telegram still see it in the app."""
    c = client()
    if not c:
        return 0
    rows = await asyncio.to_thread(c.pending_notices)
    sent, done = 0, []
    for r in rows:
        done.append(r["id"])
        if not r.get("telegram_id"):
            continue
        try:
            await app.bot.send_message(r["telegram_id"], sch.notice_text(r), reply_markup=open_button(r.get("lang") or "en"))
            sent += 1
        except Exception:  # a blocked bot or a deleted account must not stop the others
            log.exception("schedule notice to %s failed", r.get("telegram_id"))
    await asyncio.to_thread(c.mark_sent, done)
    return sent


async def notice_loop(app: Application, every: int = 60) -> None:
    await asyncio.sleep(30)
    while True:
        try:
            await send_pending(app)
        except Exception:
            log.exception("schedule loop")
        await asyncio.sleep(every)
