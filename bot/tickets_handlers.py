"""Problem reports from Telegram: /bug <text>, optionally with a photo or a short video as the same message.

A video is never stored: ffmpeg (if installed on the bot server) takes up to 4 still pictures from it. Photos are JPEG,
each under 450 KB (the storage folder refuses bigger files). Only linked people (/link) can report.
Registered from schedule_handlers.register(); nothing happens while SCHEDULE_URL / SCHEDULE_SERVICE_KEY are empty.
"""
from __future__ import annotations

import asyncio
import logging
import os
import shutil
import subprocess
import tempfile
import uuid

from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, filters

import schedule as sch

log = logging.getLogger("crewbot.tickets")
MAX_PICTURE = 450_000
MAX_SHOTS = 6


def pick_photo(sizes: list):
    """Telegram sends several sizes of one photo: take the biggest that fits the storage limit, else the smallest."""
    fits = [p for p in sizes if (getattr(p, "file_size", None) or 0) <= MAX_PICTURE]
    return (fits[-1] if fits else sizes[0]) if sizes else None


def frames_from_video(path: str, count: int = 4) -> list:
    """Up to `count` small JPEG pictures taken from a video file. Empty list when ffmpeg is missing or fails."""
    if not shutil.which("ffmpeg"):
        return []
    out = []
    with tempfile.TemporaryDirectory() as d:
        try:
            r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path], capture_output=True, text=True, timeout=20)
            dur = max(float(r.stdout.strip() or 1), 0.5)
        except (OSError, ValueError, subprocess.SubprocessError):
            dur = 4.0
        for i in range(count):
            f = os.path.join(d, f"f{i}.jpg")
            t = dur * (i + 0.5) / count
            try:
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.2f}", "-i", path, "-frames:v", "1", "-vf", "scale='min(900,iw)':-2", "-q:v", "6", f], capture_output=True, timeout=30, check=True)
                data = open(f, "rb").read()
                if 0 < len(data) <= MAX_PICTURE:
                    out.append(data)
            except (OSError, subprocess.SubprocessError):
                continue
    return out


async def cmd_bug(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    import schedule_handlers as sh
    c = sh.client()
    msg = update.effective_message
    if not c or not update.effective_user or not msg:
        return
    prof = await asyncio.to_thread(c.profile, update.effective_user.id)
    if not prof:
        await msg.reply_text(sch.tr("en", "not_linked"))
        return
    lang = prof.get("lang") or "en"
    text = (msg.caption or msg.text or "").strip()
    if text.lower().startswith("/bug"):
        text = text[4:].lstrip("@abcdefghijklmnopqrstuvwxyz_0123456789 ").strip() if text[4:5] == "@" else text[4:].strip()
    if len(text) < 3:
        await msg.reply_text(sch.tr(lang, "bug_help"))
        return
    shots: list = []
    try:
        if msg.photo:
            ph = pick_photo(list(msg.photo))
            f = await ph.get_file()
            shots.append(bytes(await f.download_as_bytearray()))
        elif msg.video or msg.video_note or msg.animation:
            v = msg.video or msg.video_note or msg.animation
            if (v.file_size or 0) <= 19_000_000:      # the Telegram bot limit for downloads is 20 MB
                f = await v.get_file()
                with tempfile.TemporaryDirectory() as d:
                    p = os.path.join(d, "v.mp4")
                    await f.download_to_drive(p)
                    shots = await asyncio.to_thread(frames_from_video, p)
        tid = str(uuid.uuid4())
        paths = []
        for i, data in enumerate(shots[:MAX_SHOTS]):
            path = f"{prof['id']}/{tid}-{i}.jpg"
            await asyncio.to_thread(c.upload_shot, path, data)
            paths.append(path)
        await asyncio.to_thread(c.add_ticket, prof["id"], tid, text, paths)
        admins = await asyncio.to_thread(c.admins)
        await asyncio.to_thread(c.notify, [a for a in admins if a != prof["id"]], "ticket_new", {"title": f"{prof['name']}: {text[:80]}"})
        await msg.reply_text(sch.tr(lang, "bug_ok", num="#" + tid[:6]))
    except Exception:  # noqa: BLE001 - the person gets a plain answer, the log gets the detail
        log.exception("bug report failed")
        await msg.reply_text(sch.tr(lang, "bug_fail"))


def register(app: Application) -> None:
    app.add_handler(CommandHandler("bug", cmd_bug))
    app.add_handler(MessageHandler(filters.CaptionRegex(r"^/bug") & (filters.PHOTO | filters.VIDEO | filters.ANIMATION), cmd_bug))
