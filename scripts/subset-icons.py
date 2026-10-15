"""Regenerate shipped icon maps/fonts. Requires fonttools[woff]."""

import json
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "scripts/icon-sources"
OUTPUT = ROOT / "src/assets/icons"


def main():
    families = json.loads((SOURCES / "used-icons.json").read_text())
    for family, names in families.items():
        original = json.loads((SOURCES / f"{family}.json").read_text())
        glyphs = {name: original[name] for name in sorted(names)}
        codepoints = set(glyphs.values())
        font = TTFont(SOURCES / f"{family}.ttf", recalcTimestamp=False)
        options = subset.Options()
        options.flavor = "woff2"
        subsetter = subset.Subsetter(options=options)
        subsetter.populate(unicodes=codepoints)
        subsetter.subset(font)
        font.flavor = "woff2"
        output_font = OUTPUT / f"{family}.woff2"
        font.save(output_font)
        # Verify serialized cmap and outlines, including composite dependencies.
        with TTFont(output_font) as result, TTFont(SOURCES / f"{family}.ttf") as source:
            assert set(result.getBestCmap()) == codepoints, family
            for codepoint in codepoints:
                outlines = []
                metrics = []
                for item in (source, result):
                    glyph_name = item.getBestCmap()[codepoint]
                    coordinates, endpoints, flags = item["glyf"][glyph_name].getCoordinates(item["glyf"])
                    outlines.append((list(coordinates), list(endpoints), list(flags)))
                    metrics.append(item["hmtx"][glyph_name])
                assert outlines[0][0] and outlines[0] == outlines[1], codepoint
                assert metrics[0] == metrics[1], codepoint
        (OUTPUT / f"{family}.json").write_text(
            json.dumps(glyphs, indent=2) + "\n"
        )
        print(f"{family}: {len(names)} names, {output_font.stat().st_size} bytes")


if __name__ == "__main__":
    main()
