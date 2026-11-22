#!/usr/bin/env python3
"""The filter: check a project's markup and stylesheet against the dictionary.

    python3 tools/lint.py <dir> [<dir> ...]   # CSS and HTML under each dir
    python3 tools/lint.py --markup <dir>      # markup only (the system's own showcase runs this in the gate)

A project consumes the system or it re-invents it. This tool decides which, by four rules:

1. **A value in a consumer's CSS is a defect** unless it is `var(--arc-*)`, arithmetic over one, or one of the
   few keywords that carry no design decision (`0`, `auto`, `none`, `inherit`, `currentColor`, `transparent`).
2. **A consumer never restyles a system class.** A selector that names `.arc-*` is an override, and an override
   in one project is a second source of truth for every project.
3. **A class that starts with `arc-` must exist in the system.** A typo reads as a style that silently does
   nothing.
4. **An inline style carries an input, not a value.** `style="--arc-meter-value: 84%"` is the element's input;
   `style="padding: 14px"` is a value typed into markup.

Two sources, one result: the same markup and the same dictionary either pass or fail, and the report names
file:line for every finding. Exit 1 when anything fails.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SYSTEM_CSS = ROOT / "dist" / "arc.css"

# A number with a unit, a colour function, a hex, a timing function — every shape a design value takes.
RAW = re.compile(
    r"#[0-9a-fA-F]{3,8}\b"
    r"|\b(?:rgb|rgba|hsl|hsla)\("
    r"|(?<![\w-])-?\d*\.?\d+(?:px|rem|em|ch|ex|vw|vh|svh|dvh|%|ms|s)\b"
    r"|\bcubic-bezier\("
    r"|\bsteps\("
)
ALLOWED = {"0", "0px", "0s", "0ms", "0%", "100%", "auto", "none", "inherit", "currentcolor", "transparent"}
ARC_SELECTOR = re.compile(r"\.arc-[a-z0-9_-]+")
CLASS_ATTR = re.compile(r'class\s*=\s*"([^"]*)"', re.I)
STYLE_ATTR = re.compile(r'style\s*=\s*"([^"]*)"', re.I)
CUSTOM_DECL = re.compile(r"^\s*--arc-[a-z0-9-]+\s*:")
VAR_CALL = re.compile(r"var\(\s*--arc-[a-z0-9-]+")


def system_classes() -> set[str]:
    if not SYSTEM_CSS.exists():
        raise SystemExit("no dist/arc.css in this tree — build the system first")
    text = SYSTEM_CSS.read_text(encoding="utf-8")
    return set(re.findall(r"\.(arc-[a-z0-9_-]+)", text))


def value_is_raw(value: str) -> bool:
    """A declaration's value is raw when it carries a design value outside var()."""
    stripped = value.strip().rstrip(";").strip()
    if stripped.lower() in ALLOWED:
        return False
    # take away every var(...) call, balanced parentheses included
    without = re.sub(r"var\([^()]*(?:\([^()]*\)[^()]*)*\)", "", stripped)
    for token in RAW.findall(without):
        if token.lower().rstrip(";") not in ALLOWED:
            return True
    return False


def strip_comments(text: str) -> str:
    return re.sub(r"/\*.*?\*/", lambda m: "\n" * m.group(0).count("\n"), text, flags=re.S)


def lint_css(path: pathlib.Path, known: set[str]) -> list[str]:
    findings: list[str] = []
    text = strip_comments(path.read_text(encoding="utf-8"))
    # a rule is everything between a selector and its closing brace, one line or thirty — a parser that walks
    # line by line misses every rule written on a single line, and a consumer's stylesheet is full of those
    for match in re.finditer(r"([^{}]+)\{([^{}]*)\}", text):
        selector = match.group(1).strip()
        body = match.group(2)
        line = text.count("\n", 0, match.start(1)) + 1
        if ARC_SELECTOR.search(selector):
            findings.append(f"{path}:{line}: a selector names a system class — “{selector[-60:]}”")
        for decl in body.split(";"):
            decl = decl.strip()
            if not decl or decl.startswith("--arc-"):
                continue
            _, _, value = decl.partition(":")
            if value_is_raw(value):
                findings.append(f"{path}:{line}: a value outside the dictionary — “{decl[:70]}”")
    return findings


def lint_html(path: pathlib.Path, known: set[str]) -> list[str]:
    findings: list[str] = []
    text = path.read_text(encoding="utf-8")
    for number, line in enumerate(text.splitlines(), 1):
        for attr in CLASS_ATTR.findall(line):
            for name in attr.split():
                if name.startswith("arc-") and name not in known:
                    findings.append(f"{path}:{number}: a class the system does not define — “{name}”")
        for attr in STYLE_ATTR.findall(line):
            for decl in attr.split(";"):
                if not decl.strip() or CUSTOM_DECL.match(decl):
                    continue
                if value_is_raw(decl):
                    findings.append(f"{path}:{number}: a value typed into markup — “{decl.strip()[:60]}”")
    return findings


def main(argv: list[str]) -> int:
    markup_only = "--markup" in argv
    targets = [a for a in argv if not a.startswith("--")] or ["."]
    known = system_classes()
    findings: list[str] = []
    checked = 0
    for target in targets:
        base = pathlib.Path(target).resolve()
        # the vendored system is skipped whole: a consumer's own files are what this tool judges
        skip = {"node_modules", ".git", "dist", "src", "tokens", "tools", "assets", "docs"}
        paths = [base] if base.is_file() else sorted(
            p for p in base.rglob("*")
            if p.is_file() and p.suffix in {".css", ".html"} and not (set(p.parts) & skip)
        )
        for path in paths:
            if path.name == "arc.css" and path.parent.name == "dist":
                continue  # the built system itself
            if path.suffix == ".css" and not markup_only:
                findings += lint_css(path, known)
                checked += 1
            elif path.suffix == ".html":
                findings += lint_html(path, known)
                checked += 1
    for finding in findings:
        print(f"FAIL {finding}")
    if findings:
        print(f"lint: {len(findings)} findings in {checked} files")
        return 1
    print(f"lint: clean — {checked} files against {len(known)} system classes")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
