"""Telegram commands for the office (19 Nov 2026): /board, /ref, /conflicts, /seats. Admins only; see office.py.
Registered from schedule_handlers.register(); if this file is missing the rest of the bot keeps working."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

import office as of
import schedule_handlers as sh

log = logging.getLogger(__name__)
TBILISI = timezone(timedelta(hours=4))


def _today():
    return datetime.now(TBILISI).date()


async def _admin(update: Update):
    c, p = await sh._me(update)
    if not p:
        return None, None, "en"
    lang = p.get("lang") or "en"
    if not of.is_admin(p):
        await update.effective_message.reply_text(of.t(lang, "only_admin"))
        return None, None, lang
    return c, p, lang


async def _reply(update: Update, lang: str, fn, *args) -> None:
    try:
        text = await asyncio.to_thread(fn, *args)
    except Exception:  # the database or the network failed: say so, never guess
        log.exception("office command")
        text = of.t(lang, "error")
    await update.effective_message.reply_text(text[:4000])


async def cmd_board(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    c, p, lang = await _admin(update)
    if not c:
        return
    today = _today(); n = of.parse_day(" ".join(ctx.args or []), today)
    if n is None:
        await update.effective_message.reply_text(of.t(lang, "board_far"))
        return
    await _reply(update, lang, lambda: of.board_text(of.board(c, n, n), n, today, lang))


async def cmd_ref(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    c, p, lang = await _admin(update)
    if not c:
        return
    codes = of.clean_codes(ctx.args or [])
    if not codes:
        await update.effective_message.reply_text(of.t(lang, "ref_ask"))
        return
    await _reply(update, lang, lambda: of.refs_text(of.find_refs(c, codes), lang))


async def cmd_conflicts(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    c, p, lang = await _admin(update)
    if c:
        await _reply(update, lang, lambda: of.conflicts_text(of.conflicts(c, 7), lang))


async def cmd_seats(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    c, p, lang = await _admin(update)
    if not c:
        return
    today = _today(); n = of.parse_day(" ".join(ctx.args or []), today) if ctx.args else None
    if n is None:
        await update.effective_message.reply_text(of.t(lang, "seats_ask"))
        return
    await _reply(update, lang, lambda: of.seats_text(of.board(c, n, n), n, today, lang))


def register(app: Application) -> None:
    app.add_handler(CommandHandler("board", cmd_board))
    app.add_handler(CommandHandler("ref", cmd_ref))
    app.add_handler(CommandHandler("conflicts", cmd_conflicts))
    app.add_handler(CommandHandler("seats", cmd_seats))
