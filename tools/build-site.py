#!/usr/bin/env python3
"""Build a standalone copy for GitHub Pages (or any web host) into ./docs.

index.html in the project root is written for claude.ai artifacts, which add the
<!doctype>, <head> and <body> wrapper themselves. This script adds that wrapper.
Usage:  python3 tools/build-site.py
"""
import pathlib, re, shutil

root = pathlib.Path(__file__).resolve().parent.parent
src = (root / 'index.html').read_text(encoding='utf-8')
split = src.index('<div id="app">')
head, body = src[:split], src[split:]
title = re.search(r'<title>.*?</title>', head, re.S).group(0)
head = head.replace(title, '')
head = re.sub(r'<meta name="claude:[^>]*>\n?', '', head)

page = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
{title}
<meta name="description" content="A micro:bit block editor with a virtual ELECFREAKS Cutebot robot, challenges and lessons.">
<style>:root{{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);color-scheme:light}}body{{margin:0;font:14px system-ui,sans-serif}}img{{max-width:100%}}</style>
{head.strip()}
</head>
<body>
{body.strip()}
</body>
</html>
'''
out = root / 'docs'
if out.exists():
    shutil.rmtree(out)
(out / 'js').mkdir(parents=True)
(out / 'index.html').write_text(page, encoding='utf-8')
for f in (root / 'js').glob('*.js'):
    shutil.copy(f, out / 'js' / f.name)
shutil.copytree(root / 'vendor', out / 'vendor')
(out / 'media').mkdir()
for f in (root / 'media').iterdir():
    shutil.copy(f, out / 'media' / f.name)
(out / '.nojekyll').write_text('')
print(f'Built {out}')
