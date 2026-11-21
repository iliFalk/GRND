#!/usr/bin/env python3
"""Write the markup appendix of the canon: one instance of every §8 element, taken from index.html.

    python3 tools/markup.py           # rewrite the block in docs/CANON.md
    python3 tools/markup.py --check   # exit 1 when the block and the page disagree
    python3 tools/markup.py --print   # print the block, write nothing

Why: §8 describes an anatomy in prose, so a consumer copies the child classes out of the showcase by eye and
invents the ones it misses — `arc-item` without `arc-item__text`, `arc-codeblock` flattened into a variant,
`arc-readout` as one span. The block below is the page's own markup, so the two cannot disagree.

The page is the source: whatever `index.html` renders first for a root is what a consumer reads. Attributes are
stripped to `class` (the state lives in prose and in the audit), text becomes `…`, and a demo wrapper with no
system class is flattened so the skeleton shows the element and not the showcase's nesting.
"""
import html
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CANON = ROOT / "docs" / "CANON.md"
PAGE = ROOT / "index.html"

BEGIN = "<!-- markup:begin -->"
END = "<!-- markup:end -->"

HEADING = re.compile(r"^### (8\.\d+) (.+?) — `([^`]+)`", re.M)
CLASS = re.compile(r"\.([a-z][a-z0-9_-]*)")
SYSTEM = re.compile(r"^arc-")
VOID = {
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "source", "track", "wbr", "circle", "path", "line", "rect", "polyline", "use",
}

MAX_DEPTH = 5
MAX_LINES = 60
# Attributes a class cannot carry: the control's kind, its role, and the glyph a `<use>` names.
KEEP = ("type", "role", "href")


class Node:
    __slots__ = ("tag", "classes", "attrs", "children", "text")

    def __init__(self, tag, attrs):
        self.tag = tag
        self.classes = [c for c in attrs.get("class", "").split() if SYSTEM.match(c)]
        self.attrs = [(k, attrs[k]) for k in KEEP if attrs.get(k)]
        self.children: list["Node"] = []
        self.text = False

    def find(self, name):
        """First node in document order carrying a class token, this node included."""
        if name in self.classes:
            return self
        for child in self.children:
            hit = child.find(name)
            if hit:
                return hit
        return None


class Tree(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("#document", {})
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        node = Node(tag, dict(attrs))
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.stack[-1].children.append(Node(tag, dict(attrs)))

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                return

    def handle_data(self, data):
        if data.strip():
            self.stack[-1].text = True


def name(node: Node) -> str:
    attrs = ""
    if node.classes:
        attrs += ' class="%s"' % " ".join(node.classes)
    for key, value in node.attrs:
        if key != "class":
            attrs += ' %s="%s"' % (key, html.escape(value, quote=True))
    return "<" + node.tag + attrs + ">"


def render(node: Node, depth: int, out: list[str]) -> None:
    """Render the subtree while it carries a system class; a plain wrapper is flattened."""
    if not node.classes and not node.attrs:
        before = len(out)
        for child in node.children:
            render(child, depth, out)
        if len(out) == before and node.text:
            out.append("  " * depth + "…")
        return
    open_tag = name(node)
    close_tag = "</%s>" % node.tag
    if node.tag in VOID:
        out.append("  " * depth + open_tag[:-1] + " />")
        return
    kids = list(node.children)
    if depth >= MAX_DEPTH and kids:
        out.append("  " * depth + open_tag + "…" + close_tag)
        return
    inner: list[str] = []
    for child in kids:
        render(child, depth + 1, inner)
    if not inner:
        # a leaf holds text or nothing: `…` marks the text, an empty pair marks the shape
        out.append("  " * depth + open_tag + ("…" if node.text else "") + close_tag)
        return
    if node.text:
        inner.insert(0, "  " * (depth + 1) + "…")
    if len(inner) > MAX_LINES:
        del inner[MAX_LINES:]
        inner.append("  " * (depth + 1) + "<!-- %d child nodes -->" % len(kids))
    out.append("  " * depth + open_tag)
    out.extend(inner)
    out.append("  " * depth + close_tag)


def block(canon: str, page: str) -> str:
    tree = Tree()
    tree.feed(page)
    lines: list[str] = []
    for number, title, selector in HEADING.findall(canon):
        classes = CLASS.findall(selector)
        node = tree.root.find(classes[0]) if classes else None
        lines.append("")
        lines.append("#### %s %s — `%s`" % (number, title, selector))
        lines.append("")
        if node is None:
            lines.append("`%s` is named in §%s and drawn nowhere on `index.html`." % (classes[0], number))
            continue
        out: list[str] = []
        render(node, 0, out)
        lines.append("```html")
        lines.extend(out)
        lines.append("```")
    return "\n".join(lines).strip("\n") + "\n"


def splice(canon: str, body: str) -> str:
    start = canon.index(BEGIN) + len(BEGIN)
    end = canon.index(END)
    return canon[:start] + "\n\n" + body + "\n" + canon[end:]


def main(argv: list[str]) -> int:
    canon = CANON.read_text(encoding="utf-8")
    if BEGIN not in canon or END not in canon:
        print("FAIL docs/CANON.md carries no %s / %s markers" % (BEGIN, END), file=sys.stderr)
        return 1
    body = block(canon, PAGE.read_text(encoding="utf-8"))
    if "--print" in argv:
        sys.stdout.write(body)
        return 0
    if "--check" in argv:
        current = canon[canon.index(BEGIN) + len(BEGIN):canon.index(END)].strip()
        if current != body.strip():
            print("FAIL the markup appendix is stale — run python3 tools/markup.py", file=sys.stderr)
            return 1
        print("markup: %d element instances current" % len(re.findall(r"^#### ", body, re.M)))
        return 0
    CANON.write_text(splice(canon, body), encoding="utf-8")
    print("markup: %d element instances written" % len(re.findall(r"^#### ", body, re.M)))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
