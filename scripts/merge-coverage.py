#!/usr/bin/env python3
"""Merge each workspace package's Cobertura coverage report into a single
report so CI can upload one TypeScript coverage report for the whole repo.

Each `vitest run --coverage` invocation writes `<package>/coverage/cobertura-coverage.xml`
with class filenames relative to that package's own root. This script rewrites
those filenames to be relative to the repository root and combines every
package's `<package>` elements (and totals) into one document, so no
per-line coverage data is lost or recomputed.
"""

import glob
import os
import time
import xml.etree.ElementTree as ET

REPORT_GLOB = '*/*/coverage/cobertura-coverage.xml'
OUTPUT_PATH = 'coverage/cobertura-coverage.xml'


def main() -> None:
    repo_root = os.getcwd()
    report_files = sorted(glob.glob(REPORT_GLOB))
    if not report_files:
        raise SystemExit(f'No coverage reports found matching {REPORT_GLOB!r}')

    merged = ET.Element('coverage')
    packages_el = ET.SubElement(merged, 'packages')

    lines_valid = lines_covered = branches_valid = branches_covered = 0

    for report in report_files:
        project_dir = os.path.dirname(os.path.dirname(report))
        root = ET.parse(report).getroot()
        lines_valid += int(root.get('lines-valid', '0'))
        lines_covered += int(root.get('lines-covered', '0'))
        branches_valid += int(root.get('branches-valid', '0'))
        branches_covered += int(root.get('branches-covered', '0'))

        packages = root.find('packages')
        if packages is None:
            continue
        for package in packages.findall('package'):
            for cls in package.findall('.//class'):
                cls.set('filename', f'{project_dir}/{cls.get("filename")}')
            package.set('name', f'{project_dir.replace("/", ".")}.{package.get("name")}')
            packages_el.append(package)

    sources_el = ET.Element('sources')
    ET.SubElement(sources_el, 'source').text = repo_root
    merged.insert(0, sources_el)

    merged.set('line-rate', f'{(lines_covered / lines_valid) if lines_valid else 0:.4f}')
    merged.set('branch-rate', f'{(branches_covered / branches_valid) if branches_valid else 0:.4f}')
    merged.set('lines-covered', str(lines_covered))
    merged.set('lines-valid', str(lines_valid))
    merged.set('branches-covered', str(branches_covered))
    merged.set('branches-valid', str(branches_valid))
    merged.set('complexity', '0')
    merged.set('version', '0.1')
    merged.set('timestamp', str(int(time.time() * 1000)))

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    tree = ET.ElementTree(merged)
    ET.indent(tree, space='  ')
    tree.write(OUTPUT_PATH, encoding='UTF-8', xml_declaration=True)

    with open(OUTPUT_PATH, 'r+', encoding='utf-8') as f:
        first_line, rest = f.read().split('\n', 1)
        f.seek(0)
        f.write(
            first_line
            + '\n<!DOCTYPE coverage SYSTEM "http://cobertura.sourceforge.net/xml/coverage-04.dtd">\n'
            + rest
        )

    print(f'Merged {len(report_files)} coverage reports into {OUTPUT_PATH}')


if __name__ == '__main__':
    main()
