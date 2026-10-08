"""Pack the preserved reference-style, complete raster cels into Nia atlases.

This script does no image synthesis, blending, warping or face compositing.
"""
from pathlib import Path
import argparse
from PIL import Image

STATES = ('idle',)  # Only idle art has passed user visual acceptance.
CELL, COUNT, COLUMNS = 362, 24, 6


def pack_state(source: Path, target: Path) -> None:
    atlas = Image.new('RGBA', (COLUMNS * CELL, 4 * CELL))
    fingerprints: set[bytes] = set()
    for index in range(COUNT):
        path = source / f'{index:03}.png'
        with Image.open(path) as image:
            if image.size != (CELL, CELL) or image.mode != 'RGBA':
                raise ValueError(f'{path}: expected a 362px RGBA frame')
            signature = image.tobytes()
            if signature in fingerprints:
                raise ValueError(f'{path}: duplicate drawing')
            fingerprints.add(signature)
            alpha = image.getchannel('A')
            if (alpha.crop((0, 0, CELL, 8)).getbbox()
                    or alpha.crop((0, CELL - 8, CELL, CELL)).getbbox()
                    or alpha.crop((0, 0, 8, CELL)).getbbox()
                    or alpha.crop((CELL - 8, 0, CELL, CELL)).getbbox()):
                raise ValueError(f'{path}: neighboring-cel bleed')
            atlas.paste(image, ((index % COLUMNS) * CELL, (index // COLUMNS) * CELL))
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix('.tmp.png')
    atlas.save(temporary, optimize=True)
    temporary.replace(target)
    print(f'{source.name}: 24 complete PNG cels -> {target}')


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', type=Path, default=Path('art/nia-classic-frames'))
    parser.add_argument('--output', type=Path, default=Path('public/assets/nia/animations'))
    args = parser.parse_args()
    for state in STATES:
        pack_state(args.input / state, args.output / f'{state}.png')


if __name__ == '__main__':
    main()
