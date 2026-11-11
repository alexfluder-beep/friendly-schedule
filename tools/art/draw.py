"""Hand-drawn SVG art for Friendly Schedule: 30 avatars and 75 badge pictures.

    python3 tools/art/draw.py

Writes art/avatars/<id>.svg (96 x 96, round, own background), art/badges/<id>.svg
(48 x 48 symbol, previews) and art.js, the small file the app loads.
Badge symbols are drawn in a 48 x 48 box and sit inside the medal face
(circle r 24 at 48,62 of the 96 x 104 medal), so tiers, ring, shine and secret state stay.
Rules from the owner: flat, few shapes, reads at 40 px (avatars) and 64 px (badges),
no text, letters or numbers, no churches, crosses or religious buildings, no glow.
"""
import json
import math
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# palette (the app turns unfinished badges grey by swapping exactly these colours)
P, G, R, L, M, K, S, W = '#f7f5ef', '#314b3c', '#b8441c', '#5b4bb0', '#f0b03f', '#20251f', '#e9e8dc', '#ffffff'


def star(cx, cy, r1, r2, n=5, rot=0):
    pts = []
    for i in range(n * 2):
        a = math.pi * i / n + rot
        r = r1 if i % 2 == 0 else r2
        pts.append(f'{cx + r * math.sin(a):.1f},{cy - r * math.cos(a):.1f}')
    return ' '.join(pts)


def rays(cx, cy, r1, r2, n, start=0, end=360):
    out = []
    for i in range(n):
        a = math.radians(start + (end - start) * i / (n - (0 if end - start == 360 else 1)))
        out.append(f'M{cx + r1 * math.cos(a):.1f} {cy + r1 * math.sin(a):.1f}L{cx + r2 * math.cos(a):.1f} {cy + r2 * math.sin(a):.1f}')
    return ''.join(out)


def person(cx, top, hw, col, head=None):
    """Head and shoulders: head circle, body a rounded hump down to top+22."""
    h = head or hw * 0.62
    return (f'<circle cx="{cx}" cy="{top + h}" r="{h:.1f}" fill="{col}"/>'
            f'<path d="M{cx - hw} {top + 22}V{top + 2 * h + 2 + hw * .9:.1f}a{hw} {hw} 0 0 1 {2 * hw} 0V{top + 22}z" fill="{col}"/>')


def pin(x, tip, s, col):
    r = 6 * s
    cy = tip - 10 * s
    return (f'<path d="M{x} {tip}C{x - 2 * s:.1f} {tip - 4 * s:.1f} {x - r:.1f} {cy + 3 * s:.1f} {x - r:.1f} {cy:.1f}A{r:.1f} {r:.1f} 0 0 1 {x + r:.1f} {cy:.1f}'
            f'C{x + r:.1f} {cy + 3 * s:.1f} {x + 2 * s:.1f} {tip - 4 * s:.1f} {x} {tip}z" fill="{col}"/><circle cx="{x}" cy="{cy:.1f}" r="{2.3 * s:.1f}" fill="{P}"/>')


VAN = (f'<path d="M6 30V18q0-4 4-4h22q4 0 7 4l3.5 5q.5 1 .5 3v4q0 2-2 2H8q-2 0-2-2z" fill="{P}" stroke="{K}" stroke-width="2" stroke-linejoin="round"/>'
       f'<path d="M10 17h10v6H10zM22 17h9v6h-9zM33 17h2.6l3.6 6H33z" fill="{K}"/><rect x="6" y="26" width="37" height="2.4" fill="{R}"/>'
       f'<circle cx="14" cy="32" r="4.2" fill="{K}"/><circle cx="35" cy="32" r="4.2" fill="{K}"/><circle cx="14" cy="32" r="1.6" fill="{S}"/><circle cx="35" cy="32" r="1.6" fill="{S}"/>')


def cal(head, inner):
    return (f'<rect x="9" y="9" width="30" height="28" rx="4" fill="{P}" stroke="{K}" stroke-width="2.4"/>'
            f'<path d="M10.2 13a2.8 2.8 0 0 1 2.8-2.8h22a2.8 2.8 0 0 1 2.8 2.8v4H10.2z" fill="{head}"/>'
            f'<rect x="15" y="5.5" width="3" height="7" rx="1.5" fill="{K}"/><rect x="30" y="5.5" width="3" height="7" rx="1.5" fill="{K}"/>{inner}')


GEO = 'M9 15L19 11V34L9 38ZM19 11L29 15V38L19 34ZM29 15L39 11V34L29 38Z'


def mapfold(inner):
    return (f'<path d="M9 15L19 11V34L9 38ZM29 15L39 11V34L29 38Z" fill="{P}"/><path d="M19 11L29 15V38L19 34Z" fill="{S}"/>'
            f'<path d="{GEO}" fill="none" stroke="{K}" stroke-width="1.8" stroke-linejoin="round"/>{inner}')


def crenel(x0, x1, top, bot, w=6, h=5):
    """A wall with battlements, as path data."""
    d, x, up = f'M{x0} {bot}V{top - h}', x0, True
    while x < x1:
        st = min(w, x1 - x)
        d += f'h{st}'
        x += st
        if x < x1:
            d += f'v{h if up else -h}'
            up = not up
    return d + f'V{bot}Z'


def foot(x, y, a, col):
    return (f'<g transform="translate({x} {y}) rotate({a})" fill="{col}"><ellipse cx="0" cy="3" rx="4.6" ry="7.4"/>'
            f'<circle cx="-3.4" cy="-6.6" r="1.8"/><circle cx="-.7" cy="-8.2" r="1.7"/><circle cx="2" cy="-7.9" r="1.5"/><circle cx="4.2" cy="-6.2" r="1.3"/></g>')


def leaf(cx, cy, a, col=G):
    return f'<ellipse cx="{cx}" cy="{cy}" rx="4.6" ry="2" transform="rotate({a} {cx} {cy})" fill="{col}"/>'


BADGES = {
    'accountant': f'<rect x="13" y="6" width="22" height="36" rx="4" fill="{K}"/><rect x="16" y="9" width="16" height="8" rx="1.5" fill="{M}"/>'
                  f'<path d="M16 21h4v4h-4zM22 21h4v4h-4zM16 27h4v4h-4zM22 27h4v4h-4zM16 33h4v4h-4zM22 33h4v4h-4z" fill="{P}"/><path d="M28 21h4v4h-4zM28 27h4v10h-4z" fill="{R}"/>',
    'armenia1': f'<rect x="12" y="39" width="24" height="2.6" rx="1.3" fill="{K}"/><rect x="10" y="13" width="6" height="28" rx="2" fill="{K}"/><rect x="34" y="23" width="3" height="17" rx="1" fill="{K}"/>'
                f'<rect x="12" y="16" width="29" height="7" rx="3.5" fill="{P}" stroke="{K}" stroke-width="2"/><path d="M19 17h5l-3.5 5h-5zM29 17h5l-3.5 5h-5zM38.5 17h1.5v5h-5z" fill="{R}"/>',
    'armenia10': f'<path d="M8 34L20 13L29 26L33 20L40 34Z" fill="{L}"/><path d="M20 13L25.4 22.4L22.4 21L20 23.6L17.4 21L14.6 22.4Z" fill="{P}"/><path d="M33 20L36.6 25.6L34.6 24.8L32.8 26.4L31.2 24.4L29.8 25.2Z" fill="{P}"/>'
                 f'<path d="M9 34H39Q36 40 24 40Q12 40 9 34Z" fill="{G}"/><path d="M15 36q2-3 4 0q2-3 4 0M27 36q2-3 4 0" fill="none" stroke="{M}" stroke-width="1.8" stroke-linecap="round"/>',
    'bears': f'<circle cx="14" cy="13.5" r="5" fill="{R}"/><circle cx="34" cy="13.5" r="5" fill="{R}"/><circle cx="14" cy="13.5" r="2.4" fill="{K}"/><circle cx="34" cy="13.5" r="2.4" fill="{K}"/>'
             f'<ellipse cx="24" cy="26" rx="14" ry="13" fill="{R}"/><ellipse cx="24" cy="31" rx="7" ry="5.4" fill="{S}"/><ellipse cx="24" cy="28.6" rx="3" ry="2.1" fill="{K}"/><circle cx="18.4" cy="22.6" r="1.9" fill="{K}"/><circle cx="29.6" cy="22.6" r="1.9" fill="{K}"/>',
    'churchkhela': f'<rect x="11" y="11" width="7" height="28" rx="3.5" fill="{R}"/><rect x="20.5" y="11" width="7" height="31" rx="3.5" fill="{L}"/><rect x="30" y="11" width="7" height="26" rx="3.5" fill="{R}"/>'
                   f'<path d="M14.5 15v20M24 15v23M33.5 15v18" stroke="{K}" stroke-width="1.2" stroke-dasharray="1 4" stroke-linecap="round" opacity=".55"/><rect x="10" y="7.5" width="28" height="3.4" rx="1.7" fill="{K}"/>',
    'd100': f'<circle cx="24" cy="24" r="15" fill="none" stroke="{K}" stroke-width="5"/><path d="M10 24h9M29 24h9M24 29v9.5" stroke="{K}" stroke-width="4.5"/><circle cx="24" cy="24" r="5.5" fill="{K}"/><circle cx="24" cy="24" r="2.2" fill="{R}"/>',
    'delica1': VAN,
    'delica10': f'<g transform="translate(3.6 7) scale(.85)">{VAN}</g><polygon points="{star(24, 10, 7, 3)}" fill="{R}" stroke="{K}" stroke-width="1.4" stroke-linejoin="round"/>',
    'diplomat': f'<path d="M13 39Q19 26 35 9" fill="none" stroke="{G}" stroke-width="2.4" stroke-linecap="round"/>' + ''.join(leaf(x, y, a) for x, y, a in [(14, 30, -20), (22, 33, 10), (19, 22, -40), (27, 25, 0), (25, 15, -55), (32, 18, -10), (34, 8, -40)])
                + f'<circle cx="17.5" cy="35.5" r="2.4" fill="{L}"/><circle cx="29" cy="19.5" r="2.4" fill="{L}"/>',
    'double': f'<circle cx="18" cy="21" r="11" fill="{P}" stroke="{K}" stroke-width="2.4"/><path d="M18 14.5V21h5" fill="none" stroke="{K}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'
              f'<circle cx="30" cy="28" r="11" fill="{R}" stroke="{K}" stroke-width="2.4"/><path d="M30 21.5V28h-5" fill="none" stroke="{P}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
    'early': f'<path d="M12 28L6.5 23.5L7.5 31Z" fill="{K}"/><circle cx="22" cy="25" r="12" fill="{R}"/><ellipse cx="24.5" cy="30" rx="8" ry="5.6" fill="{P}"/>'
             f'<path d="M12 25Q20 20 27 28Q19 32 12 25Z" fill="{G}"/><circle cx="27.4" cy="20.6" r="1.9" fill="{K}"/><path d="M33 20.5L39.5 23L33 25.5Z" fill="{K}"/><path d="M19.5 37v4.5M25.5 37v4.5" stroke="{K}" stroke-width="2" stroke-linecap="round"/>',
    'earth': f'<circle cx="24" cy="24" r="16" fill="{L}" stroke="{K}" stroke-width="2"/><path d="M14 13Q20 9.5 25 13Q23 20 16.5 21.5Q12 19.5 14 13ZM27 24Q34 20 38.5 26Q36.5 34 30.5 36Q26.5 32 27 24ZM11 29Q15.5 29 18 33.5Q14 35.5 11 29Z" fill="{G}"/>'
             f'<ellipse cx="24" cy="24" rx="21" ry="6.5" transform="rotate(-22 24 24)" fill="none" stroke="{K}" stroke-width="1.8"/><circle cx="43" cy="17" r="2.8" fill="{R}" transform="rotate(-6 24 24)"/>',
    'explorer': f'<rect x="10" y="12" width="10" height="16" rx="3" fill="{K}"/><rect x="28" y="12" width="10" height="16" rx="3" fill="{K}"/><rect x="19" y="17" width="10" height="7" rx="1.5" fill="{K}"/>'
                f'<circle cx="15" cy="30" r="8" fill="{K}"/><circle cx="33" cy="30" r="8" fill="{K}"/><circle cx="15" cy="30" r="5" fill="{L}"/><circle cx="33" cy="30" r="5" fill="{L}"/><circle cx="13.4" cy="28.4" r="1.6" fill="{P}"/><circle cx="31.4" cy="28.4" r="1.6" fill="{P}"/>',
    'familiar': person(16.5, 15, 8, G, 5.2) + person(31.5, 15, 8, L, 5.2) + f'<path d="M24 14C19.6 11 18 8 20.4 6.3C22 5.3 23.5 6.4 24 7.5C24.5 6.4 26 5.3 27.6 6.3C30 8 28.4 11 24 14Z" fill="{R}"/>',
    'first': f'<ellipse cx="15" cy="39.5" rx="7" ry="2.4" fill="{G}"/><rect x="13" y="6" width="3.2" height="34" rx="1.6" fill="{K}"/><path d="M16 8H36L31 15L36 22H16Z" fill="{R}"/>',
    'firstoff': f'<path d="M15 14q-2-3 0-6M21 14q-2-3 0-6M27 14q-2-3 0-6" fill="none" stroke="{G}" stroke-width="2" stroke-linecap="round"/>'
                f'<path d="M32 22h3a4 4 0 0 1 0 8h-4" fill="none" stroke="{K}" stroke-width="2.6"/><path d="M10 19H32V25A11 11 0 0 1 10 25Z" fill="{R}"/><ellipse cx="21" cy="19.4" rx="11" ry="2" fill="{K}"/><ellipse cx="21" cy="37.5" rx="12.5" ry="2.8" fill="{K}"/>',
    'full': f'<rect x="11" y="20" width="26" height="19" fill="{R}"/><path d="M7 22L24 8L41 22Z" fill="{K}"/><path d="M14 24h6v5h-6zM28 24h6v5h-6zM14 32h6v5h-6z" fill="{M}"/><path d="M27 32h7v7h-7z" fill="{K}"/>',
    'g500': person(14, 16, 7, G) + person(34, 16, 7, L) + person(24, 12, 8, R, 5.4),
    'g1000': ''.join(person(x, 9, 5, c, 3.4) for x, c in [(12, L), (20, G), (28, L), (36, G)]) + ''.join(person(x, 18, 7, c, 4.6) for x, c in [(15, R), (24, K), (33, R)]),
    'geo3': f'<ellipse cx="24" cy="36" rx="16" ry="3.4" fill="{G}"/>' + pin(12, 35, .95, G) + pin(36, 35, .95, L) + pin(24, 30, 1.15, R),
    'geo6': mapfold(f'<path d="M13 33Q16 24 23 26" fill="none" stroke="{R}" stroke-width="2.2" stroke-dasharray="2.6 2.2" stroke-linecap="round"/>' + pin(25, 27, .8, G)),
    'geoall': mapfold(f'<path d="M13 33Q16 24 23 26T35 18" fill="none" stroke="{R}" stroke-width="2.2" stroke-dasharray="2.6 2.2" stroke-linecap="round"/>' + pin(13, 33, .6, L) + pin(23, 27, .7, G) + pin(35, 19, .8, R)),
    'goat': f'<path d="M18 16C14 8 6 8 6.5 16.5M30 16C34 8 42 8 41.5 16.5" fill="none" stroke="{K}" stroke-width="4.4" stroke-linecap="round"/>'
            f'<ellipse cx="12.5" cy="19.5" rx="4.2" ry="2" transform="rotate(20 12.5 19.5)" fill="{R}"/><ellipse cx="35.5" cy="19.5" rx="4.2" ry="2" transform="rotate(-20 35.5 19.5)" fill="{R}"/>'
            f'<path d="M16 14Q24 10 32 14L30 30Q24 39 18 30Z" fill="{R}"/><ellipse cx="24" cy="32.5" rx="4.6" ry="3.6" fill="{S}"/><circle cx="20" cy="21" r="1.8" fill="{K}"/><circle cx="28" cy="21" r="1.8" fill="{K}"/><path d="M22 36.5L24 42L26 36.5Z" fill="{K}"/>',
    'gold': f'<path d="M18 11L15 5.5L21 7.5L24 4.5L27 7.5L33 5.5L30 11Z" fill="{G}"/><path d="M17 14C10 22 8 30 12 36Q24 42 36 36C40 30 38 22 31 14Z" fill="{G}"/><rect x="16.5" y="10.5" width="15" height="4" rx="2" fill="{K}"/>'
            f'<circle cx="24" cy="28" r="6.5" fill="{M}" stroke="{K}" stroke-width="2"/><circle cx="24" cy="28" r="3.2" fill="none" stroke="{K}" stroke-width="1.3"/>',
    'iron': f'<path d="M14 11V24A10 10 0 0 0 34 24V11" fill="none" stroke="{K}" stroke-width="7"/><rect x="9.5" y="7" width="9" height="4.5" rx="1.2" fill="{K}"/><rect x="29.5" y="7" width="9" height="4.5" rx="1.2" fill="{K}"/>'
            f'<g fill="{P}"><circle cx="14" cy="16" r="1.2"/><circle cx="14" cy="22" r="1.2"/><circle cx="34" cy="16" r="1.2"/><circle cx="34" cy="22" r="1.2"/><circle cx="17.5" cy="30.5" r="1.2"/><circle cx="30.5" cy="30.5" r="1.2"/></g>'
            f'<polygon points="{star(24, 40, 3.6, 1.3, 4)}" fill="{R}"/>',
    'khinkali': f'<path d="M8 34C8 22 18 14 24 10C30 14 40 22 40 34Q24 40 8 34Z" fill="{P}" stroke="{K}" stroke-width="2.4" stroke-linejoin="round"/>'
                f'<path d="M24 12L15 33.5M24 12L20.5 35.5M24 12L27.5 35.5M24 12L33 33.5" fill="none" stroke="{K}" stroke-width="1.5" stroke-linecap="round"/><circle cx="24" cy="9" r="3" fill="{P}" stroke="{K}" stroke-width="2"/>',
    'kids50': f'<rect x="9" y="24" width="14" height="14" rx="2" fill="{R}"/><rect x="25" y="24" width="14" height="14" rx="2" fill="{G}"/><rect x="17" y="10" width="14" height="14" rx="2" fill="{L}"/>'
              f'<circle cx="16" cy="31" r="3.6" fill="{P}"/><path d="M32 27.4l3.6 6.2h-7.2z" fill="{P}"/><rect x="21" y="14" width="6" height="6" fill="{P}"/>',
    'kids200': f'<rect x="6" y="15" width="36" height="19" rx="4" fill="{M}" stroke="{K}" stroke-width="2"/><path d="M10 19h6v6h-6zM18 19h6v6h-6zM26 19h6v6h-6zM34.5 19h4.5v6h-4.5z" fill="{K}"/>'
               f'<rect x="7" y="28" width="34" height="2" fill="{K}"/><circle cx="14" cy="34.5" r="4" fill="{K}"/><circle cx="34" cy="34.5" r="4" fill="{K}"/><circle cx="14" cy="34.5" r="1.5" fill="{S}"/><circle cx="34" cy="34.5" r="1.5" fill="{S}"/>',
    'km1000': f'<rect x="12" y="38.5" width="24" height="3" rx="1.5" fill="{G}"/><path d="M14 40V16A10 10 0 0 1 34 16V40Z" fill="{P}" stroke="{K}" stroke-width="2.4" stroke-linejoin="round"/>'
              f'<path d="M15.2 16A8.8 8.8 0 0 1 32.8 16V20.5H15.2Z" fill="{R}"/><path d="M19 27h10M20.5 32h7" stroke="{K}" stroke-width="2.4" stroke-linecap="round"/>',
    'km10000': f'<circle cx="24" cy="16" r="5.5" fill="{R}"/><path d="M6 26H42A18 18 0 0 1 6 26Z" fill="{G}"/><path d="M22.4 26H25.6L33 41H15Z" fill="{K}"/><path d="M24 28.5v2M24 33v3M24 38.2v3" stroke="{P}" stroke-width="1.6"/>',
    'late': f'<circle cx="15.5" cy="13.5" r="4.6" fill="{K}"/><circle cx="32.5" cy="13.5" r="4.6" fill="{K}"/><path d="M16 37.5l-2.5 3.5M32 37.5l2.5 3.5" stroke="{K}" stroke-width="2.6" stroke-linecap="round"/>'
            f'<circle cx="24" cy="26" r="14" fill="{R}"/><circle cx="24" cy="26" r="10.5" fill="{P}"/><path d="M24 19v7l5 3" fill="none" stroke="{K}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    'lazy': f'<rect x="9" y="14" width="30" height="14" rx="4" fill="{L}" stroke="{K}" stroke-width="2"/><rect x="12.5" y="17" width="10.5" height="8" rx="2.5" fill="{P}"/><rect x="25" y="17" width="10.5" height="8" rx="2.5" fill="{P}"/>'
            f'<path d="M10 34v4M38 34v4" stroke="{K}" stroke-width="2.6" stroke-linecap="round"/><rect x="9" y="25" width="30" height="9" rx="2" fill="{L}" stroke="{K}" stroke-width="2"/>'
            f'<rect x="6" y="21" width="7" height="14" rx="3.5" fill="{L}" stroke="{K}" stroke-width="2"/><rect x="35" y="21" width="7" height="14" rx="3.5" fill="{L}" stroke="{K}" stroke-width="2"/>',
    'month20': cal(R, '<g fill="' + G + '">' + ''.join(f'<circle cx="{x}" cy="{y}" r="1.9"/>' for y in (22.5, 27.5, 32.5) for x in (15, 21, 27, 33)) + '</g>'),
    'moon': f'<circle cx="24" cy="24" r="18.5" fill="{K}"/><circle cx="29.5" cy="17" r="7" fill="{M}"/><circle cx="27.5" cy="15.5" r="1.6" fill="{R}" opacity=".5"/><circle cx="31.5" cy="20" r="1.2" fill="{R}" opacity=".5"/>'
            f'<path d="M12 37Q14 28 21 27T24 21" fill="none" stroke="{P}" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="3 2.6"/><circle cx="13" cy="15" r="1.1" fill="{P}"/><circle cx="18" cy="10" r=".9" fill="{P}"/><circle cx="37" cy="30" r="1" fill="{P}"/>',
    'mountain': f'<path d="M8 36L18 17L27 30L32 23L40 36Z" fill="{G}"/><path d="M18 17L22.2 25L19.8 24L18 26L16 24L13.8 25Z" fill="{P}"/><path d="M32 23L35 28.6L33.4 28L32 29.4L30.6 28L29 28.6Z" fill="{P}"/>'
                f'<path d="M21 40Q31 36 25 32.5T27 27" fill="none" stroke="{R}" stroke-width="2.6" stroke-linecap="round"/>',
    'newdest': f'<rect x="22" y="8" width="4" height="32" rx="1.2" fill="{K}"/><path d="M10 11H32L37 15.5L32 20H10Z" fill="{R}"/><path d="M38 23H16L11 27.5L16 32H38Z" fill="{G}"/><ellipse cx="24" cy="40" rx="8" ry="2" fill="{K}"/>',
    'night': f'<path d="M12 15L13 6.5L19.5 12ZM36 15L35 6.5L28.5 12Z" fill="{L}"/><ellipse cx="24" cy="26" rx="13" ry="15" fill="{L}"/><ellipse cx="24" cy="33" rx="7" ry="6" fill="{S}"/>'
             f'<circle cx="18.5" cy="22" r="5.5" fill="{P}"/><circle cx="29.5" cy="22" r="5.5" fill="{P}"/><circle cx="18.5" cy="22" r="2.6" fill="{K}"/><circle cx="29.5" cy="22" r="2.6" fill="{K}"/><path d="M22.4 26H25.6L24 30.5Z" fill="{M}"/>',
    'nights30': f'<path d="M19 15V11.5a2.5 2.5 0 0 1 2.5-2.5h5a2.5 2.5 0 0 1 2.5 2.5V15" fill="none" stroke="{K}" stroke-width="2.6"/><rect x="9" y="15" width="30" height="23" rx="4" fill="{R}"/>'
                f'<rect x="15" y="15" width="3" height="23" fill="{K}"/><rect x="30" y="15" width="3" height="23" fill="{K}"/><circle cx="24" cy="23.5" r="3.4" fill="{M}"/><rect x="20.5" y="29" width="7" height="4.5" rx="1" fill="{P}"/>',
    'nights5': f'<path d="M39 9.5a5 5 0 1 1-6-1.4a4 4 0 0 0 6 1.4z" fill="{M}" stroke="{K}" stroke-width="1.2"/><path d="M10 38L24 13L38 38Z" fill="{G}"/><path d="M24 22L19 38H29Z" fill="{K}"/><rect x="10" y="37" width="28" height="2.6" rx="1.3" fill="{K}"/>',
    'noshow5': f'<path d="M15 10.5H33C33 18 26 21 26 24C26 27 33 30 33 37.5H15C15 30 22 27 22 24C22 21 15 18 15 10.5Z" fill="{P}" stroke="{K}" stroke-width="2"/>'
               f'<path d="M18.5 14H29.5C28.6 18 25 20 24 22C23 20 19.4 18 18.5 14Z" fill="{R}"/><path d="M17.5 37C18.4 32 22 30.2 24 30.2C26 30.2 29.6 32 30.5 37Z" fill="{R}"/>'
               f'<rect x="12" y="7" width="24" height="3.6" rx="1.8" fill="{K}"/><rect x="12" y="37.4" width="24" height="3.6" rx="1.8" fill="{K}"/>',
    'offroad': f'<circle cx="24" cy="24" r="16.5" fill="{K}"/><circle cx="24" cy="24" r="18.2" fill="none" stroke="{K}" stroke-width="3.2" stroke-dasharray="3.3 2.4"/>'
               f'<circle cx="24" cy="24" r="9" fill="{S}" stroke="{R}" stroke-width="2.2"/><circle cx="24" cy="24" r="3.4" fill="{K}"/>',
    'pioneer': f'<path d="M24 36V21" stroke="{G}" stroke-width="3" stroke-linecap="round"/><path d="M24 25C16 25 12 19 12 14.5C18.5 14.5 24 18.5 24 25Z" fill="{G}"/><path d="M24 21C30 21 36 16.5 36 10C30 10 24 14 24 21Z" fill="{G}"/>'
               f'<path d="M10 38Q24 30 38 38Z" fill="{R}"/><polygon points="{star(13, 8, 3.4, 1.2, 4)}" fill="{M}" stroke="{K}" stroke-width=".8"/>',
    'pioneer5': f'<path d="M20 24H28L26 42H22Z" fill="{K}"/><rect x="16.5" y="19.5" width="15" height="5" rx="2" fill="{S}" stroke="{K}" stroke-width="1.8"/>'
                f'<path d="M24 4C30 10 33 14 31 18Q29 20 24 20Q19 20 17 18C15 14 18 10 24 4Z" fill="{R}"/><path d="M24 10.5C27 13.5 28 16 27 18Q24 19 21 18C20 16 21 13.5 24 10.5Z" fill="{M}"/>',
    'planner': cal(G, f'<path d="M16.5 26.5l5 5 10-10" fill="none" stroke="{R}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>'),
    'polyglot': f'<path d="M12 9H26Q30 9 30 13V21Q30 25 26 25H17L11 30V25Q8 25 8 21V13Q8 9 12 9Z" fill="{G}"/><g fill="{P}"><circle cx="13.5" cy="17" r="1.7"/><circle cx="19" cy="17" r="1.7"/><circle cx="24.5" cy="17" r="1.7"/></g>'
                f'<path d="M22 21H36Q40 21 40 25V31Q40 35 36 35V39L31 35H22Q18 35 18 31V25Q18 21 22 21Z" fill="{R}" stroke="{P}" stroke-width="1.8" stroke-linejoin="round"/><path d="M22.5 26.4h13M22.5 30.4h8" stroke="{P}" stroke-width="2" stroke-linecap="round"/>',
    'rest10': f'<rect x="7" y="12" width="4" height="26" rx="2" fill="{K}"/><rect x="37" y="21" width="4" height="17" rx="2" fill="{K}"/><rect x="11" y="22" width="27" height="8" rx="3" fill="{L}"/>'
              f'<rect x="12" y="16.5" width="10" height="6.5" rx="3" fill="{P}" stroke="{K}" stroke-width="1.5"/><rect x="7" y="29" width="34" height="5" rx="1.8" fill="{K}"/>',
    'rested': f'<rect x="8" y="15" width="30" height="18" rx="3.5" fill="{P}" stroke="{K}" stroke-width="2.6"/><rect x="38.5" y="20" width="3.5" height="8" rx="1" fill="{K}"/>'
              f'<g fill="{G}"><rect x="11.5" y="18.5" width="7" height="11" rx="1.4"/><rect x="20" y="18.5" width="7" height="11" rx="1.4"/><rect x="28.5" y="18.5" width="6.5" height="11" rx="1.4"/></g>',
    'reviewer': f'<rect x="15" y="35" width="18" height="4" rx="2" fill="{K}"/><rect x="22.5" y="10" width="3" height="26" fill="{K}"/><rect x="8" y="11" width="32" height="2.8" rx="1.4" fill="{K}"/><circle cx="24" cy="10" r="2.6" fill="{K}"/>'
                f'<path d="M11 13L7 25M11 13L15 25M37 13L33 25M37 13L41 25" stroke="{K}" stroke-width="1.3"/><path d="M6 25H16A5 5 0 0 1 6 25Z" fill="{G}"/><path d="M32 25H42A5 5 0 0 1 32 25Z" fill="{R}"/>',
    'ritual': cal(L, f'<path d="M27 21.5a6.5 6.5 0 1 0 2.6 11.6a5.4 5.4 0 0 1-2.6-11.6z" fill="{M}" stroke="{K}" stroke-width="1.4"/>'),
    'routes10': f'<path d="M14 36C14 26 33 30 33 18" fill="none" stroke="{K}" stroke-width="2.2" stroke-dasharray="3 3" stroke-linecap="round"/>' + pin(14, 38, .8, G) + pin(33, 20, .9, R),
    'season80': f'<path d="{rays(24, 24, 12.5, 18.5, 8)}" stroke="{R}" stroke-width="3.2" stroke-linecap="round"/><circle cx="24" cy="24" r="9.5" fill="{R}"/><circle cx="24" cy="24" r="5" fill="{M}"/>',
    'seasons': f'<g stroke="{P}" stroke-width="1.6" stroke-linejoin="round"><path d="M24 24V7A17 17 0 0 1 41 24Z" fill="{M}"/><path d="M24 24H41A17 17 0 0 1 24 41Z" fill="{R}"/><path d="M24 24V41A17 17 0 0 1 7 24Z" fill="{L}"/><path d="M24 24H7A17 17 0 0 1 24 7Z" fill="{G}"/></g>'
               f'<circle cx="24" cy="24" r="17" fill="none" stroke="{K}" stroke-width="2"/>',
    'seller': f'<g transform="rotate(-12 24 24)"><path d="M8 16H40V21A3 3 0 0 0 40 27V32H8V27A3 3 0 0 0 8 21Z" fill="{R}"/><path d="M31 17.5V30.5" stroke="{P}" stroke-width="1.8" stroke-dasharray="2 2"/>'
              f'<path d="M19 29C14.6 26 13 23 15.4 21.3C17 20.3 18.5 21.4 19 22.5C19.5 21.4 21 20.3 22.6 21.3C25 23 23.4 26 19 29Z" fill="{P}"/></g>',
    'sharpeye': f'<path d="M5 24Q24 6 43 24Q24 42 5 24Z" fill="{P}" stroke="{K}" stroke-width="2.4" stroke-linejoin="round"/><circle cx="24" cy="24" r="8" fill="{G}"/><circle cx="24" cy="24" r="3.8" fill="{K}"/><circle cx="26.6" cy="21.4" r="1.7" fill="{P}"/>',
    'smart': f'<path d="M8 12H11L16.5 33H36" fill="none" stroke="{K}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.4 16H40L36.4 29H15.8Z" fill="{R}" stroke="{K}" stroke-width="2" stroke-linejoin="round"/>'
             f'<path d="M21 17v11M27 17v11M33 17v11" stroke="{P}" stroke-width="1.4"/><circle cx="18.5" cy="37.5" r="3" fill="{K}"/><circle cx="33" cy="37.5" r="3" fill="{K}"/>',
    'solo10': person(18, 14, 9, G, 5.6) + f'<path d="M30.5 40V8" stroke="{K}" stroke-width="2.2" stroke-linecap="round"/><path d="M30.5 9H38.5L36 13L38.5 17H30.5Z" fill="{R}"/>',
    'solo50': f'<path d="M18 16V12a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4" fill="none" stroke="{K}" stroke-width="2.6"/><path d="M33 16L37 6.5L39.6 7.6L36 16Z" fill="{S}" stroke="{K}" stroke-width="1.4" stroke-linejoin="round"/>'
              f'<rect x="8" y="16" width="32" height="22" rx="3" fill="{R}"/><rect x="8" y="23" width="32" height="2.6" fill="{K}"/><rect x="20.5" y="21.3" width="7" height="6" rx="1.2" fill="{M}" stroke="{K}" stroke-width="1.2"/>',
    'steel': f'<path d="M24 7L38 12V23C38 32 32 38 24 41C16 38 10 32 10 23V12Z" fill="{G}" stroke="{K}" stroke-width="2" stroke-linejoin="round"/><path d="M17 24l5 5 9-10" fill="none" stroke="{P}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>',
    't50': f'<path d="M20 12V9a4 4 0 0 1 8 0v3" fill="none" stroke="{K}" stroke-width="2.2"/><rect x="13" y="12" width="22" height="28" rx="6" fill="{G}"/><path d="M13 18a6 6 0 0 1 6-6h10a6 6 0 0 1 6 6v4H13z" fill="{K}"/>'
           f'<rect x="17" y="27" width="14" height="9" rx="2.5" fill="{R}"/><rect x="22" y="20" width="4" height="5" rx="1" fill="{M}"/>',
    't100': f'<path d="M9 37L24 12L39 37Z" fill="{G}"/><path d="M24 12L29.4 21L26.4 19.6L24 22L21.6 19.6L18.6 21Z" fill="{P}"/><path d="M24 12.5V4.5" stroke="{K}" stroke-width="2" stroke-linecap="round"/><path d="M24 5H31L29 7.5L31 10H24Z" fill="{R}"/>',
    't250': f'<path d="M14 11H9a4.5 4.5 0 0 0 5 8M34 11H39a4.5 4.5 0 0 1-5 8" fill="none" stroke="{K}" stroke-width="2.4"/><path d="M14 8H34V16A10 10 0 0 1 14 16Z" fill="{M}" stroke="{K}" stroke-width="2" stroke-linejoin="round"/>'
            f'<path d="M18.5 11.5V16" stroke="{P}" stroke-width="2.2" stroke-linecap="round"/><rect x="21.5" y="25.5" width="5" height="6" fill="{K}"/><rect x="15" y="31" width="18" height="6.5" rx="2" fill="{R}" stroke="{K}" stroke-width="2"/>',
    'team': f'<rect x="11" y="8" width="26" height="32" rx="4" fill="{P}" stroke="{K}" stroke-width="2.2"/><rect x="18" y="5" width="12" height="6" rx="2" fill="{K}"/>'
            f'<path d="M15 17l2.6 2.6 4-4.6M15 25l2.6 2.6 4-4.6M15 33l2.6 2.6 4-4.6" fill="none" stroke="{G}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M25.5 18h7M25.5 26h7M25.5 34h7" stroke="{K}" stroke-width="2.2" stroke-linecap="round"/>',
    'walk100': f'<path d="M15 8H26V23L35 27Q39 29 39 33V35.5H11V29Q11 25 13 23Z" fill="{R}" stroke="{K}" stroke-width="2" stroke-linejoin="round"/><rect x="14" y="6" width="13" height="4" rx="2" fill="{K}"/>'
               f'<path d="M17 13.5h6M17 17.5h6M17 21.5h6" stroke="{P}" stroke-width="1.8" stroke-linecap="round"/><rect x="10.5" y="34" width="29" height="4" rx="1.6" fill="{K}"/>',
    'walk42': foot(17, 29, -12, G) + foot(31, 17, 12, G),
    'week5': f'<path d="M28 5L12 27H22L19 43L36 20H26L30 5Z" fill="{M}" stroke="{K}" stroke-width="2" stroke-linejoin="round"/>',
    'weekend': f'<circle cx="24" cy="9.5" r="4.2" fill="{R}"/><path d="M21 20Q24 17 27 20" fill="none" stroke="{K}" stroke-width="2.6"/><path d="M6 18H21V23A7.5 7.5 0 0 1 6 23ZM27 18H42V23A7.5 7.5 0 0 1 27 23Z" fill="{K}"/>'
               f'<path d="M9.5 22l3.5-2M30.5 22l3.5-2" stroke="{P}" stroke-width="1.6" stroke-linecap="round"/>',
    'welcome': f'<g fill="{R}"><rect x="15" y="20" width="18" height="19" rx="6"/><rect x="15" y="9" width="4.2" height="16" rx="2.1"/><rect x="19.8" y="5.5" width="4.2" height="18" rx="2.1"/><rect x="24.6" y="6.5" width="4.2" height="17" rx="2.1"/><rect x="29" y="10" width="4" height="14" rx="2"/></g>'
               f'<path d="M17 31L10 24" stroke="{R}" stroke-width="5" stroke-linecap="round"/><path d="M36.5 9q3 3 3 7.5M8.5 9.5q-3 3-3 7.5" fill="none" stroke="{K}" stroke-width="2" stroke-linecap="round"/>',
    'wine': f'<path d="M14 8H34Q35 20 30 25Q24 29 18 25Q13 20 14 8Z" fill="{P}" stroke="{K}" stroke-width="2" stroke-linejoin="round"/><path d="M14.7 15H33.3Q33 21 29 24Q24 27.4 19 24Q15 21 14.7 15Z" fill="{L}"/>'
            f'<rect x="22.8" y="27" width="2.4" height="10" fill="{K}"/><ellipse cx="24" cy="38" rx="8" ry="2.2" fill="{K}"/>',
    'year150': '<g fill="' + G + '">' + ''.join(f'<circle cx="{24 + 15 * math.sin(math.pi * i / 6):.1f}" cy="{24 - 15 * math.cos(math.pi * i / 6):.1f}" r="{3 if i % 3 == 0 else 2.2}"/>' for i in range(12)) + '</g>'
               + f'<g transform="translate(9.6 13.6) scale(.6)">{VAN}</g>',
    'newyear': f'<path d="{rays(24, 22, 5, 15, 12)}" stroke="{R}" stroke-width="2.4" stroke-linecap="round"/>' + '<g fill="' + L + '">' + ''.join(f'<circle cx="{24 + 18 * math.cos(math.pi * i / 6):.1f}" cy="{22 + 18 * math.sin(math.pi * i / 6):.1f}" r="1.6"/>' for i in range(12) if i not in (2, 3, 4)) + '</g>'
               + f'<circle cx="24" cy="22" r="3" fill="{M}" stroke="{K}" stroke-width="1"/><path d="M24 25V41" stroke="{K}" stroke-width="1.6" stroke-dasharray="2 2"/>',
    'snow': f'<circle cx="13.5" cy="13.5" r="5" fill="{S}" stroke="{K}" stroke-width="1.6"/><circle cx="34.5" cy="13.5" r="5" fill="{S}" stroke="{K}" stroke-width="1.6"/><ellipse cx="24" cy="25.5" rx="14" ry="13" fill="{S}" stroke="{K}" stroke-width="1.8"/>'
            f'<g fill="{K}"><circle cx="16" cy="19" r="1.6"/><circle cx="32" cy="19" r="1.6"/><circle cx="14" cy="27" r="1.5"/><circle cx="34" cy="27" r="1.5"/><circle cx="24" cy="15.5" r="1.6"/><circle cx="19.5" cy="33" r="1.2"/><circle cx="28.5" cy="33" r="1.2"/></g>'
            f'<ellipse cx="19" cy="24" rx="2.3" ry="1.9" fill="{G}"/><ellipse cx="29" cy="24" rx="2.3" ry="1.9" fill="{G}"/><path d="M21.5 28.5H26.5L24 31.5Z" fill="{R}"/><path d="M24 31.5v2M24 33.5q-2.6 2-4.6.3M24 33.5q2.6 2 4.6.3" fill="none" stroke="{K}" stroke-width="1.3" stroke-linecap="round"/>',
    'comeback': f'<path d="M14 36V22a10 10 0 0 1 20 0v4" fill="none" stroke="{R}" stroke-width="5.5" stroke-linecap="round"/><path d="M26 24.5L34 34L42 24.5Z" fill="{R}" stroke="{R}" stroke-width="1.5" stroke-linejoin="round"/><circle cx="14" cy="39" r="2.4" fill="{K}"/>',
    'hattrick': f'<g stroke="{K}" stroke-width="1.5" stroke-linejoin="round"><polygon points="{star(12, 29, 7, 3)}" fill="{R}"/><polygon points="{star(36, 29, 7, 3)}" fill="{R}"/><polygon points="{star(24, 18, 9, 3.8)}" fill="{M}"/></g>',
    'fri13': f'<path d="M30 38C38 38 41 30 37 25" fill="none" stroke="{K}" stroke-width="3" stroke-linecap="round"/><path d="M16 40C12 36 14 26 19 22H27C32 26 34 36 30 40Z" fill="{K}"/>'
             f'<path d="M15 8L19 12H27L31 8L32 16C32 21 28 23 23 23C18 23 14 21 14 16Z" fill="{K}"/><ellipse cx="19.5" cy="16" rx="1.8" ry="2.3" fill="{M}"/><ellipse cx="26.5" cy="16" rx="1.8" ry="2.3" fill="{M}"/>',
    'sunrise': f'<path d="{rays(24, 30, 16, 20.5, 5, 200, 340)}" stroke="{R}" stroke-width="2.6" stroke-linecap="round"/><path d="M10 30A14 14 0 0 1 38 30Z" fill="{R}"/>'
               f'<rect x="7" y="29.5" width="34" height="2.6" rx="1.3" fill="{K}"/><path d="M14 36.5H34M19 40.5H29" stroke="{G}" stroke-width="2.2" stroke-linecap="round"/>',
}

# ---------- avatars: 96 x 96, own round background, simple and bold ----------
def av(bg, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><clipPath id="c"><circle cx="48" cy="48" r="48"/></clipPath>'
            f'<g clip-path="url(#c)"><rect width="96" height="96" fill="{bg}"/>{body}</g></svg>')


AVATARS = {
    'delica': av(G, f'<circle cx="72" cy="26" r="10" fill="{M}"/><path d="M0 80Q48 66 96 80V96H0Z" fill="{S}"/>'
                    f'<path d="M14 66V44q0-6 6-6h40q6 0 10 5l7 9q2 2 2 5v9q0 3-3 3H17q-3 0-3-3z" fill="{P}"/><path d="M21 44h17v11H21zM42 44h16v11H42zM62 44h4l7 11H62z" fill="{K}"/>'
                    f'<rect x="14" y="60" width="65" height="4" fill="{R}"/><circle cx="30" cy="69" r="8" fill="{K}"/><circle cx="64" cy="69" r="8" fill="{K}"/>'),
    'gergeti': av(L, f'<path d="M10 82L50 20L90 82Z" fill="{P}"/><path d="M50 20L90 82H64L56 54Z" fill="{S}"/>'
                     f'<path d="M0 70Q28 56 54 70T96 64V96H0Z" fill="{G}"/><path d="M34 96Q40 84 54 82T70 72" fill="none" stroke="{M}" stroke-width="4" stroke-linecap="round"/>'),
    'wine': av(G, f'<path d="M30 34C14 50 20 80 40 82C60 80 66 50 52 34Z" fill="{R}"/><rect x="29" y="27" width="24" height="8" rx="4" fill="{K}"/>'
                  f'<path d="M60 48h20l-2 15a8 8 0 0 1-16 0z" fill="{P}"/><path d="M61 55h18l-1 8a8 8 0 0 1-16 0z" fill="{M}"/><rect x="69" y="70" width="2.6" height="10" fill="{P}"/><rect x="63" y="79" width="15" height="3.4" rx="1.7" fill="{P}"/>'),
    'khinkali': av(R, f'<ellipse cx="48" cy="74" rx="42" ry="12" fill="{S}"/>'
                      + ''.join(f'<path d="M{x - w} {y}C{x - w} {y - w} {x - 3} {y - w * 1.45:.0f} {x} {y - w * 1.65:.0f}C{x + 3} {y - w * 1.45:.0f} {x + w} {y - w} {x + w} {y}Q{x} {y + 5} {x - w} {y}Z" fill="{P}" stroke="{K}" stroke-width="2.5" stroke-linejoin="round"/><path d="M{x} {y - w * 1.55:.0f}L{x - w * .55:.0f} {y + 1}M{x} {y - w * 1.55:.0f}L{x + w * .55:.0f} {y + 1}" stroke="{K}" stroke-width="2" stroke-linecap="round"/><circle cx="{x}" cy="{y - w * 1.65:.0f}" r="3.6" fill="{P}" stroke="{K}" stroke-width="2.5"/>'
                                for x, y, w in [(27, 72, 15), (69, 72, 15), (48, 66, 19)])),
    'churchkhela': av(M, f'<rect x="12" y="20" width="72" height="6" rx="3" fill="{K}"/><rect x="22" y="26" width="13" height="56" rx="6.5" fill="{R}"/><rect x="42" y="26" width="13" height="62" rx="6.5" fill="{L}"/><rect x="62" y="26" width="13" height="50" rx="6.5" fill="{R}"/>'),
    'tbilisi': av(S, f'<rect x="16" y="22" width="64" height="80" fill="{P}"/><path d="M8 26L48 6L88 26Z" fill="{R}"/><path d="M26 30h14v18H26zM56 30h14v18H56z" fill="{L}"/>'
                     f'<rect x="8" y="54" width="80" height="26" fill="{G}"/><path d="M12 64H86" stroke="{P}" stroke-width="12" stroke-dasharray="3 5"/><rect x="6" y="52" width="84" height="5" fill="{K}"/>'),
    'narikala': av(M, f'<circle cx="70" cy="28" r="13" fill="{R}"/><path d="M0 80Q48 56 96 80V96H0Z" fill="{G}"/>'
                      f'<path d="{crenel(14, 84, 58, 82)}{crenel(10, 30, 40, 82)}{crenel(64, 84, 44, 82)}" fill="{K}"/><path d="M18 50h3v8h-3zM72 54h3v8h-3z" fill="{M}"/>'),
    'mtskheta': av(G, f'<path d="M0 0H96V30Q72 16 48 28T0 24Z" fill="{S}"/><path d="M-4 34C26 40 42 54 44 100" fill="none" stroke="{P}" stroke-width="15"/><path d="M100 34C70 40 54 54 52 100" fill="none" stroke="{M}" stroke-width="15"/>'),
    'gareji': av(S, ''.join(f'<path d="M0 {y}Q24 {y - 16} 48 {y - 4}T96 {y - 8}V96H0Z" fill="{c}"/>' for y, c in [(44, M), (56, R), (68, L), (80, G)])),
    'vardzia': av(S, f'<path d="M0 30Q30 18 60 24T96 20V96H0Z" fill="{R}"/><path d="M14 40h10v8H14zM34 38h10v8H34zM54 36h10v8H54zM74 34h10v8H74zM22 56h10v8H22zM44 54h10v8H44zM66 52h10v8H66z" fill="{K}"/>'
                     f'<path d="M0 78Q48 66 96 78V96H0Z" fill="{G}"/>'),
    'svaneti': av(L, f'<path d="M-4 66L26 22L48 52L68 16L100 66Z" fill="{P}"/><path d="M0 74Q48 62 96 74V96H0Z" fill="{G}"/>'
                     f'<path d="M28 84V40h14v44Z" fill="{S}"/><path d="M26 41L35 35L44 41Z" fill="{K}"/><path d="M54 86V32h15v54Z" fill="{S}"/><path d="M52 33L61.5 26.5L71 33Z" fill="{K}"/><path d="M33 48h4v6h-4zM59.5 40h4v6h-4zM59.5 56h4v6h-4z" fill="{K}"/>'),
    'tusheti': av(M, f'<path d="M-10 96L30 22L56 58L72 36L106 96Z" fill="{G}"/><path d="M30 22L38 37L30 33L22 38Z" fill="{P}"/>'
                     f'<path d="M64 92L34 80L60 66L38 56L52 46" fill="none" stroke="{S}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'),
    'sabaduri': av(L, f'<path d="M0 50H96V96H0Z" fill="{P}"/><path d="M44 50H52L72 96H24Z" fill="{S}"/>'
                      f'<path d="M14 62L22 20L30 62ZM2 72L10 34L18 72ZM66 62L74 20L82 62ZM78 72L86 34L94 72Z" fill="{G}"/><path d="M22 20L25 34L22 31L19 34ZM74 20L77 34L74 31L71 34Z" fill="{P}"/>'),
    'ararat': av(S, f'<path d="M-4 66L34 18L56 46L66 34L100 66Z" fill="{L}"/><path d="M34 18L44 31L39 29L34 33L29 29L25 30Z" fill="{P}"/><path d="M66 34L72 42L68 41L65 43L62 41Z" fill="{P}"/>'
                    f'<path d="M0 64Q48 56 96 64V96H0Z" fill="{G}"/><g fill="{M}"><circle cx="18" cy="74" r="6"/><circle cx="40" cy="78" r="6"/><circle cx="62" cy="74" r="6"/><circle cx="82" cy="80" r="6"/><circle cx="28" cy="88" r="6"/><circle cx="52" cy="90" r="6"/><circle cx="74" cy="92" r="6"/></g>'),
    'sighnaghi': av(S, f'<path d="M14 66V42h22v24zM38 66V30h22v36zM62 66V44h20v22z" fill="{P}"/><path d="M10 43L25 29L40 43ZM34 31L49 16L64 31ZM58 45L72 32L86 45Z" fill="{R}"/>'
                       f'<path d="M21 48h6v8h-6zM45 38h7v9h-7zM68 50h6v8h-6z" fill="{K}"/><path d="{crenel(-2, 98, 66, 80)}" fill="{G}"/><path d="M0 80H96V96H0Z" fill="{K}"/>'),
    'sulfur': av(G, f'<path d="M0 66H96V96H0Z" fill="{S}"/><path d="M8 68A16 14 0 0 1 40 68ZM36 68A18 16 0 0 1 72 68ZM66 68A14 12 0 0 1 94 68Z" fill="{R}"/>'
                    f'<path d="M22 54h4v-5h-4zM52 52h4v-5h-4zM78 56h4v-4h-4z" fill="{K}"/><path d="M54 40q-4-5 0-10q4-5 0-10M28 44q-3-4 0-8" fill="none" stroke="{P}" stroke-width="3" stroke-linecap="round"/>'),
    'cable': av(S, f'<path d="M0 80Q48 72 96 80V96H0Z" fill="{L}"/><path d="M0 70Q30 56 60 66T96 60V80H0Z" fill="{G}"/><path d="M-4 18L100 44" stroke="{K}" stroke-width="3"/>'
                   f'<path d="M48 30V42" stroke="{K}" stroke-width="3"/><rect x="32" y="40" width="32" height="24" rx="6" fill="{R}"/><rect x="37" y="45" width="22" height="9" rx="2" fill="{P}"/>'),
    'horse': av(S, f'<path d="M0 70Q48 62 96 70V96H0Z" fill="{G}"/><g fill="{R}"><rect x="32" y="42" width="38" height="20" rx="10"/><path d="M36 48L26 24L36 20L46 44Z"/><ellipse cx="24" cy="27" rx="10" ry="6" transform="rotate(-28 24 27)"/>'
                   f'<rect x="35" y="56" width="5.5" height="22" rx="2.5"/><rect x="44" y="56" width="5.5" height="22" rx="2.5"/><rect x="57" y="56" width="5.5" height="22" rx="2.5"/><rect x="64" y="56" width="5.5" height="22" rx="2.5"/></g>'
                   f'<path d="M68 46Q80 50 76 70" fill="none" stroke="{K}" stroke-width="5" stroke-linecap="round"/><path d="M34 22L44 42" stroke="{K}" stroke-width="4" stroke-linecap="round"/>'),
    'eagle': av(M, f'<path d="M0 78L24 58L40 72L62 50L96 80V96H0Z" fill="{G}"/>'
                   f'<path d="M48 44C38 34 22 30 6 34C18 38 24 42 28 46C22 46 16 48 12 52C24 50 36 50 42 52L48 62L54 52C60 50 72 50 84 52C80 48 74 46 68 46C72 42 78 38 90 34C74 30 58 34 48 44Z" fill="{K}"/><circle cx="48" cy="40" r="5" fill="{K}"/>'),
    'dog': av(G, f'<circle cx="48" cy="50" r="24" fill="{M}"/><path d="M26 34C14 38 12 60 20 70C28 70 30 52 32 40Z" fill="{R}"/><path d="M70 34C82 38 84 60 76 70C68 70 66 52 64 40Z" fill="{R}"/>'
                 f'<ellipse cx="48" cy="64" rx="14" ry="11" fill="{P}"/><path d="M44 72q4 8 8 0z" fill="{R}"/><ellipse cx="48" cy="58" rx="6.5" ry="4.6" fill="{K}"/><circle cx="39" cy="45" r="3.4" fill="{K}"/><circle cx="57" cy="45" r="3.4" fill="{K}"/>'),
    'backpack': av(R, f'<path d="M38 26V20a10 10 0 0 1 20 0v6" fill="none" stroke="{K}" stroke-width="5"/><rect x="26" y="26" width="44" height="56" rx="12" fill="{G}"/><path d="M26 38a12 12 0 0 1 12-12h20a12 12 0 0 1 12 12v8H26z" fill="{K}"/>'
                      f'<rect x="34" y="56" width="28" height="18" rx="5" fill="{M}"/><rect x="22" y="80" width="52" height="10" rx="5" fill="{S}"/>'),
    'map': av(G, f'<path d="M14 28L36 20V72L14 80Z" fill="{P}"/><path d="M36 20L60 28V80L36 72Z" fill="{S}"/><path d="M60 28L82 20V72L60 80Z" fill="{P}"/>'
                 f'<path d="M22 66Q34 40 48 56T72 36" fill="none" stroke="{R}" stroke-width="4" stroke-linecap="round" stroke-dasharray="6 5"/><circle cx="72" cy="34" r="6" fill="{R}"/>'),
    'compass': av(G, f'<circle cx="48" cy="18" r="6" fill="none" stroke="{M}" stroke-width="4"/><circle cx="48" cy="52" r="30" fill="{M}"/><circle cx="48" cy="52" r="23" fill="{P}"/>'
                     f'<path d="M48 31L55 52H41Z" fill="{R}"/><path d="M48 73L55 52H41Z" fill="{K}"/><circle cx="48" cy="52" r="4" fill="{K}"/>'),
    'camera': av(L, f'<rect x="38" y="22" width="20" height="12" rx="3" fill="{S}"/><rect x="14" y="30" width="68" height="18" rx="6" fill="{S}"/><rect x="14" y="38" width="68" height="38" rx="6" fill="{K}"/>'
                    f'<circle cx="48" cy="56" r="17" fill="{S}"/><circle cx="48" cy="56" r="11" fill="{K}"/><circle cx="44" cy="52" r="3.4" fill="{P}"/><rect x="66" y="33" width="9" height="5" rx="2" fill="{R}"/>'),
    'coffee': av(R, f'<path d="M50 50L86 36" stroke="{K}" stroke-width="6" stroke-linecap="round"/><path d="M28 36H54L58 74Q41 82 24 74Z" fill="{M}"/><ellipse cx="41" cy="36" rx="13" ry="4" fill="{K}"/>'
                    f'<ellipse cx="60" cy="84" rx="22" ry="5" fill="{S}"/><path d="M48 66H72L69 82H51Z" fill="{P}"/><path d="M58 60q-3-4 0-8M64 60q-3-4 0-8" fill="none" stroke="{P}" stroke-width="3" stroke-linecap="round"/>'),
    'grapes': av(M, f'<path d="M48 26Q50 16 58 10" fill="none" stroke="{K}" stroke-width="4" stroke-linecap="round"/><path d="M50 24Q62 12 78 20Q70 34 50 24Z" fill="{G}"/>'
                    '<g fill="' + L + '">' + ''.join(f'<circle cx="{x}" cy="{y}" r="9"/>' for x, y in [(30, 34), (48, 34), (66, 34), (38, 50), (56, 50), (30, 50), (66, 50), (48, 64), (38, 64), (58, 64), (48, 78)]) + '</g>'
                    + f'<g fill="{P}" opacity=".5">' + ''.join(f'<circle cx="{x - 3}" cy="{y - 3}" r="2.2"/>' for x, y in [(48, 34), (56, 50), (38, 64), (48, 78)]) + '</g>'),
    'pomegranate': av(G, f'<path d="M40 24L44 14L48 22L52 14L56 24Z" fill="{R}"/><circle cx="48" cy="54" r="30" fill="{R}"/><circle cx="48" cy="56" r="21" fill="{P}"/>'
                         '<g fill="' + R + '">' + ''.join(f'<circle cx="{48 + rr * math.cos(a):.1f}" cy="{56 + rr * math.sin(a):.1f}" r="3.6"/>' for rr, n in [(0, 1), (8.5, 6), (16, 12)] for a in [2 * math.pi * i / n + rr for i in range(n)]) + '</g>'),
    'sun': av(S, f'<circle cx="48" cy="44" r="22" fill="{M}"/><path d="M0 60Q30 46 60 60T96 56V96H0Z" fill="{R}"/><path d="M0 74Q40 62 96 76V96H0Z" fill="{G}"/>'),
    'snowflake': av(L, f'<path d="M0 82L96 60V96H0Z" fill="{S}"/><path d="M48 12V64M25.5 25L70.5 51M25.5 51L70.5 25" stroke="{P}" stroke-width="6" stroke-linecap="round"/>'
                       f'<path d="M40 16L48 24L56 16M40 60L48 52L56 60M24.5 34L35.5 31.5L32 21M60 55L60.5 44.5L71.5 42M24.5 42L35.5 44.5L32 55M64 21L60.5 31.5L71.5 34" fill="none" stroke="{P}" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/>'),
    'star': av(K, f'<path d="M0 78Q48 70 96 78V96H0Z" fill="{G}"/><path d="M48 36L76 80H20Z" fill="{R}"/><path d="M48 52L40 80H56Z" fill="{K}"/>'
                  f'<g fill="{M}"><polygon points="{star(20, 26, 6, 2.4, 4)}"/><polygon points="{star(70, 18, 7, 2.8, 4)}"/><circle cx="40" cy="14" r="2"/><circle cx="82" cy="40" r="2"/><circle cx="12" cy="50" r="1.8"/><circle cx="58" cy="30" r="1.6"/></g>'),
}

NAMES = {'delica': 'Delica', 'gergeti': 'Kazbek', 'wine': 'Qvevri wine', 'khinkali': 'Khinkali', 'churchkhela': 'Churchkhela', 'tbilisi': 'Old Tbilisi', 'narikala': 'Narikala',
         'mtskheta': 'Mtskheta rivers', 'gareji': 'Gareji hills', 'vardzia': 'Vardzia', 'svaneti': 'Svan towers', 'tusheti': 'Tusheti road', 'sabaduri': 'Sabaduri forest',
         'ararat': 'Ararat', 'sighnaghi': 'Sighnaghi', 'sulfur': 'Sulfur baths', 'cable': 'Cable car', 'horse': 'Horse', 'eagle': 'Eagle', 'dog': 'Shepherd dog',
         'backpack': 'Backpack', 'map': 'Map', 'compass': 'Compass', 'camera': 'Camera', 'coffee': 'Coffee', 'grapes': 'Grapes', 'pomegranate': 'Pomegranate',
         'sun': 'Sun', 'snowflake': 'Snow', 'star': 'Night sky'}


def mini(s):
    s = re.sub(r'>\s+<', '><', s)
    s = re.sub(r'(\d)\.0(?=[^\d])', r'\1', s)
    return s


def main():
    spec = json.load(open(os.path.join(ROOT, 'tools', 'art', 'prompts.json'), encoding='utf-8'))
    av_ids = [x['id'] for x in spec['avatars']]
    b_ids = [x['id'] for x in spec['badges']]
    missing = [i for i in av_ids if i not in AVATARS] + [i for i in b_ids if i not in BADGES]
    assert not missing, missing
    for d in ('avatars', 'badges'):
        os.makedirs(os.path.join(ROOT, 'art', d), exist_ok=True)
    for i in av_ids:
        open(os.path.join(ROOT, 'art', 'avatars', i + '.svg'), 'w').write(mini(AVATARS[i]) + '\n')
    for i in b_ids:
        open(os.path.join(ROOT, 'art', 'badges', i + '.svg'), 'w').write(
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">{mini(BADGES[i])}</svg>\n')
    data = {'av': {i: mini(AVATARS[i]) for i in av_ids}, 'names': {i: NAMES[i] for i in av_ids}, 'b': {i: mini(BADGES[i]) for i in b_ids}}
    js = ('// Avatar and badge pictures, drawn by hand as SVG (tools/art/draw.py writes this file; edit the drawings there).\n'
          'window.FS_ART=' + json.dumps(data, separators=(',', ':'), ensure_ascii=False) + ';\n')
    open(os.path.join(ROOT, 'art.js'), 'w').write(js)
    print(f'art.js {len(js.encode()) / 1024:.1f} KB, {len(av_ids)} avatars, {len(b_ids)} badges')


if __name__ == '__main__':
    main()
