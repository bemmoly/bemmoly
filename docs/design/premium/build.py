import base64, json, pathlib, re, sys
sp = pathlib.Path(sys.argv[1]); out = pathlib.Path(sys.argv[2])
r = sp
imgs = {p.stem: 'data:image/jpeg;base64,' + base64.b64encode(p.read_bytes()).decode() for p in sorted((sp / 'screens').glob('*.jpg'))}
js = '\n'.join((r / f).read_text() for f in ['kit.js', 'screens.js', 'foundations.js', 'brand.js', 'content.js', 'app.js'])
mark = re.search(r'const MARK_PATHS = `(.*?)`;', (r / 'kit.js').read_text(), re.S).group(1)
html = (r / 'template.html').read_text()
html = html.replace('{{KIT_CSS}}', (r / 'kit.css').read_text()).replace('{{MARK}}', f'<svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">{mark}</svg>')
html = html.replace('{{IMGS}}', json.dumps(imgs)).replace('{{SCRIPTS}}', js)
out.parent.mkdir(parents=True, exist_ok=True); out.write_text(html)
print(out, round(out.stat().st_size / 1e6, 2), 'MB')
