"""Crop and rigidly register complete generated cels; never synthesize faces.

Each output maps to one grid cell in one persisted generated sheet. The only
geometric operation is whole-cel uniform scaling and translation. No optical
flow, local warping, face compositing, blending or invented in-between frames.
"""
from pathlib import Path
import argparse, hashlib, json
import cv2
import numpy as np
from PIL import Image

STATES = ('working', 'thinking', 'happy', 'warning', 'error', 'sleepy', 'celebrate')
CELL = 362
SOURCE_CELL = 256
ANCHOR = (182.3442623, 296.79508197)
LAPTOP_WIDTH = 195


def measure(cel, original=False):
    a = np.asarray(cel.convert('RGBA'))
    r, g, b, alpha = [a[:, :, j].astype(int) for j in range(4)]
    # Continuous brightness weights avoid threshold-driven centroid jumps.
    weights = np.maximum(np.minimum.reduce([r-170, g-190, b-210]), 0).astype(float)
    weights *= alpha / 255
    y0,y1,x0,x1 = (280,320,162,204) if original else (275,330,170,222)
    weights[:y0]=0; weights[y1:]=0; weights[:,:x0]=0; weights[:,x1:]=0
    if weights.sum() < 100:
        raise ValueError('Laptop emblem too small')
    yy,xx=np.indices(weights.shape)
    x,y = float((xx*weights).sum()/weights.sum()),float((yy*weights).sum()/weights.sum())
    xs = np.where(alpha[round(y)] > 180)[0]
    return float(x), float(y), int(xs[-1] - xs[0] + 1)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, default=Path('art/nia-state-hires/pages'))
    parser.add_argument('--frames', type=Path, default=Path('art/nia-state-hires/frames'))
    parser.add_argument('--output', type=Path, default=Path('public/assets/nia/animations-hires'))
    args = parser.parse_args()
    global ANCHOR, LAPTOP_WIDTH
    ax, ay, LAPTOP_WIDTH = measure(Image.open('art/nia-classic-frames/idle/000.png'), True)
    ANCHOR = (ax, ay)
    args.output.mkdir(parents=True, exist_ok=True)
    manifest = {'reviewStatus': 'candidate: pending user visual acceptance', 'states': {}}
    for state in STATES:
        sources = [args.source / f'{state}-{page}.png' for page in ('a', 'b')]
        sheets = [Image.open(source).convert('RGBA') for source in sources]
        if any(sheet.size != (1536, 1024) for sheet in sheets):
            raise ValueError(f'{state}: wrong source grid')
        folder = args.frames / state
        folder.mkdir(parents=True, exist_ok=True)
        atlas = Image.new('RGBA', (2172, 1448))
        details, signatures = [], set()
        for index in range(24):
            col, row = index % 6, index // 6
            source_index = index
            # Working B ends on a second blink; reorder its complete cels to
            # finish open-eyed, preserving all 24 original drawings.
            if state == 'working' and index >= 12:
                source_index = [12,13,22,23,20,21,14,15,16,17,18,19][index-12]
            if state == 'happy' and index in (7,8):
                source_index = 15-index
            if state == 'sleepy' and index in (3,4):
                source_index = 7-index
            page, cell = divmod(source_index, 12)
            sx, sy = (cell % 4) * 384, (cell // 4) * 341
            cel = sheets[page].crop((sx, sy, sx + 384, sy + 341))
            x, y, width = measure(cel)
            pixels = np.array(cel)
            pixels[pixels[:, :, 3] <= 3] = 0  # transparent export noise only
            cel = Image.fromarray(pixels)
            scale = LAPTOP_WIDTH / width
            tx, ty = ANCHOR[0] - x * scale, ANCHOR[1] - y * scale
            # Premultiplied resampling prevents RGB hidden under alpha=0 from
            # producing colored halos. The entire intact cel uses one transform.
            best = None
            for attempt in range(40):
                output = cel.convert('RGBa').transform((CELL, CELL), Image.Transform.AFFINE,
                    (1 / scale, 0, -tx / scale, 0, 1 / scale, -ty / scale),
                    resample=Image.Resampling.BICUBIC).convert('RGBA')
                mx, my, _ = measure(output, True)
                dx, dy = ANCHOR[0] - mx, ANCHOR[1] - my
                error = max(abs(dx), abs(dy))
                if best is None or error < best[0]:
                    best = (error, output, tx, ty)
                if error < 0.12:
                    break
                tx += dx * 0.5
                ty += dy * 0.5
            _, output, tx, ty = best
            alpha = np.asarray(output)[:, :, 3]
            if (alpha[:8].any() or alpha[-8:].any() or alpha[:, :8].any() or alpha[:, -8:].any()):
                raise ValueError(f'{state}/{index}: border spill')
            signature = hashlib.sha256(output.tobytes()).hexdigest()
            signatures.add(signature)
            target = folder / f'{index:03}.png'
            output.save(target, optimize=True)
            atlas.paste(output, (col * CELL, row * CELL))
            ax, ay, w = measure(output, True)
            details.append({'frame': index, 'sourceIndex': source_index, 'scale': scale, 'translation': [tx, ty],
                'anchor': [ax, ay], 'laptopWidth': w, 'sha256': sha(target)})
        target = args.output / (state + '.png')
        atlas.save(target, optimize=True)
        if len(signatures) != 24:
            raise ValueError(f'{state}: repeated full drawings')
        manifest['states'][state] = {'sourceSha256': [sha(source) for source in sources], 'atlasSha256': sha(target),
            'frames': details, 'uniqueCels': len(signatures)}
        anchors = np.array([d['anchor'] for d in details])
        print(state, '24 complete cels; anchor spread', np.ptp(anchors, axis=0).round(3).tolist())
    (args.source.parent / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
