#!/usr/bin/env python3
"""Build the release archive: dist/arc-<version>.tgz.

    python3 tools/package.py           # write the archive
    python3 tools/package.py --list     # print what it would contain

The pack is what a project takes: the dictionary, the build inputs, the built stylesheet, the sprite and its
fonts, the docs and the tools that measure. It is not the repository — the 2410-file icon catalogue, the
research notes, the screenshots and the git history stay behind, because a consumer needs to rebuild and
measure, not to re-derive the design — and `index.html` ships, because that page is the reference a
project copies its markup from.

The version comes from tokens/tokens.json alone; a second place that names a release is a defect.
The archive is byte-identical across runs: sorted names, mtime 0 on every entry and on the gzip header.
"""
import gzip
import io
import json
import pathlib
import sys
import tarfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
TOKENS = ROOT / "tokens" / "tokens.json"
OUT = ROOT / "dist"

# Exactly what ships. A directory entry takes everything under it; a file ships as itself.
INCLUDE = [
    "tokens/tokens.json",
    "src/base.css",
    "src/elements.css",
    "dist/arc.css",
    "assets/icons.svg",
    "assets/icons-manifest.json",
    "assets/icons-ISC.txt",
    "assets/fonts",
    "tools/build.py",
    "tools/contrast.py",
    "tools/icons.py",
    "tools/icons_sprite.py",
    "tools/elements.py",
    "tools/markup.py",
    "tools/lint.py",
    "tools/chart.py",
    "tools/package.py",
    "tools/categories.py",
    "tools/gate.sh",
    "tools/shot.mjs",
    "index.html",
    "docs/CANON.md",
    "docs/DECISIONS.md",
    "README.md",
    "AGENTS.md",
    "CHANGELOG.md",
]


def version() -> str:
    return json.loads(TOKENS.read_text(encoding="utf-8"))["meta"]["version"]


def members() -> list[pathlib.Path]:
    out: list[pathlib.Path] = []
    for entry in INCLUDE:
        path = ROOT / entry
        if path.is_dir():
            out.extend(sorted(p for p in path.rglob("*") if p.is_file()))
        elif path.is_file():
            out.append(path)
        else:
            raise SystemExit(f"the pack names a path that does not exist: {entry}")
    return out


def main(argv: list[str]) -> int:
    files = members()
    name = f"arc-{version()}.tgz"
    if "--list" in argv:
        print(f"arc-{version()} · {len(files)} files")
        for path in files:
            print(f"  {path.relative_to(ROOT)}  {path.stat().st_size:>8} B")
        return 0

    target = OUT / name
    OUT.mkdir(parents=True, exist_ok=True)
    # Sorted names, a fixed mtime on every entry, and a gzip header with mtime 0: the same source then builds
    # the same bytes twice. `tarfile.open(..., "w:gz")` stamps the gzip header with the wall clock, so two runs
    # on one tree listed the same files and carried two different sha256 values.
    with target.open("wb") as raw:
        with gzip.GzipFile(fileobj=raw, mode="wb", mtime=0, filename="") as packed:
            with tarfile.open(fileobj=packed, mode="w") as tar:
                for path in files:
                    info = tar.gettarinfo(str(path), arcname=str(path.relative_to(ROOT)))
                    info.mtime = 0
                    info.uid = info.gid = 0
                    info.uname = info.gname = ""
                    with path.open("rb") as handle:
                        tar.addfile(info, handle)
    size = target.stat().st_size
    print(f"{target.relative_to(ROOT)} written — arc {version()}, {len(files)} files, {size / 1024:.0f} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
