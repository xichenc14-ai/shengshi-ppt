#!/usr/bin/env python3
"""Render a PPTX with an explicit system-font Fontconfig for macOS LibreOffice."""

import argparse
import os
import subprocess
import tempfile
from pathlib import Path
from xml.sax.saxutils import escape


def font_directories():
    candidates = [
        "/System/Library/Fonts",
        "/Library/Fonts",
        str(Path.home() / "Library/Fonts"),
        "/System/Library/Assets/com_apple_MobileAsset_Font3",
        "/System/Library/Assets/com_apple_MobileAsset_Font4",
        "/usr/share/fonts",
        "/usr/local/share/fonts",
        str(Path.home() / ".local/share/fonts"),
    ]
    return [path for path in candidates if Path(path).is_dir()]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pptx", type=Path)
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("--soffice", required=True, type=Path)
    parser.add_argument("--dpi", type=int, default=120)
    args = parser.parse_args()

    source = args.pptx.resolve(strict=True)
    soffice = args.soffice.resolve(strict=True)
    output_dir = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    fontconfig = output_dir / "fontconfig.xml"
    dirs = "\n".join(f"  <dir>{escape(path)}</dir>" for path in font_directories())
    fontconfig.write_text(
        f'<?xml version="1.0"?>\n<fontconfig>\n{dirs}\n'
        f'  <cachedir>{escape(str(output_dir / "font-cache"))}</cachedir>\n</fontconfig>\n',
        encoding="utf-8",
    )
    env = os.environ.copy()
    env["FONTCONFIG_FILE"] = str(fontconfig)
    with tempfile.TemporaryDirectory(prefix="xinppt-lo-") as profile:
        subprocess.run(
            [str(soffice), f"-env:UserInstallation={Path(profile).as_uri()}",
             "--headless", "--convert-to", "pdf", "--outdir", str(output_dir), str(source)],
            env=env, check=True, capture_output=True, text=True,
        )
    pdf = output_dir / f"{source.stem}.pdf"
    if not pdf.is_file():
        raise RuntimeError("LibreOffice did not produce a PDF")
    subprocess.run(
        ["pdftoppm", "-png", "-r", str(args.dpi), str(pdf), str(output_dir / "slide")],
        check=True, capture_output=True, text=True,
    )
    images = sorted(output_dir.glob("slide-*.png"))
    if not images:
        raise RuntimeError("PDF produced no slide images")
    print(f"{pdf}\nslides={len(images)}")


if __name__ == "__main__":
    main()
