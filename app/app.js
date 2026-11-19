/* Neon Coast — GTA-style cover maker. Original code, vanilla canvas, offline.
   Photos are read locally and never uploaded. Fonts are vendored OFL files. */
'use strict';

const $ = (id) => document.getElementById(id);
const preview = $('preview');
const pctx = preview.getContext('2d');

/* ---------- layouts: cells are fractions of the cover, title band at bottom ---------- */
const LAYOUTS = [
  { id: 'hero3', name: 'Hero + 3', cells: [
    { x: 0, y: 0, w: 0.62, h: 1 }, { x: 0.62, y: 0, w: 0.38, h: 1 / 3 },
    { x: 0.62, y: 1 / 3, w: 0.38, h: 1 / 3 }, { x: 0.62, y: 2 / 3, w: 0.38, h: 1 / 3 } ] },
  { id: 'nine', name: 'Nine grid', cells: [
    { x: 0, y: 0, w: 1 / 3, h: 1 / 3 }, { x: 1 / 3, y: 0, w: 1 / 3, h: 1 / 3 }, { x: 2 / 3, y: 0, w: 1 / 3, h: 1 / 3 },
    { x: 0, y: 1 / 3, w: 1 / 3, h: 1 / 3 }, { x: 1 / 3, y: 1 / 3, w: 1 / 3, h: 1 / 3 }, { x: 2 / 3, y: 1 / 3, w: 1 / 3, h: 1 / 3 },
    { x: 0, y: 2 / 3, w: 1 / 3, h: 1 / 3 }, { x: 1 / 3, y: 2 / 3, w: 1 / 3, h: 1 / 3 }, { x: 2 / 3, y: 2 / 3, w: 1 / 3, h: 1 / 3 } ] },
  { id: 'quad', name: 'Four panel', cells: [
    { x: 0, y: 0, w: 0.5, h: 0.5 }, { x: 0.5, y: 0, w: 0.5, h: 0.5 },
    { x: 0, y: 0.5, w: 0.5, h: 0.5 }, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 } ] },
  { id: 'strip', name: 'Wide strip', cells: [
    { x: 0, y: 0, w: 1, h: 0.667 }, { x: 0, y: 0.667, w: 1 / 3, h: 0.333 },
    { x: 1 / 3, y: 0.667, w: 1 / 3, h: 0.333 }, { x: 2 / 3, y: 0.667, w: 1 / 3, h: 0.333 } ] },
  { id: 'tilted', name: 'Tilted snaps', cells: [
    { x: 0.04, y: 0.05, w: 0.42, h: 0.85, tilt: -4 }, { x: 0.30, y: 0.10, w: 0.42, h: 0.85, tilt: 3 },
    { x: 0.56, y: 0.04, w: 0.40, h: 0.85, tilt: -2 } ] },
  { id: 'fullbleed', name: 'Full bleed', cells: [ { x: 0, y: 0, w: 1, h: 1 } ] },
];
const SIZES = [
  { id: '1080x1080', name: 'Square · 1080×1080', w: 1080, h: 1080 },
  { id: '1080x1350', name: 'Portrait · 1080×1350', w: 1080, h: 1350 },
  { id: '1920x1080', name: 'Wide · 1920×1080', w: 1920, h: 1080 },
];
const GRADES = [
  { id: 'sunset', name: 'Vice Sunset', top: '#ffd319', mid: '#ff2975', bot: '#8c1eff', deep: '#2b0a4a' },
  { id: 'neon', name: 'Neon Nights', top: '#00f5d4', mid: '#ff2e88', bot: '#7b2ff7', deep: '#12082e' },
  { id: 'heat', name: 'Miami Heat', top: '#ffe95e', mid: '#ff6b35', bot: '#d90429', deep: '#3d0000' },
  { id: 'dusk', name: 'Dusk Purple', top: '#f72585', mid: '#7209b7', bot: '#3a0ca3', deep: '#10002b' },
  { id: 'teal', name: 'Teal Noir', top: '#90e0ef', mid: '#0077b6', bot: '#03045e', deep: '#020617' },
];
const TITLE_BAND_H = 0.22;

/* ---------- state ---------- */
function freshPanels() {
  return Array.from({ length: 9 }, (_, i) => ({ photo: i % 2, zoom: 1, ox: 0, oy: 0.06 }));
}
let state = {
  layout: 'hero3', size: '1080x1080', grade: 'sunset', gradeAmt: 0.8, grain: 0.35,
  halftone: true, vignette: true, title: 'NEON SHORE', subtitle: 'Vice City nights',
  badge: '★ VICE CITY ★', stars: 5, titleShift: 0, panels: freshPanels(),
};
let photos = [];           /* {img, name} */
let selectedPhoto = 0;     /* index into photos, for Fill / Swap */
let selectedPanel = 0;
let history = [], future = [];

function layoutOf() { return LAYOUTS.find((l) => l.id === state.layout); }
function sizeOf() { return SIZES.find((s) => s.id === state.size); }
function gradeOf() { return GRADES.find((g) => g.id === state.grade); }
function snapshot() { return JSON.stringify(state); }
function pushHistory() { history.push(snapshot()); if (history.length > 60) history.shift(); future = []; syncUndoRedo(); }
function restore(json) { state = JSON.parse(json); syncControls(); renderPreview(); }
function syncUndoRedo() { $('undoBtn').disabled = history.length === 0; $('redoBtn').disabled = future.length === 0; }

/* ---------- grain tile (generated once, no asset) ---------- */
const grainTile = document.createElement('canvas');
grainTile.width = grainTile.height = 128;
(function makeGrain() {
  const g = grainTile.getContext('2d');
  const d = g.createImageData(128, 128);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = 100 + Math.floor(Math.random() * 155);
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255;
  }
  g.putImageData(d, 0, 0);
})();

/* ---------- cover rendering ---------- */
function drawPhotoCover(ctx, img, px, py, pw, ph, panel) {
  ctx.save();
  ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
  if (!img) {
    const g = ctx.createLinearGradient(px, py, px + pw, py + ph);
    g.addColorStop(0, '#3a2d5e'); g.addColorStop(1, '#171226');
    ctx.fillStyle = g; ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.font = `700 ${Math.max(14, pw * 0.05)}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('＋ ADD A PHOTO', px + pw / 2, py + ph / 2);
    ctx.restore(); return;
  }
  const scale = Math.max(pw / img.naturalWidth, ph / img.naturalHeight) * panel.zoom;
  const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
  const dx = px + (pw - dw) / 2 + panel.ox * pw;
  const dy = py + (ph - dh) / 2 + panel.oy * ph;
  ctx.filter = 'saturate(1.28) contrast(1.1) brightness(1.02)';
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.filter = 'none';
  ctx.restore();
}

function applyGrade(ctx, px, py, pw, ph, grade, amt) {
  if (amt <= 0) return;
  const g = ctx.createLinearGradient(px, py, px, py + ph);
  g.addColorStop(0, grade.top); g.addColorStop(0.55, grade.mid); g.addColorStop(1, grade.bot);
  ctx.save();
  ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
  ctx.globalAlpha = 0.34 * amt; ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = g; ctx.fillRect(px, py, pw, ph);
  ctx.globalAlpha = 0.20 * amt; ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = grade.deep; ctx.fillRect(px, py + ph * 0.55, pw, ph * 0.45);
  ctx.globalAlpha = 0.10 * amt; ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = grade.top; ctx.fillRect(px, py, pw, ph * 0.4);
  ctx.restore();
}

function drawHalftone(ctx, x, y, w, h, color) {
  ctx.save(); ctx.fillStyle = color;
  const step = Math.max(7, w / 90);
  for (let yy = y + step / 2; yy < y + h; yy += step) {
    for (let xx = x + step / 2; xx < x + w; xx += step) {
      const r = step * 0.16 * (1 + ((xx + yy) % 3) * 0.25);
      ctx.beginPath(); ctx.arc(xx, yy, r, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

function drawTitleBand(ctx, W, H, grade) {
  const bandY = H * (1 - TITLE_BAND_H) + state.titleShift;
  const bandH = H * TITLE_BAND_H - state.titleShift;
  const g = ctx.createLinearGradient(0, bandY, W, bandY + bandH);
  g.addColorStop(0, grade.mid); g.addColorStop(0.5, grade.bot); g.addColorStop(1, grade.deep);
  ctx.fillStyle = g; ctx.fillRect(0, bandY, W, bandH);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, bandY, W, Math.max(3, H * 0.004));
  if (state.halftone) { ctx.globalAlpha = 0.16; drawHalftone(ctx, 0, bandY, W, bandH * 0.5, '#ffffff'); ctx.globalAlpha = 1; }
  /* badge ribbon, top-right of the band */
  const badge = state.badge.trim();
  if (badge) {
    ctx.font = `700 ${Math.round(H * 0.016)}px sans-serif`;
    const bw = ctx.measureText(badge).width + H * 0.03;
    const bx = W - bw - W * 0.02, by = bandY + H * 0.018;
    ctx.save(); ctx.translate(bx + bw / 2, by + H * 0.013); ctx.rotate(-0.03);
    ctx.fillStyle = '#ffe95e'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.rect(-bw / 2, -H * 0.013, bw, H * 0.026); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(badge, 0, 1); ctx.restore();
  }
  /* title: huge Anton, white with black outline + neon offset shadows */
  const title = state.title.trim() || 'NEON SHORE';
  let size = H * 0.115;
  ctx.font = `${size}px Anton, sans-serif`;
  while (ctx.measureText(title).width > W * 0.94 && size > H * 0.04) {
    size *= 0.92; ctx.font = `${size}px Anton, sans-serif`;
  }
  const ty = bandY + bandH * 0.56;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.fillStyle = grade.top; ctx.fillText(title, W * 0.035 + size * 0.045, ty + size * 0.045);
  ctx.fillStyle = grade.mid; ctx.fillText(title, W * 0.035 + size * 0.022, ty + size * 0.022);
  ctx.strokeStyle = '#111'; ctx.lineWidth = Math.max(3, size * 0.09);
  ctx.strokeText(title, W * 0.035, ty);
  ctx.fillStyle = '#fff'; ctx.fillText(title, W * 0.035, ty);
  /* subtitle in script + heat stars */
  const sub = state.subtitle.trim();
  const sy = bandY + bandH * 0.90;
  if (sub) {
    ctx.font = `${Math.round(H * 0.032)}px Pacifico, cursive`;
    ctx.fillStyle = '#ffe95e'; ctx.textAlign = 'left';
    ctx.fillText(sub, W * 0.04, sy);
  }
  const stars = '★'.repeat(state.stars) + '☆'.repeat(5 - state.stars);
  ctx.font = `700 ${Math.round(H * 0.026)}px sans-serif`;
  const sw = ctx.measureText(stars).width;
  ctx.fillStyle = '#ffe95e'; ctx.textAlign = 'right';
  ctx.fillText(stars, W * 0.965, sy);
  void sw;
}

function renderCover(ctx, W, H) {
  const grade = gradeOf();
  /* sunset sky backdrop (visible between tilted cards) */
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#1b1035'); sky.addColorStop(0.45, grade.mid);
  sky.addColorStop(0.75, grade.top); sky.addColorStop(1, '#ff7a18');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  /* sun disc behind the panels */
  ctx.save(); ctx.globalAlpha = 0.9;
  const sun = ctx.createRadialGradient(W * 0.5, H * 0.34, 0, W * 0.5, H * 0.34, W * 0.22);
  sun.addColorStop(0, 'rgba(255,233,94,.95)'); sun.addColorStop(0.5, 'rgba(255,122,24,.55)'); sun.addColorStop(1, 'rgba(255,122,24,0)');
  ctx.fillStyle = sun; ctx.beginPath(); ctx.arc(W * 0.5, H * 0.34, W * 0.22, 0, Math.PI * 2); ctx.fill(); ctx.restore();

  const gap = Math.max(4, W * 0.008);
  const layout = layoutOf();
  const gridH = H * (1 - TITLE_BAND_H);
  layout.cells.forEach((cell, i) => {
    const px = cell.x * W + (cell.tilt ? 0 : gap / 2);
    const py = cell.y * gridH + (cell.tilt ? 0 : gap / 2);
    const pw = cell.w * W - (cell.tilt ? 0 : gap);
    const ph = cell.h * gridH - (cell.tilt ? 0 : gap);
    const panel = state.panels[i] || { photo: 0, zoom: 1, ox: 0, oy: 0 };
    const img = photos[panel.photo] ? photos[panel.photo].img : null;
    ctx.save();
    if (cell.tilt) {
      ctx.translate(px + pw / 2, py + ph / 2); ctx.rotate((cell.tilt * Math.PI) / 180);
      ctx.translate(-(px + pw / 2), -(py + ph / 2));
      ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = W * 0.02; ctx.shadowOffsetY = W * 0.008;
      ctx.fillStyle = '#fff'; ctx.fillRect(px - gap, py - gap, pw + gap * 2, ph + gap * 2.4);
      ctx.shadowColor = 'transparent';
    }
    drawPhotoCover(ctx, img, px, py, pw, ph, panel);
    applyGrade(ctx, px, py, pw, ph, grade, state.gradeAmt);
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = Math.max(2, W * 0.002);
    ctx.strokeRect(px, py, pw, ph);
    if (i === selectedPanel && !document.body.classList.contains('shot-cover')) {
      ctx.strokeStyle = '#ffe95e'; ctx.lineWidth = Math.max(4, W * 0.006);
      ctx.strokeRect(px - 2, py - 2, pw + 4, ph + 4);
    }
    ctx.restore();
  });

  drawTitleBand(ctx, W, H, grade);

  if (state.vignette) {
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,4,24,.5)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }
  if (state.grain > 0) {
    ctx.save(); ctx.globalAlpha = state.grain * 0.5; ctx.globalCompositeOperation = 'overlay';
    const pat = ctx.createPattern(grainTile, 'repeat');
    ctx.fillStyle = pat; ctx.fillRect(0, 0, W, H); ctx.restore();
  }
  ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(4, W * 0.006);
  ctx.strokeRect(0, 0, W, H);
}

function renderPreview() {
  const s = sizeOf();
  const scale = Math.min(900 / s.w, 900 / s.h, 1);
  const W = Math.round(s.w * scale), H = Math.round(s.h * scale);
  if (preview.width !== W || preview.height !== H) { preview.width = W; preview.height = H; }
  renderCover(pctx, W, H);
  $('sizeLabel').textContent = `${s.w} × ${s.h}`;
  $('panelInfo').textContent = `Panel ${selectedPanel + 1} of ${layoutOf().cells.length} · photo ${photos.length ? (state.panels[selectedPanel].photo + 1) : '—'} · zoom ${Math.round(state.panels[selectedPanel].zoom * 100)}% — drag the photo to move it.`;
}

/* ---------- controls ---------- */
function buildChips() {
  const lr = $('layoutRow'); lr.innerHTML = '';
  LAYOUTS.forEach((l) => {
    const b = document.createElement('button');
    b.textContent = l.name; b.className = state.layout === l.id ? 'active' : '';
    b.onclick = () => { pushHistory(); state.layout = l.id; selectedPanel = 0; syncControls(); renderPreview(); };
    lr.appendChild(b);
  });
  const sr = $('sizeRow'); sr.innerHTML = '';
  SIZES.forEach((s) => {
    const b = document.createElement('button');
    b.textContent = s.name; b.className = state.size === s.id ? 'active' : '';
    b.onclick = () => { pushHistory(); state.size = s.id; syncControls(); renderPreview(); };
    sr.appendChild(b);
  });
  const gr = $('gradeRow'); gr.innerHTML = '';
  GRADES.forEach((g) => {
    const b = document.createElement('button');
    b.className = state.grade === g.id ? 'active' : '';
    b.innerHTML = `<span class="sw" style="display:block;background:linear-gradient(135deg,${g.top},${g.mid} 55%,${g.bot})"></span><span class="swName">${g.name}</span>`;
    b.onclick = () => { pushHistory(); state.grade = g.id; syncControls(); renderPreview(); };
    gr.appendChild(b);
  });
  const tr = $('thumbRow'); tr.innerHTML = '';
  SIZES.forEach((s) => {
    const b = document.createElement('button');
    b.textContent = `Export ${s.w}×${s.h}`;
    b.onclick = () => { state.size = s.id; syncControls(); renderPreview(); exportPNG(); };
    tr.appendChild(b);
  });
}

function syncControls() {
  buildChips();
  $('titleInput').value = state.title;
  $('subtitleInput').value = state.subtitle;
  $('badgeInput').value = state.badge;
  $('starsInput').value = state.stars;
  $('starsVal').textContent = '★'.repeat(state.stars) + '☆'.repeat(5 - state.stars);
  $('gradeAmt').value = Math.round(state.gradeAmt * 100);
  $('gradeAmtVal').textContent = `${Math.round(state.gradeAmt * 100)}%`;
  $('grainAmt').value = Math.round(state.grain * 100);
  $('grainAmtVal').textContent = `${Math.round(state.grain * 100)}%`;
  $('halftoneChk').checked = state.halftone;
  $('vignetteChk').checked = state.vignette;
  const p = state.panels[selectedPanel];
  $('zoomInput').value = Math.round(p.zoom * 100);
  $('zoomVal').textContent = `${Math.round(p.zoom * 100)}%`;
  renderPhotoStrip();
}

function renderPhotoStrip() {
  const strip = $('photoStrip'); strip.innerHTML = '';
  photos.forEach((ph, i) => {
    const img = document.createElement('img');
    img.src = ph.img.src; img.className = 'thumb' + (i === selectedPhoto ? ' sel' : '');
    img.title = ph.name; img.alt = ph.name;
    img.onclick = () => { selectedPhoto = i; renderPhotoStrip(); };
    strip.appendChild(img);
  });
  if (photos.length === 0) {
    const d = document.createElement('div');
    d.className = 'thumb empty'; d.textContent = 'No photos yet';
    strip.appendChild(d);
  }
}

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, name: file.name, url });
    img.onerror = reject;
    img.src = url;
  });
}
async function addFiles(files) {
  const list = [...files].filter((f) => f.type.startsWith('image/'));
  if (!list.length) return;
  pushHistory();
  for (const f of list) { try { photos.push(await loadImageFile(f)); } catch (e) { /* skip unreadable */ } }
  selectedPhoto = photos.length - 1;
  renderPreview(); renderPhotoStrip();
}
async function loadSamples() {
  for (const name of ['boulevard.jpg', 'pier.jpg']) {
    if (photos.some((p) => p.name === name)) continue;
    try {
      const res = await fetch(`samples/${name}`);
      const blob = await res.blob();
      photos.push(await loadImageFile(new File([blob], name, { type: blob.type })));
    } catch (e) { /* sample missing: keep going */ }
  }
  selectedPhoto = 0; renderPreview(); renderPhotoStrip();
}

function exportPNG() {
  const s = sizeOf();
  const c = document.createElement('canvas');
  c.width = s.w; c.height = s.h;
  const wasShot = document.body.classList.contains('shot-cover');
  document.body.classList.add('shot-cover');
  renderCover(c.getContext('2d'), s.w, s.h);
  if (!wasShot) document.body.classList.remove('shot-cover');
  return new Promise((resolve) => {
    c.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `neon-coast-cover-${s.w}x${s.h}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      resolve(url);
    }, 'image/png');
  });
}
function exportDataURL() {
  const s = sizeOf();
  const c = document.createElement('canvas');
  c.width = s.w; c.height = s.h;
  const wasShot = document.body.classList.contains('shot-cover');
  document.body.classList.add('shot-cover');
  renderCover(c.getContext('2d'), s.w, s.h);
  if (!wasShot) document.body.classList.remove('shot-cover');
  return c.toDataURL('image/png');
}

/* ---------- pointer interaction: pick panel, drag to pan, wheel to zoom ---------- */
function canvasPoint(ev) {
  const r = preview.getBoundingClientRect();
  return { x: (ev.clientX - r.left) * (preview.width / r.width), y: (ev.clientY - r.top) * (preview.height / r.height) };
}
function panelAt(x, y) {
  const gridH = preview.height * (1 - TITLE_BAND_H);
  const cells = layoutOf().cells;
  for (let i = cells.length - 1; i >= 0; i--) {
    const c = cells[i];
    if (x >= c.x * preview.width && x <= (c.x + c.w) * preview.width &&
        y >= c.y * gridH && y <= (c.y + c.h) * gridH) return i;
  }
  return -1;
}
let dragging = null;
preview.addEventListener('pointerdown', (ev) => {
  const pt = canvasPoint(ev);
  const i = panelAt(pt.x, pt.y);
  if (i < 0) return;
  selectedPanel = i; pushHistory();
  dragging = { x: pt.x, y: pt.y, panel: state.panels[i] };
  preview.setPointerCapture(ev.pointerId);
  syncControls(); renderPreview();
});
preview.addEventListener('pointermove', (ev) => {
  if (!dragging) return;
  const pt = canvasPoint(ev);
  dragging.panel.ox += (pt.x - dragging.x) / preview.width;
  dragging.panel.oy += (pt.y - dragging.y) / preview.height;
  dragging.x = pt.x; dragging.y = pt.y;
  renderPreview();
});
preview.addEventListener('pointerup', () => { dragging = null; syncControls(); });
preview.addEventListener('wheel', (ev) => {
  ev.preventDefault();
  const i = selectedPanel;
  pushHistory();
  const p = state.panels[i];
  p.zoom = Math.min(3, Math.max(1, p.zoom * (ev.deltaY < 0 ? 1.08 : 0.92)));
  syncControls(); renderPreview();
}, { passive: false });

/* ---------- wire up ---------- */
$('fileInput').addEventListener('change', (e) => addFiles(e.target.files));
$('sampleBtn').onclick = () => { pushHistory(); loadSamples(); };
$('fillAllBtn').onclick = () => {
  if (!photos.length) return;
  pushHistory();
  state.panels.forEach((p) => { p.photo = selectedPhoto; });
  renderPreview();
};
$('swapBtn').onclick = () => {
  if (!photos.length) return;
  pushHistory();
  const p = state.panels[selectedPanel];
  p.photo = (p.photo + 1) % photos.length;
  selectedPhoto = p.photo; renderPreview(); renderPhotoStrip();
};
$('resetPanelBtn').onclick = () => { pushHistory(); state.panels[selectedPanel] = { photo: 0, zoom: 1, ox: 0, oy: 0 }; syncControls(); renderPreview(); };
$('resetAllBtn').onclick = () => { pushHistory(); state = { ...state, panels: freshPanels(), title: 'NEON SHORE', subtitle: 'Vice City nights', badge: '★ VICE CITY ★', stars: 5 }; syncControls(); renderPreview(); };
$('undoBtn').onclick = () => { if (!history.length) return; future.push(snapshot()); restore(history.pop()); syncUndoRedo(); };
$('redoBtn').onclick = () => { if (!future.length) return; history.push(snapshot()); restore(future.pop()); syncUndoRedo(); };
$('randomBtn').onclick = () => {
  pushHistory();
  state.layout = LAYOUTS[Math.floor(Math.random() * LAYOUTS.length)].id;
  state.grade = GRADES[Math.floor(Math.random() * GRADES.length)].id;
  state.panels.forEach((p) => { if (photos.length) p.photo = Math.floor(Math.random() * photos.length); });
  const titles = [['NEON SHORE', 'Vice City nights'], ['PALM HEIST', 'sunset getaway'], ['NIGHT SHIFT', 'downtown after dark'], ['PIER PRESSURE', 'golden hour crew']];
  const t = titles[Math.floor(Math.random() * titles.length)];
  state.title = t[0]; state.subtitle = t[1];
  selectedPanel = 0; syncControls(); renderPreview();
};
$('exportBtn').onclick = () => exportPNG();
$('titleInput').addEventListener('input', (e) => { state.title = e.target.value; renderPreview(); });
$('titleInput').addEventListener('change', () => pushHistory());
$('subtitleInput').addEventListener('input', (e) => { state.subtitle = e.target.value; renderPreview(); });
$('subtitleInput').addEventListener('change', () => pushHistory());
$('badgeInput').addEventListener('input', (e) => { state.badge = e.target.value; renderPreview(); });
$('badgeInput').addEventListener('change', () => pushHistory());
$('starsInput').addEventListener('input', (e) => { state.stars = +e.target.value; $('starsVal').textContent = '★'.repeat(state.stars) + '☆'.repeat(5 - state.stars); renderPreview(); });
$('gradeAmt').addEventListener('input', (e) => { state.gradeAmt = +e.target.value / 100; $('gradeAmtVal').textContent = `${e.target.value}%`; renderPreview(); });
$('grainAmt').addEventListener('input', (e) => { state.grain = +e.target.value / 100; $('grainAmtVal').textContent = `${e.target.value}%`; renderPreview(); });
$('halftoneChk').addEventListener('change', (e) => { state.halftone = e.target.checked; renderPreview(); });
$('vignetteChk').addEventListener('change', (e) => { state.vignette = e.target.checked; renderPreview(); });
$('zoomInput').addEventListener('input', (e) => { state.panels[selectedPanel].zoom = +e.target.value / 100; $('zoomVal').textContent = `${e.target.value}%`; renderPreview(); });
$('titleUpBtn').onclick = () => { pushHistory(); state.titleShift = Math.max(-60, state.titleShift - 12); renderPreview(); };
$('titleDownBtn').onclick = () => { pushHistory(); state.titleShift = Math.min(60, state.titleShift + 12); renderPreview(); };

/* ---------- shot modes for screenshots: ?shot=cover|editor&photo=..&caption=.. ---------- */
const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot === 'cover') {
  document.body.classList.add('shot-cover');
  const cap = params.get('caption');
  if (cap) state.title = cap;
  const sub = params.get('subtitle');
  if (sub) state.subtitle = sub;
  const lay = params.get('layout');
  if (lay && LAYOUTS.some((l) => l.id === lay)) state.layout = lay;
  const gr = params.get('grade');
  if (gr && GRADES.some((g) => g.id === gr)) state.grade = gr;
  const w = parseInt(params.get('w') || '', 10), h = parseInt(params.get('h') || '', 10);
  const match = SIZES.find((s) => s.w === w && s.h === h);
  if (match) state.size = match.id;
  const photo = params.get('photo') || 'pier';
  loadSamples().then(() => {
    const idx = photos.findIndex((p) => p.name.startsWith(photo));
    if (idx >= 0) { state.panels.forEach((p) => { p.photo = idx; }); state.panels[1] = { photo: idx === 0 ? 1 : 0, zoom: 1.15, ox: 0, oy: 0 }; }
    fitCoverToWindow(); renderPreview();
  });
  window.addEventListener('resize', fitCoverToWindow);
} else {
  loadSamples().then(() => { syncControls(); renderPreview(); });
}
function fitCoverToWindow() {
  const s = sizeOf();
  const scale = Math.min(window.innerWidth / s.w, window.innerHeight / s.h);
  preview.style.width = `${Math.floor(s.w * scale)}px`;
  preview.style.height = `${Math.floor(s.h * scale)}px`;
  preview.style.maxHeight = 'none'; preview.style.maxWidth = 'none';
}

/* test / automation hook: the app's own export, usable from Playwright */
window.__coverApp = {
  get state() { return state; },
  setTitle(t) { state.title = t; syncControls(); renderPreview(); },
  setLayout(id) { state.layout = id; syncControls(); renderPreview(); },
  setSize(id) { state.size = id; syncControls(); renderPreview(); },
  exportDataURL,
  ready: () => photos.length > 0 && document.fonts.check('16px Anton'),
};

syncControls();
syncUndoRedo();
renderPreview();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => renderPreview());
