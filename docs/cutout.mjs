// Amulet Camera's cutter: ISNet in the browser, two passes, a tolerance step and a guided filter, full-resolution cutout.
// Used by the app (index.html) and by cut.html, which sites.motdang.net's builder frames.
const T = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1';
const M = { id: 'onnx-community/ISNet-ONNX', gpu: 'fp16', cpu: 'uint8' }; // ISNet (DIS), picked over ormbg and BiRefNet_lite on her photos 2026-10-12
const SIZE = 1024;          // model input
const REFINE_MAX = 2048;    // guided filter works at most this many px on the long side

// Tolerance: how readily a doubtful part of the model's answer counts as the amulet. The model rates each
// pixel 0..1. Under `lo` is background, over `hi` is the amulet, in between is a soft edge. An enclosed gap
// whose average rating is at least `gap` is filled (a gap value of 2 fills none).
export const LEVELS = [
  { en: 'Strict', th: 'เข้ม', lo: 0.25, hi: 0.75, gap: 2 },
  { en: 'Normal', th: 'ปกติ', lo: 0.05, hi: 0.40, gap: 0.15 },
  { en: 'Forgiving', th: 'ผ่อนปรน', lo: 0.02, hi: 0.22, gap: 0.04 },
];
export const DEFAULT_LEVEL = 2;                   // Forgiving: her word 2026-10-23, "tolerances need to be more tolerant"
const GAP_MAX = 0.04;       // the largest gap filled, as a share of the amulet's area
const PIECE_MIN = 0.015;    // a piece smaller than this share of the largest piece is dropped

let tf, model, loading, gpuFailed = false;
export const device = () => model?._dev;
export async function load(onProgress = () => {}) {
  if (model) return;
  if (loading) return loading;
  loading = (async () => {
    tf = await import(T);
    tf.env.allowLocalModels = false;
    const files = {};
    const progress_callback = p => {
      if (p.status === 'progress' && p.total) {
        files[p.file] = [p.loaded, p.total];
        const v = Object.values(files), l = v.reduce((a, x) => a + x[0], 0), t = v.reduce((a, x) => a + x[1], 0);
        onProgress(l, t);
      }
    };
    const want = new URLSearchParams(location.search).get('dev');
    const tries = want === 'wasm' || !navigator.gpu || gpuFailed ? [['wasm', M.cpu]] : [['webgpu', M.gpu], ['wasm', M.cpu]];
    let lastErr;
    for (const [device, dtype] of tries) {
      try {
        model = await tf.pipeline('background-removal', M.id, { device, dtype, progress_callback }); model._dev = device;
        if (device === 'webgpu') await predict(canvasOf(SIZE, SIZE)); // some phone GPUs load the model and fail on the first run
        break;
      } catch (e) { lastErr = e; console.warn(device, e); if (device === 'webgpu') gpuFailed = true; await model?.dispose?.(); model = null; }
    }
    if (!model) throw lastErr;
  })();
  try { await loading; } finally { loading = null; }
}

// run the model on a canvas → Float32Array alpha, SIZE×SIZE, 0..1
async function predict(canvas) {
  const r = await model(tf.RawImage.fromCanvas(canvas)), img = Array.isArray(r) ? r[0] : r;
  const d = img.data, ch = img.channels, a = new Float32Array(img.width * img.height);
  for (let i = 0; i < a.length; i++) a[i] = d[i * ch + ch - 1] / 255;
  return a;
}

function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// bounding box of alpha > t on an n×n grid, null if empty
function bbox(a, n, t = 0.5) {
  let x0 = n, y0 = n, x1 = -1, y1 = -1;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (a[y * n + x] > t) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}

// box filter, radius r, on w×h Float32Array (running sums, two passes)
function box(src, w, h, r) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const o = y * w; let s = 0;
    for (let x = -r; x <= r; x++) s += src[o + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[o + x] = s;
      s += src[o + Math.min(w - 1, x + r + 1)] - src[o + Math.max(0, x - r)];
    }
  }
  const k = 1 / ((2 * r + 1) * (2 * r + 1));
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let y = -r; y <= r; y++) s += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = s * k;
      s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

// guided filter (He, Sun, Tang): pulls the soft mask p onto the edges of grey image I
function guided(I, p, w, h, r, eps) {
  const n = w * h, Ip = new Float32Array(n), II = new Float32Array(n);
  for (let i = 0; i < n; i++) { Ip[i] = I[i] * p[i]; II[i] = I[i] * I[i]; }
  const mI = box(I, w, h, r), mp = box(p, w, h, r), mIp = box(Ip, w, h, r), mII = box(II, w, h, r);
  const A = new Float32Array(n), B = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const cov = mIp[i] - mI[i] * mp[i], v = mII[i] - mI[i] * mI[i];
    A[i] = cov / (v + eps); B[i] = mp[i] - A[i] * mI[i];
  }
  const mA = box(A, w, h, r), mB = box(B, w, h, r), q = new Float32Array(n);
  for (let i = 0; i < n; i++) q[i] = Math.min(1, Math.max(0, mA[i] * I[i] + mB[i]));
  return q;
}

// connected pieces of a w×h Uint8Array (1 = in): a label per pixel (0 = out) and each label's area
function regions(m, w, h, diag) {
  const lab = new Int32Array(w * h), q = new Int32Array(w * h), area = [0];
  let n = 0;
  for (let s = 0; s < m.length; s++) {
    if (!m[s] || lab[s]) continue;
    let head = 0, tail = 0; q[tail++] = s; lab[s] = ++n;
    while (head < tail) {
      const i = q[head++], x = i % w, y = (i - x) / w;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dy) || (!diag && dx && dy)) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (m[j] && !lab[j]) { lab[j] = n; q[tail++] = j; }
      }
    }
    area.push(tail);
  }
  return { lab, area, n };
}

// the model's ratings (n×n, 0..1) → the alpha handed to the guided filter, by the tolerance level L:
// ratings stretched between L.lo and L.hi, doubtful gaps inside the amulet filled, stray specks dropped
function forgive(a, n, L) {
  const N = n * n, s = new Float32Array(N), core = new Uint8Array(N), inv = new Uint8Array(N);
  let obj = 0;
  for (let i = 0; i < N; i++) {
    const t = Math.min(1, Math.max(0, (a[i] - L.lo) / (L.hi - L.lo)));
    s[i] = t * t * (3 - 2 * t);
    if (s[i] >= 0.5) { core[i] = 1; obj++; } else inv[i] = 1;
  }
  if (!obj) return s;
  // a gap is background the amulet closes round: not reachable from the frame's edge
  const g = regions(inv, n, n, false), outer = new Uint8Array(g.n + 1), sum = new Float64Array(g.n + 1);
  for (let k = 0; k < n; k++) outer[g.lab[k]] = outer[g.lab[N - n + k]] = outer[g.lab[k * n]] = outer[g.lab[k * n + n - 1]] = 1;
  for (let i = 0; i < N; i++) sum[g.lab[i]] += a[i];
  const whole = new Uint8Array(core);
  for (let i = 0; i < N; i++) {
    const l = g.lab[i];
    if (l && !outer[l] && g.area[l] <= GAP_MAX * obj && sum[l] / g.area[l] >= L.gap) whole[i] = 1;
  }
  // pieces: keep the large ones, and the soft rim only beside them
  const p = regions(whole, n, n, true), near = new Float32Array(N);
  let big = 0; for (const a of p.area) if (a > big) big = a;
  for (let i = 0; i < N; i++) if (whole[i] && p.area[p.lab[i]] >= PIECE_MIN * big) near[i] = 1;
  const rim = box(near, n, n, 4);
  for (let i = 0; i < N; i++) s[i] = rim[i] > 0 ? Math.max(s[i], near[i] * whole[i] * (1 - core[i])) : 0;
  return s;
}

// draw a float alpha grid (gw×gh) stretched over a w×h canvas, bilinear via the browser
function alphaCanvas(a, gw, gh, w, h) {
  const g = canvasOf(gw, gh), gx = g.getContext('2d'), id = gx.createImageData(gw, gh);
  for (let i = 0; i < a.length; i++) { const v = a[i] * 255; id.data[i * 4 + 3] = v; }
  gx.putImageData(id, 0, 0);
  const c = canvasOf(w, h), cx = c.getContext('2d');
  cx.imageSmoothingQuality = 'high'; cx.drawImage(g, 0, 0, w, h);
  return c;
}

// The photo, cut: `file` is the picture, `level` an index into LEVELS. Returns the cutout canvas, the photo's
// size and `mask` (the model's second pass and the crop it saw), which `recut` takes to change the level
// without running the model again.
export async function cutout(file, level = DEFAULT_LEVEL) {
  await load();
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const W = bmp.width, H = bmp.height;

  // pass 1: whole frame, to find the amulet
  const c1 = canvasOf(SIZE, SIZE); c1.getContext('2d').drawImage(bmp, 0, 0, SIZE, SIZE);
  const a1 = await predict(c1);
  const b = bbox(a1, SIZE);
  if (!b) throw new Error('No object found in this picture.');

  // crop around it with a margin, in full-resolution pixels
  const sx = W / SIZE, sy = H / SIZE;
  let x0 = b.x0 * sx, y0 = b.y0 * sy, x1 = b.x1 * sx, y1 = b.y1 * sy;
  const m = 0.08 * Math.max(x1 - x0, y1 - y0);
  x0 = Math.max(0, Math.floor(x0 - m)); y0 = Math.max(0, Math.floor(y0 - m));
  x1 = Math.min(W, Math.ceil(x1 + m)); y1 = Math.min(H, Math.ceil(y1 + m));

  // pass 2: the crop alone, so the amulet fills the model's view
  const c2 = canvasOf(SIZE, SIZE); c2.getContext('2d').drawImage(bmp, x0, y0, x1 - x0, y1 - y0, 0, 0, SIZE, SIZE);
  const a2 = await predict(c2);

  const canvas = compose(bmp, [x0, y0, x1, y1], a2, level);
  bmp.close();
  return { canvas, W, H, mask: { box: [x0, y0, x1, y1], a: Uint8Array.from(a2, v => Math.round(v * 255)) } };
}

// the same photo at another level, from the kept `mask`: no model run
export async function recut(file, mask, level = DEFAULT_LEVEL) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const W = bmp.width, H = bmp.height;
  const canvas = compose(bmp, mask.box, Float32Array.from(mask.a, v => v / 255), level);
  bmp.close();
  return { canvas, W, H };
}

// the model's ratings a2 (SIZE×SIZE, over the crop `box`) → the full-resolution cutout of the crop
function compose(bmp, [x0, y0, x1, y1], a2, level) {
  const cw = x1 - x0, ch = y1 - y0;

  // tolerance, then refine on edges at up to REFINE_MAX px
  const k = Math.min(1, REFINE_MAX / Math.max(cw, ch));
  const rw = Math.round(cw * k), rh = Math.round(ch * k);
  const rc = canvasOf(rw, rh), rx = rc.getContext('2d', { willReadFrequently: true });
  rx.drawImage(bmp, x0, y0, cw, ch, 0, 0, rw, rh);
  const px = rx.getImageData(0, 0, rw, rh).data;
  const I = new Float32Array(rw * rh);
  for (let i = 0; i < I.length; i++) I[i] = (0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]) / 255;
  const pc = alphaCanvas(forgive(a2, SIZE, LEVELS[level] || LEVELS[DEFAULT_LEVEL]), SIZE, SIZE, rw, rh);
  const pd = pc.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, rw, rh).data;
  const p = new Float32Array(rw * rh);
  for (let i = 0; i < p.length; i++) p[i] = pd[i * 4 + 3] / 255;
  const r = Math.max(2, Math.round(Math.max(rw, rh) / 400));
  const q = guided(I, p, rw, rh, r, 1e-4);
  // keep the sure inside and sure outside; let the filter decide the rim
  for (let i = 0; i < q.length; i++) { if (p[i] > 0.97) q[i] = 1; else if (p[i] < 0.03) q[i] = 0; }

  // full-resolution cutout
  const out = canvasOf(cw, ch), ox = out.getContext('2d');
  ox.drawImage(bmp, x0, y0, cw, ch, 0, 0, cw, ch);
  ox.globalCompositeOperation = 'destination-in';
  ox.drawImage(alphaCanvas(q, rw, rh, cw, ch), 0, 0);
  ox.globalCompositeOperation = 'source-over';
  return out;
}
