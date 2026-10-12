#!/usr/bin/env python3
"""Share card, 1200x630 JPEG: docs/card.jpg. Drawn with headless Chrome in the app's colours."""
import subprocess, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "card.jpg"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

PAGE = """<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;overflow:hidden;background:#14110d;color:#f6efe4;position:relative;
 font-family:system-ui,-apple-system,"Noto Sans Thai",Thonburi,sans-serif}
.glow{position:absolute;inset:0;background:radial-gradient(40% 60% at 80% 50%,rgba(242,193,78,.20),transparent 70%)}
h1{position:absolute;left:72px;top:54px;font:800 112px/1.02 system-ui,-apple-system,sans-serif;letter-spacing:-.01em}
.th{position:absolute;left:74px;top:290px;font:600 54px/1.2 Thonburi,"Noto Sans Thai",sans-serif;color:#f2c14e}
.sub{position:absolute;left:74px;top:376px;width:540px;font:400 32px/1.4 system-ui,-apple-system,sans-serif;color:#c9bba6}
.btn{position:absolute;left:74px;top:508px;background:#f2c14e;color:#000;font:700 28px/1 system-ui,sans-serif;padding:20px 26px;border-radius:14px}
svg{position:absolute;right:0;top:0}
</style></head><body><div class="glow"></div>
<h1>Amulet<br>Camera</h1><div class="th">กล้องพระ</div>
<div class="sub">Photograph a small amulet and cut it out from its background, on the phone.</div>
<div class="btn">📷 Take photo · ถ่าย</div>
<svg width="560" height="630" viewBox="0 0 560 630">
<defs>
<pattern id="chk" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="#3a3127"/><rect width="20" height="20" fill="#2a241c"/><rect x="20" y="20" width="20" height="20" fill="#2a241c"/></pattern>
<linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset=".5" stop-color="#f2c14e"/><stop offset="1" stop-color="#a97a1c"/></linearGradient>
<clipPath id="panel"><rect x="40" y="70" width="480" height="490" rx="26"/></clipPath>
</defs>
<rect x="40" y="70" width="480" height="490" rx="26" fill="url(#chk)"/>
<rect x="40" y="70" width="480" height="490" rx="26" fill="none" stroke="#3a3127" stroke-width="4"/>
<g transform="translate(280 315)">
 <path d="M0 -215 C 20 -170 120 -130 130 -40 C 138 40 130 140 120 190 Q 117 215 90 215 L -90 215 Q -117 215 -120 190 C -130 140 -138 40 -130 -40 C -120 -130 -20 -170 0 -215 Z" fill="url(#gold)" stroke="#fff3c4" stroke-width="3" stroke-dasharray="14 9" transform="scale(1.04)"/>
 <path d="M0 -185 C 16 -148 98 -112 106 -34 C 112 36 106 128 98 168 Q 95 186 76 186 L -76 186 Q -95 186 -98 168 C -106 128 -112 36 -106 -34 C -98 -112 -16 -148 0 -185 Z" fill="#c8942a" opacity=".55"/>
 <path d="M0 -150 C 12 -118 72 -92 78 -28 C 82 30 78 96 72 130 L -72 130 C -78 96 -82 30 -78 -28 C -72 -92 -12 -118 0 -150 Z" fill="none" stroke="#7a560f" stroke-width="3" opacity=".7"/>
 <!-- seated figure -->
 <g fill="#6b4a0c">
  <path d="M0 -112 C 6 -122 8 -130 0 -142 C -8 -130 -6 -122 0 -112 Z"/>
  <circle cx="0" cy="-86" r="25"/>
  <path d="M-52 40 C -52 -20 -34 -56 0 -58 C 34 -56 52 -20 52 40 Z"/>
  <ellipse cx="0" cy="62" rx="82" ry="26"/>
 </g>
 <rect x="-86" y="132" width="172" height="22" rx="8" fill="#6b4a0c"/>
 <circle cx="0" cy="-86" r="25" fill="none" stroke="#ffe08a" stroke-width="2" opacity=".5"/>
</g>
<g stroke="#f6efe4" stroke-width="3" fill="none"><path d="M70 120 V90 H100"/><path d="M490 120 V90 H460"/><path d="M70 510 V540 H100"/><path d="M490 510 V540 H460"/></g>
</svg></body></html>"""


def main():
    from PIL import Image
    with tempfile.TemporaryDirectory() as tmp:
        p, shot = Path(tmp) / "c.html", Path(tmp) / "c.png"
        p.write_text(PAGE, encoding="utf-8")
        subprocess.run([CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
                        "--force-device-scale-factor=1", "--window-size=1200,630",
                        f"--screenshot={shot}", p.as_uri()], check=True, capture_output=True, timeout=60)
        Image.open(shot).convert("RGB").crop((0, 0, 1200, 630)).save(OUT, "JPEG", quality=88, optimize=True)
    print(OUT)


if __name__ == "__main__":
    main()
