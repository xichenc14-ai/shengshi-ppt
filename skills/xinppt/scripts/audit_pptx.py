#!/usr/bin/env python3
"""Check PPTX slide count, embedded image targets, and image payloads."""

import json
import posixpath
import re
import sys
import zipfile
import xml.etree.ElementTree as ET


def audit(path: str, expected_slides: int) -> dict:
    result = {
        "valid": False,
        "expectedSlides": expected_slides,
        "slideCount": 0,
        "embeddedMediaCount": 0,
        "pictureCount": 0,
        "slidesWithoutPictures": [],
        "svgMediaCount": 0,
        "svgReferenceCount": 0,
        "externalImageTargets": [],
        "errors": [],
        "warnings": [],
    }
    with zipfile.ZipFile(path) as archive:
        names = set(archive.namelist())
        corrupt = archive.testzip()
        if corrupt:
            result["errors"].append(f"ZIP entry damaged: {corrupt}")
        if "[Content_Types].xml" not in names or "ppt/presentation.xml" not in names:
            result["errors"].append("Missing required PPTX package files")
        slides = sorted(
            (name for name in names if re.fullmatch(r"ppt/slides/slide\d+\.xml", name)),
            key=lambda name: int(re.search(r"slide(\d+)", name).group(1)),
        )
        result["slideCount"] = len(slides)
        if len(slides) != expected_slides:
            result["errors"].append(f"Expected {expected_slides} slides, found {len(slides)}")
        media = sorted(name for name in names if name.startswith("ppt/media/") and not name.endswith("/"))
        result["embeddedMediaCount"] = len(media)
        result["svgMediaCount"] = sum(name.lower().endswith(".svg") for name in media)
        for name in media:
            if archive.getinfo(name).file_size == 0:
                result["errors"].append(f"Empty media: {name}")

        picture_namespace = "{http://schemas.openxmlformats.org/presentationml/2006/main}pic"
        relationship_namespace = "{http://schemas.openxmlformats.org/package/2006/relationships}Relationship"
        for slide in slides:
            number = int(re.search(r"slide(\d+)", slide).group(1))
            root = ET.fromstring(archive.read(slide))
            result["svgReferenceCount"] += archive.read(slide).count(b"svgBlip")
            pictures = sum(1 for _ in root.iter(picture_namespace))
            result["pictureCount"] += pictures
            if pictures == 0:
                result["slidesWithoutPictures"].append(number)
            relationship_file = f"ppt/slides/_rels/{posixpath.basename(slide)}.rels"
            if relationship_file not in names:
                if pictures:
                    result["errors"].append(f"Slide {number} has pictures but no relationship file")
                continue
            relations = ET.fromstring(archive.read(relationship_file))
            for relation in relations.iter(relationship_namespace):
                if not relation.attrib.get("Type", "").endswith("/image"):
                    continue
                target = relation.attrib.get("Target", "")
                if relation.attrib.get("TargetMode") == "External":
                    result["externalImageTargets"].append({"slide": number, "target": target})
                else:
                    resolved = posixpath.normpath(posixpath.join(posixpath.dirname(slide), target))
                    if resolved not in names:
                        result["errors"].append(f"Slide {number} references missing image: {target}")

        if result["externalImageTargets"]:
            result["errors"].append("External image relationships require online access")
        if result["slidesWithoutPictures"]:
            result["warnings"].append("Some slides contain no picture objects; this can be intentional when shapes replace images")
        if result["svgReferenceCount"]:
            result["warnings"].append("SVG picture overrides may render differently across PowerPoint viewers")
        result["valid"] = not result["errors"]
    return result


if __name__ == "__main__":
    try:
        report = audit(sys.argv[1], int(sys.argv[2]))
        print(json.dumps(report, ensure_ascii=False, indent=2))
        sys.exit(0 if report["valid"] else 1)
    except Exception as error:
        print(json.dumps({"valid": False, "errors": [str(error)]}, ensure_ascii=False))
        sys.exit(1)
