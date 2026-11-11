#!/usr/bin/env python3
"""Build builder.html (tokens shared with index.html) and render all options to PNG."""
import re
import subprocess
from pathlib import Path

here = Path(__file__).resolve().parent
idx = (here / "index.html").read_text(encoding="utf-8")
opts = re.search(r"const OPTIONS = \{.*?\n\};", idx, re.S).group(0)
tpl = (here / "builder.template.html").read_text(encoding="utf-8")
(here / "builder.html").write_text(tpl.replace("/*OPTIONS*/", opts), encoding="utf-8")

chrome = next(Path.home().glob(".cache/ms-playwright/chromium-1243/chrome-linux*/chrome"))
out = Path.home() / ".kiro/crew/workspace/shots"
out.mkdir(parents=True, exist_ok=True)
for o in "abc":
    png = out / f"revenant-builder-{o}.png"
    subprocess.run([str(chrome), "--headless=new", "--no-sandbox", "--hide-scrollbars",
                    "--virtual-time-budget=8000", "--window-size=1520,1040",
                    f"--screenshot={png}", f"file://{here}/builder.html?opt={o}"],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=60)
    print(png, png.stat().st_size)
