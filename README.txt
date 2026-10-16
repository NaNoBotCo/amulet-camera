Amulet Camera · กล้องพระ

A phone web app: take or choose a photo of a small amulet, and it cuts the amulet out from its background at the photo's full resolution. Share, save as transparent PNG, save on white, or save the original.

Every photo is written to the phone's own storage (IndexedDB, in the browser) the moment it is taken or chosen, before any cutting, and its cutout is added once made. Reopening the app brings them all back; a photo leaves only on Remove. Added 2026-10-16 after a crash lost 10 photos.

Live: https://nanobotco.github.io/amulet-camera/
On the vivo: open that link in Chrome, menu ⋮, Add to home screen.

How it cuts: ISNet (onnx-community/ISNet-ONNX, licence AGPL-3.0) runs in the phone's browser through transformers.js 4.3.1, on the GPU when the phone allows and on the CPU otherwise. Pass one finds the amulet in the whole frame; pass two runs again on a crop around it so the amulet fills the model's view; a guided filter then fits the mask edge to the photo's own edges. The model (about 45 MB on the CPU path, 88 MB on the GPU path) downloads once and stays in the browser cache.

Tested 2026-10-12 on her vivo X300 FE amulet photos: 1.4 s a photo on a Mac GPU (also with the GPU held to a phone's 8-buffer limit), about 15 s on the Mac CPU.

Code: MIT. Files: docs/index.html (the app), docs/sw.js (offline shell), docs/manifest.webmanifest, docs/icon-*.png.
Local preview: python3 -m http.server 8961 --directory docs
