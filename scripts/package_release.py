"""Create a clean source ZIP using an explicit allowlist; no Git history or user records."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json

root = Path(__file__).resolve().parents[1]
version = json.loads((root / 'package.json').read_text())['version']
public = [
    'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', '.gitignore', 'package.json',
    'test-optimizer.cjs', 'solver-provenance.json', 'DESIGN.md', 'netlify.toml',
    'docs/ALGORITHM.md', 'docs/GITHUB_GUIDE.md', 'docs/DATA_SOURCES.md',
    'docs/data-provenance.json', 'licenses/animal-crossing-MIT.txt',
    'scripts/serve.mjs', 'scripts/package_release.py', '.github/workflows/test.yml',
    'dist/index.html', 'dist/app.js', 'dist/progress.js', 'dist/data.js',
    'dist/optimizer.js', 'dist/worker.js', 'dist/style-v2.css',
    'dist/icon-heads.svg', 'dist/icon-192.png', 'dist/icon-512.png',
    'dist/manifest.webmanifest', 'dist/sw.js', 'dist/.nojekyll',
    'dist/vendor/highs.js', 'dist/vendor/highs.wasm', 'dist/vendor/HiGHS-LICENSE.txt'
]
for name in public:
    source = root / name
    if not source.is_file() or source.is_symlink():
        raise RuntimeError(f'Missing or unsafe package input: {name}')
out = root / 'release'
out.mkdir(exist_ok=True)
archive = out / f'acnh-cooking-profit-v{version}-source.zip'
with ZipFile(archive, 'w', compression=ZIP_DEFLATED) as bundle:
    for name in public:
        bundle.write(root / name, f'acnh-cooking-profit/{name}')
with ZipFile(archive) as bundle:
    assert bundle.testzip() is None
print(f'{archive}\n{len(public)} files, {archive.stat().st_size:,} bytes')

web_archive = out / f'acnh-cooking-profit-v{version}-web.zip'
with ZipFile(web_archive, 'w', compression=ZIP_DEFLATED) as bundle:
    for name in public:
        if name.startswith('dist/'):
            bundle.write(root / name, f'acnh-cooking-profit-web/{name[5:]}')
with ZipFile(web_archive) as bundle:
    assert bundle.testzip() is None
    assert 'acnh-cooking-profit-web/index.html' in bundle.namelist()
print(f'{web_archive}\n{web_archive.stat().st_size:,} bytes')
