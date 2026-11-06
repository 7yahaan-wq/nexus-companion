"""Crop and rigidly register complete generated cels; never synthesize faces.

Each output maps to one grid cell in one persisted generated sheet. The only
geometric operation is whole-cel uniform scaling and translation. No optical
flow, local warping, face compositing, blending or invented in-between frames.
"""
import argparse
import hashlib
import io
import json
import os
import shutil
import tempfile
from contextlib import contextmanager
from pathlib import Path

import numpy as np
from PIL import Image, __version__ as pillow_version

STATES = ('working', 'thinking', 'happy', 'warning', 'error', 'sleepy', 'celebrate')
CELL = 362
ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'art/nia-state-hires'
RUNTIME = ROOT / 'public/assets/nia/animations-hires'
REFERENCE = ROOT / 'art/nia-classic-frames/idle/000.png'
# Bump when the crop, registration, alpha treatment or atlas format changes.
RASTER_REVISION = 2


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


def integers(values, low, high):
    return (isinstance(values, list) and len(values) == 24
            and all(type(value) is int and low <= value <= high for value in values))


def load_choreography(path):
    config = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(config, dict) or set(config) - set(STATES):
        raise ValueError(f'{path}: expected a map of non-idle state names')
    for state, entry in config.items():
        if not isinstance(entry, dict) or set(entry) - {'sourceOrder', 'durations', 'scalePermille', 'anchorYHundredths'}:
            raise ValueError(f'{state}: unexpected choreography fields')
        order = entry.get('sourceOrder')
        if not integers(order, 0, 23) or len(set(order)) != 24:
            raise ValueError(f'{state}: sourceOrder must contain each original cell 0..23 once')
        if not integers(entry.get('durations'), 1, 2**31 - 1):
            raise ValueError(f'{state}: expected 24 positive millisecond durations')
        if 'scalePermille' in entry and not integers(entry['scalePermille'], 980, 1020):
            raise ValueError(f'{state}: expected 24 scalePermille values (980..1020) in source order')
        if 'anchorYHundredths' in entry and not integers(entry['anchorYHundredths'], -45, 45):
            raise ValueError(f'{state}: expected 24 anchorYHundredths values (-45..45) in source order')
    return config


def default_order(state):
    order = list(range(24))
    if state == 'working':
        order[12:] = [12, 13, 22, 23, 20, 21, 14, 15, 16, 17, 18, 19]
    elif state == 'happy':
        order[7], order[8] = 8, 7
    elif state == 'sleepy':
        order[3], order[4] = 4, 3
    return order


def register(cel, anchor, permille):
    x, y, width = measure(cel)
    pixels = np.array(cel)
    pixels[pixels[:, :, 3] <= 3] = 0
    source = Image.fromarray(pixels).convert('RGBa')
    scale = anchor[2] / width * (permille / 1000)
    tx, ty = anchor[0] - x * scale, anchor[1] - y * scale
    # Every trial resamples the original intact cel in premultiplied alpha.
    best = None
    for _ in range(40):
        output = source.transform((CELL, CELL), Image.Transform.AFFINE,
            (1 / scale, 0, -tx / scale, 0, 1 / scale, -ty / scale),
            resample=Image.Resampling.BICUBIC).convert('RGBA')
        mx, my, _ = measure(output, True)
        dx, dy = anchor[0] - mx, anchor[1] - my
        error = max(abs(dx), abs(dy))
        if best is None or error < best[0]:
            best = (error, output, tx, ty)
        if error < 0.12:
            break
        tx += dx * 0.5
        ty += dy * 0.5
    _, output, tx, ty = best
    return output, scale, [tx, ty]


def render(state, pages, order, scales, anchor, folder, atlas_path, y_offsets):
    sheets = [Image.open(io.BytesIO(page)).convert('RGBA') for page in pages]
    if any(sheet.size != (1536, 1024) for sheet in sheets):
        raise ValueError(f'{state}: wrong source grid')
    atlas = Image.new('RGBA', (6 * CELL, 4 * CELL))
    details, signatures = [], set()
    for index, source_index in enumerate(order):
        page, cell = divmod(source_index, 12)
        sx, sy = (cell % 4) * 384, (cell // 4) * 341
        cel = sheets[page].crop((sx, sy, sx + 384, sy + 341))
        target_anchor = (anchor[0], anchor[1] + y_offsets[source_index] / 100, anchor[2])
        output, scale, translation = register(cel, target_anchor, scales[source_index])
        alpha = np.asarray(output)[:, :, 3]
        if (alpha[:8].any() or alpha[-8:].any() or alpha[:, :8].any() or alpha[:, -8:].any()):
            raise ValueError(f'{state}/{index}: border spill')
        signatures.add(hashlib.sha256(output.tobytes()).digest())
        target = folder / f'{index:03}.png'
        output.save(target, optimize=True)
        atlas.paste(output, (index % 6 * CELL, index // 6 * CELL))
        ax, ay, width = measure(output, True)
        details.append({'frame': index, 'sourceIndex': source_index, 'scale': scale,
            'translation': translation, 'anchor': [ax, ay], 'laptopWidth': width, 'sha256': sha(target)})
    if len(signatures) != 24:
        raise ValueError(f'{state}: repeated full drawings')
    atlas.save(atlas_path, optimize=True)
    return details


def cache_hit(entry, inputs, order, folder, atlas):
    if not isinstance(entry, dict) or entry.get('exportInputs') != inputs or entry.get('uniqueCels') != 24:
        return False
    if entry.get('sourceSha256') != inputs['sourceSha256'] or not atlas.is_file() or sha(atlas) != entry.get('atlasSha256'):
        return False
    details = entry.get('frames', [])
    if not isinstance(details, list) or len(details) != 24:
        return False
    for index, detail in enumerate(details):
        target = folder / f'{index:03}.png'
        if (not isinstance(detail, dict) or detail.get('frame') != index or detail.get('sourceIndex') != order[index]
                or not target.is_file() or sha(target) != detail.get('sha256')):
            return False
    return True


def reuse_trial(trial, state, inputs, folder, atlas):
    manifest = json.loads((trial / 'manifest.json').read_text(encoding='utf-8'))
    entry = manifest['states'][state]
    if entry.get('exportInputs') != inputs:
        raise ValueError(f'{state}: trial inputs do not match the requested export')
    for index in range(24):
        name = f'{index:03}.png'
        shutil.copyfile(trial / 'frames' / state / name, folder / name)
    shutil.copyfile(trial / 'atlases' / atlas.name, atlas)
    # Check the staged bytes, even if another process is currently revising the trial.
    if not cache_hit(entry, inputs, inputs['sourceOrder'], folder, atlas):
        raise ValueError(f'{state}: trial PNGs or frame mapping failed verification')
    for frame in entry['frames']:
        transform = [frame['scale'], *frame['translation'], *frame['anchor'], frame['laptopWidth']]
        if len(frame['translation']) != 2 or len(frame['anchor']) != 2 or not np.isfinite(transform).all():
            raise ValueError(f'{state}: invalid trial registration for frame {frame["frame"]}')
    return entry['frames']


@contextmanager
def manifest_lock(path):
    # An OS-held lock releases on process exit, including interrupted exports.
    # Keep the lock outside the asset directories and shared across invocations.
    key = hashlib.sha256(os.path.normcase(str(path.resolve())).encode()).hexdigest()
    with open(Path(tempfile.gettempdir()) / f'nia-export-{key}.lock', 'a+b') as lock:
        lock.seek(0)
        if os.name == 'nt':
            import msvcrt
            msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        yield


def write_manifest(path, manifest):
    path.parent.mkdir(parents=True, exist_ok=True)
    staged = tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', newline='\n',
                                         dir=path.parent, delete=False)
    temp = Path(staged.name)
    try:
        with staged:
            staged.write(json.dumps(manifest, indent=2) + '\n')
        temp.replace(path)
    finally:
        temp.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__, epilog=
        'Production: --state warning --state celebrate. Trial: --state warning '
        '--frames trial/frames --output trial/atlases [--source trial/pages] '
        '[--choreography trial/choreography.json]. The trial manifest defaults to trial/manifest.json.')
    parser.add_argument('--state', action='append', choices=STATES, help='repeat to select states; defaults to all')
    parser.add_argument('--reuse-trial', type=Path,
                        help='use matching verified manifest.json, frames/ and atlases/ from a trial directory')
    parser.add_argument('--source', type=Path, default=ART / 'pages', help='directory of original 4x3 page PNGs')
    parser.add_argument('--frames', type=Path, default=ART / 'frames', help='destination for 24 registered cels per state')
    parser.add_argument('--output', type=Path, default=RUNTIME, help='destination for 6x4 runtime atlases')
    parser.add_argument('--manifest', type=Path, help='defaults to manifest.json beside the frames directory')
    parser.add_argument('--choreography', type=Path, default=ART / 'choreography.json', help='state timing, order and optional uniform scale')
    args = parser.parse_args()
    if args.reuse_trial and not args.state:
        parser.error('--reuse-trial requires at least one explicit --state')
    manifest_path = (args.manifest or args.frames.parent / 'manifest.json').resolve()
    production = [args.frames.resolve() == ART / 'frames', args.output.resolve() == RUNTIME,
                  manifest_path == ART / 'manifest.json']
    custom_inputs = args.source.resolve() != ART / 'pages' or args.choreography.resolve() != ART / 'choreography.json'
    if any(production) and (not all(production) or custom_inputs):
        parser.error('trial exports require separate --frames, --output and manifest destinations')
    config = load_choreography(args.choreography)
    reference = REFERENCE.read_bytes()
    anchor = measure(Image.open(io.BytesIO(reference)), True)
    with manifest_lock(manifest_path):
        manifest = (json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else
                    {'reviewStatus': 'candidate: pending user visual acceptance', 'states': {}})
        states = manifest['states']
        if not isinstance(states, dict):
            raise ValueError(f'{manifest_path}: invalid states map')
        for state in dict.fromkeys(args.state or STATES):
            entry = config.get(state, {})
            order = entry.get('sourceOrder', default_order(state))
            scales = entry.get('scalePermille', [1000] * 24)
            y_offsets = entry.get('anchorYHundredths', [0] * 24)
            pages = [(args.source / f'{state}-{page}.png').read_bytes() for page in ('a', 'b')]
            source_hashes = [hashlib.sha256(page).hexdigest() for page in pages]
            inputs = {'revision': RASTER_REVISION, 'pillow': pillow_version, 'numpy': np.__version__,
                      'referenceSha256': hashlib.sha256(reference).hexdigest(),
                      'sourceSha256': source_hashes, 'sourceOrder': order, 'scalePermille': scales}
            # A zero offset uses the existing registration and its verified cache entry.
            if any(y_offsets):
                inputs['anchorYHundredths'] = y_offsets
            folder = args.frames / state
            atlas = args.output / f'{state}.png'
            if cache_hit(states.get(state), inputs, order, folder, atlas):
                print(f'{state}: reused 24 verified cels and atlas')
                continue
            folder.mkdir(parents=True, exist_ok=True)
            args.output.mkdir(parents=True, exist_ok=True)
            with tempfile.TemporaryDirectory(dir=folder) as frames_stage, tempfile.TemporaryDirectory(dir=args.output) as atlas_stage:
                staged_atlas = Path(atlas_stage) / atlas.name
                if args.reuse_trial:
                    details = reuse_trial(args.reuse_trial, state, inputs, Path(frames_stage), staged_atlas)
                else:
                    details = render(state, pages, order, scales, anchor, Path(frames_stage), staged_atlas, y_offsets)
                atlas_sha = sha(staged_atlas)
                for item in details:
                    name = f"{item['frame']:03}.png"
                    (Path(frames_stage) / name).replace(folder / name)
                staged_atlas.replace(atlas)
            states[state] = {'sourceSha256': source_hashes, 'atlasSha256': atlas_sha,
                             'frames': details, 'uniqueCels': 24, 'exportInputs': inputs}
            # Publish only complete states. An interruption during the preceding
            # replacements invalidates the old hashes and the next run repairs it.
            write_manifest(manifest_path, manifest)
            anchors = np.array([d['anchor'] for d in details])
            action = 'reused from trial' if args.reuse_trial else 'exported'
            print(state, action, '24 complete cels; anchor spread', np.ptp(anchors, axis=0).round(3).tolist(), flush=True)


if __name__ == '__main__':
    main()
