Amulet Camera · กล้องพระ

A phone web app: take or choose a photo of a small amulet, and it cuts the amulet out from its background at the photo's full resolution. Share, save as transparent PNG, save on white, or save the original.

Every photo is written to the phone's own storage (IndexedDB, in the browser) the moment it is taken or chosen, before any cutting, and its cutout is added once made. Reopening the app brings them all back; a photo leaves only on Remove. Added 2026-10-16 after a crash lost 10 photos.

Each card: Search (Google Lens on the photo), Post (picture on white to the share sheet for a Facebook group, caption copied), Price (sites.motdang.net/amulet-price, Mot Dang's guide from closed G-Pra auctions and Lazada asking prices, for words she types); the save buttons sit under More.

Private cloud (her word 2026-10-16): her linked phone also sends every photo, a 1600 px copy for Lens, and the cutout to the private R2 bucket amulet-camera-photos through the Worker amulet-camera-cloud (cloud/worker.js, deploy: cd cloud && npx wrangler deploy). Linking: open the app once with #link=<key>; the key is ~/.tokens/AMULET_CAMERA_KEY and the Worker secret KEY. Without a link the app works as before, phone only. Search sends Lens a signed link to the 1600 px copy that expires in an hour; nothing in the bucket is public. Remove clears the phone only; the cloud copy stays.
The Mac copies new photos and cutouts into amulet-essentials/data/own_raw/camera/ (index.tsv there) every 30 minutes: tools/pull.py, launchd com.nanobotco.amulet-pull, log /tmp/nanobotco-amulet-pull.log.

Live: https://nanobotco.github.io/amulet-camera/
On the vivo: open that link in Chrome, menu ⋮, Add to home screen.

How it cuts: ISNet (onnx-community/ISNet-ONNX, licence AGPL-3.0) runs in the phone's browser through transformers.js 4.3.1, on the GPU when the phone allows and on the CPU otherwise. Pass one finds the amulet in the whole frame; pass two runs again on a crop around it so the amulet fills the model's view; a guided filter then fits the mask edge to the photo's own edges. The model (about 45 MB on the CPU path, 88 MB on the GPU path) downloads once and stays in the browser cache.

Tested 2026-10-12 on her vivo X300 FE amulet photos: 1.4 s a photo on a Mac GPU (also with the GPU held to a phone's 8-buffer limit), about 15 s on the Mac CPU.

Code: MIT. Files: docs/index.html (the app), docs/cutout.mjs (the cutter, shared), docs/cut.html (the cutter for sites.motdang.net's builder, which frames it: a photo in by postMessage, the cutout on white back; only sites.motdang.net and the local builder may ask), docs/sw.js (offline shell), docs/manifest.webmanifest, docs/icon-*.png.
Local preview: python3 -m http.server 8961 --directory docs
