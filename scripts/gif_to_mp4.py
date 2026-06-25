"""Convert demo GIF to MP4 for GitHub README playback."""
from __future__ import annotations

import shutil
from pathlib import Path

import imageio.v3 as iio

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "GIF_20260625_200800.gif"
DST_GIF = ROOT / "docs" / "images" / "demo-mock.gif"
DST_MP4 = ROOT / "docs" / "images" / "demo-mock.mp4"


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"Source GIF not found: {SRC}")

    DST_GIF.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(SRC, DST_GIF)
    print(f"copied gif -> {DST_GIF} ({DST_GIF.stat().st_size} bytes)")

    frames = iio.imread(SRC, index=...)
    meta = iio.immeta(SRC)
    duration = meta.get("duration", 0.1)
    fps = min(15, max(8, 1.0 / duration)) if duration else 10
    print(f"frames={len(frames)} fps={fps:.2f}")

    # libx264 requires even width/height
    h, w = frames.shape[1:3]
    pad_h = h if h % 2 == 0 else h + 1
    pad_w = w if w % 2 == 0 else w + 1
    if pad_h != h or pad_w != w:
        import numpy as np

        padded = np.zeros((len(frames), pad_h, pad_w, frames.shape[3]), dtype=frames.dtype)
        padded[:, :h, :w] = frames
        frames = padded
        print(f"padded to {pad_w}x{pad_h}")

    iio.imwrite(
        DST_MP4,
        frames,
        fps=fps,
        codec="libx264",
        quality=8,
        macro_block_size=1,
    )
    print(f"wrote mp4 -> {DST_MP4} ({DST_MP4.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
