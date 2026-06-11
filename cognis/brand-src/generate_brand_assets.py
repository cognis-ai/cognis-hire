#!/usr/bin/env python3
"""Cognis Hire brand-asset generator (theming spec §4.1-4.3, §5.1-5.2).

Regenerates the binary/vector brand assets in this fork from first
principles so provenance is auditable and a rebase can never silently
resurrect upstream FoloUp artwork:

  public/brand-assets/cognis-thumbnail.svg   default OG thumbnail (SVG)
  public/brand-assets/cognis-og.png          1200x630 OG card (scraper-safe)
  public/brand-assets/cognis-icon-192.png    PWA icon
  public/brand-assets/cognis-icon-512.png    PWA icon
  public/browser-client-icon.ico             operator favicon  (upstream-file swap, §5.1)
  public/browser-user-icon.ico               candidate favicon (upstream-file swap, §5.2)

NOT generated here: public/brand-assets/cognis-logo{,-dark}.svg are the
fleet's canonical outlined "CognisAi." wordmark, copied from
cognis-support/public/brand-assets (see the provenance comment inside
each SVG) so every worker ships byte-identical letterforms.

Brand provenance (no invented art):
  * Wordmark = the in-app typographic treatment from src/components/
    brand-wordmark.tsx / navbar.tsx: "Cognis" in ink + second word in the
    brand accent, Inter Bold (font-bold = 700). Mirrors the marketing
    site's typographic CognisAi. wordmark (cognis-platform/apps/marketing/
    components/o/nav.tsx) - the platform brand has no graphic symbol, so
    the favicon/PWA mark is the wordmark's "C" letterform on a brand-color
    field (same derivation, no new art style).
  * Typeface = Inter, taken from THIS fork's own next/font build output
    (.next/static/media/e4af272ccee01ff0-s.p.woff2 - the latin variable
    subset Next.js inlines for the app itself), instanced to static
    weights with fontTools. The rasters therefore use the exact font the
    app renders.
  * Every color below is a @cognis/design-tokens value
    (cognis-platform/packages/design-tokens/tokens.json) - hand-typing
    hexes without token provenance is forbidden (gate2 item 14a).

Run from the repo root (tooling: pip install pillow fonttools brotli):
  python cognis/brand-src/generate_brand_assets.py
"""

from __future__ import annotations

import hashlib
import sys
import tempfile
from pathlib import Path

from fontTools import ttLib
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.varLib import instancer
from PIL import Image, ImageDraw, ImageFont

REPO = Path(__file__).resolve().parents[2]
PUBLIC = REPO / "public"
ASSETS = PUBLIC / "brand-assets"

# The fork's own next/font Inter (latin variable subset). Built by `yarn build`.
INTER_WOFF2 = REPO / ".next" / "static" / "media" / "e4af272ccee01ff0-s.p.woff2"

# ---------------------------------------------------------------------------
# Design tokens — cognis-platform/packages/design-tokens/tokens.json
# (commented literals are the sanctioned brand-sweep mechanism for forks)
# ---------------------------------------------------------------------------
PRIMARY = "#0099ff"  # token: color.brand.primary
NAVY = "#083247"  # token: color.brand.navy
NAVY_DEEP = "#01283c"  # token: color.brand.navy-deep
INK = "#1a1a1a"  # token: color.brand.fg
ON_DARK = "#ffffff"  # token: color.brand.on-dark
ON_DARK_MUTED = (255, 255, 255, 178)  # token: color.brand.on-dark-muted (rgba 0.7)

BRAND_FIRST = "Cognis"
BRAND_SECOND = "Hire"
TAGLINE_L1 = "AI worker that screens candidates"
TAGLINE_L2 = "24/7 without scheduling calls."
DOMAIN = "hire.ai.cognis.group"


def hexrgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def make_static_ttf(weight: int, out_dir: Path) -> Path:
    """Instance the variable Inter subset to a static weight TTF."""
    font = ttLib.TTFont(str(INTER_WOFF2))
    instancer.instantiateVariableFont(font, {"wght": weight}, inplace=True)
    font.flavor = None  # decompress woff2 -> raw sfnt
    out = out_dir / f"inter-{weight}.ttf"
    font.save(str(out))
    return out


# ---------------------------------------------------------------------------
# SVG wordmark (vector paths — no <text>, so rendering never depends on the
# viewer having Inter installed)
# ---------------------------------------------------------------------------


def text_to_paths(font: ttLib.TTFont, text: str) -> tuple[list[tuple[str, float]], float]:
    """Return [(svg_path_d, x_offset_font_units)], total advance width."""
    glyph_set = font.getGlyphSet()
    cmap = font.getBestCmap()
    x = 0.0
    out: list[tuple[str, float]] = []
    for ch in text:
        if ch == " ":
            x += font["hmtx"]["space"][0]
            continue
        gname = cmap[ord(ch)]
        pen = SVGPathPen(glyph_set)
        glyph_set[gname].draw(pen)
        d = pen.getCommands()
        if d:
            out.append((d, x))
        x += font["hmtx"][gname][0]
    return out, x


def wordmark_svg(font: ttLib.TTFont, first_fill: str, accent_fill: str) -> tuple[str, float, float]:
    """Two-tone wordmark as a standalone <g>; returns (group, width_u, height_u)."""
    upem = font["head"].unitsPerEm
    asc = font["OS/2"].sTypoAscender
    desc = font["OS/2"].sTypoDescender  # negative
    space = font["hmtx"]["space"][0]

    first_paths, first_w = text_to_paths(font, BRAND_FIRST)
    second_paths, second_w = text_to_paths(font, BRAND_SECOND)
    second_x0 = first_w + space

    def paths(paths_, fill, dx):
        return "\n".join(
            f'    <path transform="translate({x + dx:.0f} 0)" d="{d}" fill="{fill}"/>'
            for d, x in paths_
        )

    height = asc - desc
    group = (
        f'  <g transform="matrix(1 0 0 -1 0 {asc})">\n'
        + paths(first_paths, first_fill, 0)
        + "\n"
        + paths(second_paths, accent_fill, second_x0)
        + "\n  </g>"
    )
    _ = upem
    return group, second_x0 + second_w, height


def write_thumbnail_svg(font_bold: ttLib.TTFont, font_med: ttLib.TTFont) -> None:
    """800x600 default OG thumbnail (matches the 800x600 the layouts declare).

    SVG is fine for the in-app default path; scrapers get the PNG via the
    NEXT_PUBLIC_BRAND_THUMBNAIL_URL repoint to cognis-og.png (spec §4.2).
    """
    W, H = 800, 600
    group, w_u, h_u = wordmark_svg(font_bold, ON_DARK, PRIMARY)
    # scale wordmark to 56px tall text block, centered
    scale = 64 / h_u
    wm_w = w_u * scale
    wm_x = (W - wm_w) / 2
    wm_y = 236

    dom_paths, dom_w = text_to_paths(font_med, DOMAIN)
    asc = font_med["OS/2"].sTypoAscender
    desc = font_med["OS/2"].sTypoDescender
    dom_h = asc - desc
    dom_scale = 22 / dom_h
    dom_x = (W - dom_w * dom_scale) / 2
    dom_group = "\n".join(
        f'      <path transform="translate({x:.0f} 0)" d="{d}" fill="rgba(255,255,255,0.7)"/>'
        for d, x in dom_paths
    )

    svg = f"""<!-- Cognis Hire OG thumbnail - generated by cognis/brand-src/generate_brand_assets.py.
     Field: design tokens color.brand.navy {NAVY} -> color.brand.navy-deep {NAVY_DEEP}.
     Wordmark: Inter 700, color.brand.on-dark + color.brand.primary {PRIMARY}.
     Domain: color.brand.on-dark-muted. -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="{BRAND_FIRST} {BRAND_SECOND}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="{NAVY}"/>
      <stop offset="1" stop-color="{NAVY_DEEP}"/>
    </linearGradient>
  </defs>
  <rect width="{W}" height="{H}" fill="url(#bg)"/>
  <g transform="translate({wm_x:.0f} {wm_y}) scale({scale:.6f})">
{group}
  </g>
  <rect x="{(W - 180) / 2}" y="{wm_y + 96}" width="180" height="6" rx="3" fill="{PRIMARY}"/>
  <g transform="translate({dom_x:.0f} {wm_y + 134}) scale({dom_scale:.6f})">
    <g transform="matrix(1 0 0 -1 0 {asc})">
{dom_group}
    </g>
  </g>
</svg>
"""
    (ASSETS / "cognis-thumbnail.svg").write_text(svg, encoding="utf-8", newline="\n")
    print("wrote cognis-thumbnail.svg")


# ---------------------------------------------------------------------------
# Rasters (Pillow)
# ---------------------------------------------------------------------------


def gradient(w: int, h: int, c0: str, c1: str) -> Image.Image:
    """Diagonal-ish (vertical) navy gradient field."""
    img = Image.new("RGB", (w, h))
    r0, g0, b0 = hexrgb(c0)
    r1, g1, b1 = hexrgb(c1)
    px = img.load()
    for y in range(h):
        t = y / max(h - 1, 1)
        row = (round(r0 + (r1 - r0) * t), round(g0 + (g1 - g0) * t), round(b0 + (b1 - b0) * t))
        for x in range(w):
            px[x, y] = row
    return img


def write_og_png(ttf700: Path, ttf500: Path) -> None:
    W, H, PAD = 1200, 630, 80
    img = gradient(W, H, NAVY, NAVY_DEEP).convert("RGBA")
    d = ImageDraw.Draw(img)
    f_wm = ImageFont.truetype(str(ttf700), 56)
    f_head = ImageFont.truetype(str(ttf700), 64)
    f_dom = ImageFont.truetype(str(ttf500), 30)

    # wordmark, two-tone (brand-wordmark.tsx treatment)
    d.text((PAD, PAD), BRAND_FIRST, font=f_wm, fill=ON_DARK)
    first_w = d.textlength(BRAND_FIRST + " ", font=f_wm)
    d.text((PAD + first_w, PAD), BRAND_SECOND, font=f_wm, fill=PRIMARY)

    # headline = brand tagline (cognis-brand.ts default)
    d.text((PAD, 290), TAGLINE_L1, font=f_head, fill=ON_DARK)
    d.text((PAD, 372), TAGLINE_L2, font=f_head, fill=ON_DARK)

    # footer: domain + accent rule (mirrors apps/marketing/app/opengraph-image.tsx)
    d.text((PAD, H - PAD - 36), DOMAIN, font=f_dom, fill=ON_DARK_MUTED)
    d.rounded_rectangle(
        (W - PAD - 220, H - PAD - 26, W - PAD, H - PAD - 18), radius=4, fill=PRIMARY
    )
    img.convert("RGB").save(ASSETS / "cognis-og.png", "PNG", optimize=True)
    print("wrote cognis-og.png (1200x630)")


def letter_tile(size: int, bg: str, ttf700: Path) -> Image.Image:
    """The favicon/PWA mark: white Inter-Bold 'C' (wordmark letterform) on a
    brand-color rounded square. 4x supersampled for crisp small sizes."""
    ss = 4
    s = size * ss
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, s - 1, s - 1), radius=round(s * 0.2), fill=bg)
    f = ImageFont.truetype(str(ttf700), round(s * 0.66))
    d.text((s / 2, s * 0.52), "C", font=f, fill=ON_DARK, anchor="mm")
    return img.resize((size, size), Image.LANCZOS)


def write_pwa_icons(ttf700: Path) -> None:
    for size in (192, 512):
        letter_tile(size, PRIMARY, ttf700).save(ASSETS / f"cognis-icon-{size}.png", "PNG")
        print(f"wrote cognis-icon-{size}.png")


def write_ico(path: Path, bg: str, ttf700: Path) -> None:
    # Same size set as the upstream FoloUp icos (spec §5.1): 16..256,
    # PNG-compressed layers. Filename kept so zero code edits are needed.
    sizes = [256, 128, 64, 48, 32, 24, 16]
    imgs = [letter_tile(s, bg, ttf700) for s in sizes]
    imgs[0].save(
        path,
        format="ICO",
        append_images=imgs[1:],
        sizes=[(s, s) for s in sizes],
        bitmap_format="png",
    )
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    print(f"wrote {path.name}  sha256={digest}")


def main() -> int:
    if not INTER_WOFF2.exists():
        print(
            f"missing {INTER_WOFF2} - run `yarn build` first (the generator uses "
            "the app's own next/font Inter subset)",
            file=sys.stderr,
        )
        return 1
    ASSETS.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        tdir = Path(td)
        ttf700 = make_static_ttf(700, tdir)
        ttf500 = make_static_ttf(500, tdir)
        font700 = ttLib.TTFont(str(ttf700))
        font500 = ttLib.TTFont(str(ttf500))

        write_thumbnail_svg(font700, font500)
        write_og_png(ttf700, ttf500)
        write_pwa_icons(ttf700)
        # Operator favicon: brand primary field. Candidate favicon: brand navy
        # field (distinguishable tabs, both token colors).
        write_ico(PUBLIC / "browser-client-icon.ico", PRIMARY, ttf700)
        write_ico(PUBLIC / "browser-user-icon.ico", NAVY, ttf700)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
