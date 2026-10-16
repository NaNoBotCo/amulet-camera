#!/usr/bin/env python3
"""Copy Amulet Camera's cloud photos to the Mac.

Every photo and cutout the linked phone has backed up to the private R2 bucket
(amulet-camera-cloud Worker) and that is not here yet is downloaded into
amulet-essentials/data/own_raw/camera/, beside her other raw amulet photos, and
logged in index.tsv there. Nothing in the cloud is deleted. Run by launchd
(com.nanobotco.amulet-pull) every 30 minutes.
"""
import json
import os
import pathlib
import urllib.request

CLOUD = 'https://amulet-camera-cloud.nanobotco.workers.dev'
KEY = (pathlib.Path.home() / '.tokens' / 'AMULET_CAMERA_KEY').read_text().strip()
OUT = pathlib.Path.home() / 'Developer/claude code projects/amulet-essentials/data/own_raw/camera'
EXT = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic'}


def get(path):
    req = urllib.request.Request(CLOUD + path, headers={'X-Key': KEY, 'User-Agent': 'amulet-pull'})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    index = OUT / 'index.tsv'
    if not index.exists():
        index.write_text('file\tname\tuploaded\tbytes\n')
    have = {line.split('\t')[0] for line in index.read_text().splitlines()[1:]}
    new = 0
    for o in json.loads(get('/list')):
        sid, part = o['key'].split('/')
        if part == 'lens':
            continue
        name = f"{sid}-{part}.{EXT.get(o['type'], 'bin')}"
        if name in have and (OUT / name).exists():
            continue
        data = get(f'/get/{sid}/{part}')
        tmp = OUT / (name + '.part')
        tmp.write_bytes(data)
        os.replace(tmp, OUT / name)
        if name not in have:
            with index.open('a') as f:
                f.write(f"{name}\t{o['name']}\t{o['uploaded']}\t{len(data)}\n")
        new += 1
    print(f'{new} new from the cloud')


if __name__ == '__main__':
    main()
