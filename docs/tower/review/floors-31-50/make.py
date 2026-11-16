"""
Makes index.html from the floor entries (f31.md ... f50.md) and the list for the user (for-the-user.md), with their pictures (pics/).
    python docs/tower/review/floors-31-50/make.py
The entries use a small part of Markdown: `#`/`##`/`###` headings, `-` bullets, `![caption](pics/x.jpg)` pictures (each its own
line; two or more in a row are laid side by side), `**bold**`, `` `code` `` and plain paragraphs.
"""
import html
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent


def inline(s):
    s = html.escape(s, quote=False)
    s = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', s)
    s = re.sub(r'`(.+?)`', r'<code>\1</code>', s)
    return s


def render(md):
    out, pics, bullets, para = [], [], [], []

    def flush():
        if pics:
            out.append('<div class="pics">' + ''.join(f'<figure><a href="{p}"><img loading="lazy" src="{p}" alt="{html.escape(c)}"></a><figcaption>{inline(c)}</figcaption></figure>' for c, p in pics) + '</div>')
            pics.clear()
        if bullets:
            out.append('<ul>' + ''.join(f'<li>{inline(b)}</li>' for b in bullets) + '</ul>')
            bullets.clear()
        if para:
            out.append(f'<p>{inline(" ".join(para))}</p>')
            para.clear()

    for line in md.splitlines():
        m = re.match(r'!\[(.*?)\]\((.+?)\)\s*$', line.strip())
        if m:
            if bullets or para: flush()
            pics.append((m.group(1), m.group(2)))
            continue
        if line.startswith('#'):
            flush()
            k = len(line) - len(line.lstrip('#'))
            out.append(f'<h{k + 1}>{inline(line[k:].strip())}</h{k + 1}>')
        elif line.startswith('- '):
            if pics or para: flush()
            bullets.append(line[2:].strip())
        elif line.startswith('  ') and bullets:
            bullets[-1] += ' ' + line.strip()
        elif not line.strip():
            flush()
        else:
            if pics or bullets: flush()
            para.append(line.strip())
    flush()
    return '\n'.join(out)


def main():
    parts = []
    top = HERE / 'README.md'
    if top.exists(): parts.append(f'<section>{render(top.read_text(encoding="utf-8"))}</section>')
    user = HERE / 'for-the-user.md'
    if user.exists(): parts.append(f'<section id="user">{render(user.read_text(encoding="utf-8"))}</section>')
    floors = sorted(HERE.glob('f[0-9][0-9].md'))
    nav = ' '.join(f'<a href="#{f.stem}">{f.stem[1:]}</a>' for f in floors)
    for f in floors:
        parts.append(f'<section id="{f.stem}">{render(f.read_text(encoding="utf-8"))}</section>')
    page = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Climb review 31-50</title><style>
:root{{--bg:#14110f;--card:#1f1a16;--ink:#efe6d4;--dim:#b3a68c;--gold:#e0b45c;--line:#3a3128}}
body{{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 Georgia,serif}}
main{{max-width:980px;margin:0 auto;padding:12px 16px 60px}}
nav{{position:sticky;top:0;background:var(--bg);padding:8px 0;border-bottom:1px solid var(--line);z-index:2;font:14px ui-sans-serif,system-ui}}
nav a{{color:var(--gold);margin-right:8px;text-decoration:none;display:inline-block;padding:2px 0}}
section{{scroll-margin-top:72px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:4px 16px 12px;margin:16px 0}}
h1,h2,h3{{color:var(--gold);font-weight:600;line-height:1.25}} h2{{font-size:1.35em}} h3{{font-size:1.05em;margin-bottom:4px}}
code{{font:13px ui-monospace,monospace;color:#d9c79e;word-break:break-word}}
.pics{{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;margin:10px 0}}
figure{{margin:0}} img{{width:100%;border-radius:6px;border:1px solid var(--line);display:block}}
figcaption{{color:var(--dim);font-size:13px;margin-top:3px;font-family:ui-sans-serif,system-ui}}
li{{margin:3px 0}}
</style></head><body><main><nav>Floors: {nav} · <a href="#user">for you</a></nav>
{''.join(parts)}
</main></body></html>"""
    (HERE / 'index.html').write_text(page, encoding='utf-8')
    print('index.html,', len(floors), 'floors')


if __name__ == '__main__':
    main()
