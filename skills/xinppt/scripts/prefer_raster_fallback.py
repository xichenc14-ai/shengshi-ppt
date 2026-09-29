#!/usr/bin/env python3
"""Prefer Gamma's embedded raster fallback when an SVG override hides icons."""

import json
import posixpath
import re
import sys
import zipfile
import xml.etree.ElementTree as ET


BLIP = re.compile(rb'(<a:blip\b[^>]*\br:embed="([^"]+)"[^>]*>)(.*?)(</a:blip>)', re.S)
SVG_OVERRIDE = re.compile(
    rb'\s*<a:extLst>\s*<a:ext uri="\{96DAC541-7B7A-43D3-8B79-37D633B846F1\}">'
    rb'\s*<asvg:svgBlip\b[^>]*/>\s*</a:ext>\s*</a:extLst>', re.S
)
REL = '{http://schemas.openxmlformats.org/package/2006/relationships}Relationship'


def raster_fallbacks(archive, names, slide):
    rels_path = f'ppt/slides/_rels/{posixpath.basename(slide)}.rels'
    if rels_path not in names:
        return set()
    root = ET.fromstring(archive.read(rels_path))
    valid = set()
    for relation in root.iter(REL):
        if not relation.attrib.get('Type', '').endswith('/image'):
            continue
        target = relation.attrib.get('Target', '')
        if relation.attrib.get('TargetMode') == 'External':
            continue
        media_path = posixpath.normpath(posixpath.join(posixpath.dirname(slide), target))
        if media_path not in names:
            continue
        data = archive.read(media_path)
        if (media_path.lower().endswith('.png') and data.startswith(b'\x89PNG\r\n\x1a\n')) or (
            media_path.lower().endswith(('.jpg', '.jpeg')) and data.startswith(b'\xff\xd8')
        ):
            valid.add(relation.attrib.get('Id', ''))
    return valid


def prefer_raster(source, destination):
    changed = 0
    skipped = 0
    with zipfile.ZipFile(source) as original, zipfile.ZipFile(destination, 'w') as delivery:
        names = set(original.namelist())
        for entry in original.infolist():
            data = original.read(entry.filename)
            if re.fullmatch(r'ppt/slides/slide\d+\.xml', entry.filename):
                valid = raster_fallbacks(original, names, entry.filename)

                def fix(match):
                    nonlocal changed, skipped
                    if not SVG_OVERRIDE.search(match.group(3)):
                        return match.group(0)
                    if match.group(2).decode('ascii', 'ignore') not in valid:
                        skipped += 1
                        return match.group(0)
                    body, count = SVG_OVERRIDE.subn(b'', match.group(3), count=1)
                    changed += count
                    return match.group(1) + body + match.group(4)

                data = BLIP.sub(fix, data)
            delivery.writestr(entry, data)
    return {'preferredRasterFallbacks': changed, 'skippedSvgOverrides': skipped}


if __name__ == '__main__':
    try:
        print(json.dumps(prefer_raster(sys.argv[1], sys.argv[2]), ensure_ascii=False))
    except Exception as error:
        print(json.dumps({'error': str(error)}, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)
