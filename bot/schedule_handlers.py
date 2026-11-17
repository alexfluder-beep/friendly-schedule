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

from datetime import date

from telegram import BotCommand, InlineKeyboardButton, InlineKeyboardMarkup, KeyboardButton, ReplyKeyboardMarkup, Update
from telegram.ext import Application, CallbackQueryHandler, CommandHandler, ContextTypes, MessageHandler, filters

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


# ---------- shortcuts (17 Nov): a menu of big buttons, open tours, day off, sick today ----------
BUTTONS = ("b_week", "b_tomorrow", "b_open", "b_off", "b_sick", "b_bug")


def menu_keyboard(lang: str) -> ReplyKeyboardMarkup:
    t = lambda k: sch.tr(lang, k)
    return ReplyKeyboardMarkup([[KeyboardButton(t("b_week")), KeyboardButton(t("b_tomorrow"))], [KeyboardButton(t("b_open")), KeyboardButton(t("b_off"))],
                                [KeyboardButton(t("b_sick")), KeyboardButton(t("b_bug"))]], resize_keyboard=True, is_persistent=True)


def button_of(text: str) -> str | None:
    """Which menu button a text is, in any of the three languages."""
    text = (text or "").strip()
    for lang in sch.TEXT:
        for k in BUTTONS:
            if text == sch.tr(lang, k):
                return k
    return None


async def _me(update: Update):
    c = client()
    if not c or not update.effective_user:
        return None, None
    p = await asyncio.to_thread(c.profile, update.effective_user.id)
    if not p:
        await update.effective_message.reply_text(sch.tr("en", "not_linked"))
        return c, None
    return c, p


async def cmd_menu(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    c, p = await _me(update)
    if p:
        await update.effective_message.reply_text(sch.tr(p.get("lang") or "en", "menu"), reply_markup=menu_keyboard(p.get("lang") or "en"))


async def cmd_open(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    c, p = await _me(update)
    if not p:
        return
    lang = p.get("lang") or "en"
    rows = (await asyncio.to_thread(c.open_tours, p))[:8]
    if not rows:
        await update.effective_message.reply_text(sch.tr(lang, "open_none"), reply_markup=open_button(lang))
        return
    kb = InlineKeyboardMarkup([[InlineKeyboardButton(sch.tr(lang, "take_btn", line=sch.open_line(t, lang)), callback_data="take:" + t["id"])] for t in rows])
    await update.effective_message.reply_text(sch.tr(lang, "open_title", role=sch.tr(lang, "role_driver" if p.get("role") == "driver" else "role_guide")), reply_markup=kb)


async def cmd_off(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    c, p = await _me(update)
    if not p:
        return
    if ctx.args:
        await _off_text(update, c, p, " ".join(ctx.args))
        return
    ctx.user_data["await"] = "off"
    await update.effective_message.reply_text(sch.tr(p.get("lang") or "en", "off_ask"))


async def _off_text(update: Update, c, p, text: str) -> None:
    lang = p.get("lang") or "en"
    got = sch.parse_days(text)
    if not got:
        await update.effective_message.reply_text(sch.tr(lang, "off_bad"))
        return
    a, b, note = got
    if a < date.today().isoformat():
        await update.effective_message.reply_text(sch.tr(lang, "off_past"))
        return
    res = await asyncio.to_thread(c.day_off, p, a, b, note)
    rng = sch.day_label(a, lang) + ("" if a == b else " – " + sch.day_label(b, lang))
    await update.effective_message.reply_text(sch.tr(lang, "off_ok" if res == "ok" else "off_twice", range=rng), reply_markup=open_button(lang))


async def cmd_sick(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    c, p = await _me(update)
    if p:
        lang = p.get("lang") or "en"
        await update.effective_message.reply_text(sch.tr(lang, "sick_ask"), reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton(sch.tr(lang, "sick_yes"), callback_data="sick:" + date.today().isoformat())]]))


async def on_button(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    """Inline buttons: take:<tour id>, sick:<day>."""
    q = update.callback_query
    if not q or not q.data:
        return
    c, p = await _me(update)
    await q.answer()
    if not p:
        return
    lang = p.get("lang") or "en"
    kind, _, val = q.data.partition(":")
    if kind == "take":
        res = await asyncio.to_thread(c.take, p, val)
        if res == "ok":
            t = (await asyncio.to_thread(c._call, "GET", "tours", {"id": "eq." + val, "select": "title,date"}) or [{}])[0]
            await q.message.reply_text(sch.tr(lang, "take_ok", title=t.get("title", ""), date=sch.day_label(t["date"], lang) if t.get("date") else ""), reply_markup=open_button(lang))
        else:
            await q.message.reply_text(sch.tr(lang, "take_twice" if res == "twice" else "take_gone"))
    elif kind == "sick":
        day = val if val == date.today().isoformat() else date.today().isoformat()
        res = await asyncio.to_thread(c.day_off, p, day, day, "Telegram", "sick")
        await q.message.reply_text(sch.tr(lang, "sick_ok" if res == "ok" else "off_twice", range=sch.day_label(day, lang)))


async def on_text(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    """Menu buttons and the answer to "Which day?". Other text is left alone (the rest of the bot still sees it)."""
    msg = update.effective_message
    if not msg or not msg.text or msg.text.startswith("/"):
        return
    k = button_of(msg.text)
    if k == "b_week":
        await cmd_week(update, ctx)
    elif k == "b_tomorrow":
        await cmd_tomorrow(update, ctx)
    elif k == "b_open":
        await cmd_open(update, ctx)
    elif k == "b_off":
        await cmd_off(update, ctx)
    elif k == "b_sick":
        await cmd_sick(update, ctx)
    elif k == "b_bug":
        c, p = await _me(update)
        if p:
            await msg.reply_text(sch.tr(p.get("lang") or "en", "bug_help"))
    elif ctx.user_data.get("await") == "off":
        ctx.user_data.pop("await", None)
        c, p = await _me(update)
        if p:
            await _off_text(update, c, p, msg.text)


async def set_commands(app: Application) -> None:
    """The command list Telegram shows next to the text box (all three languages)."""
    for lang in ("en", "ru", "ka"):
        t = lambda k: sch.tr(lang, k)
        cmds = [BotCommand("menu", t("menu")[:60]), BotCommand("week", t("b_week")[2:].strip()[:60]), BotCommand("tomorrow", t("b_tomorrow")[:60]),
                BotCommand("open", t("b_open")[2:].strip()[:60]), BotCommand("off", t("b_off")[2:].strip()[:60]), BotCommand("sick", t("b_sick")[2:].strip()[:60]), BotCommand("bug", t("b_bug")[2:].strip()[:60])]
        try:
            await app.bot.set_my_commands(cmds, language_code=None if lang == "en" else lang)
        except Exception:
            log.exception("set_my_commands %s", lang)


def register(app: Application) -> None:
    app.add_handler(CommandHandler("link", cmd_link))
    app.add_handler(CommandHandler("week", cmd_week))
    app.add_handler(CommandHandler("tomorrow", cmd_tomorrow))
    app.add_handler(CommandHandler(["menu", "start"], cmd_menu))
    app.add_handler(CommandHandler("open", cmd_open))
    app.add_handler(CommandHandler("off", cmd_off))
    app.add_handler(CommandHandler("sick", cmd_sick))
    app.add_handler(CallbackQueryHandler(on_button, pattern=r"^(take|sick):"))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, on_text), group=7)   # its own group: other text handlers keep working
    try:
        import tickets_handlers
        tickets_handlers.register(app)
    except ImportError:      # tickets_handlers.py not copied: the rest keeps working
        log.info("tickets_handlers.py not found: /bug is off")


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
    await set_commands(app)
    while True:
        try:
            await send_pending(app)
        except Exception:
            log.exception("schedule loop")
        await asyncio.sleep(every)
