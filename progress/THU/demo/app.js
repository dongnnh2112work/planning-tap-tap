/* Summit Your Drawing — demo v2 (fixed map pods, real strokes, Wrapped) */
(function () {
  'use strict';

  var CFG = window.SUMMIT_CONFIG;
  var MAP_URI = window.SUMMIT_MAP_DATA_URI || CFG.MAP_IMAGE;

  var PATHG = window.SUMMIT_PATH_GRAPH || { nodes: {}, edges: [], animalSnap: {} };
  (function applySnap() {
    var snap = PATHG.animalSnap || {};
    CFG.ANIMALS.forEach(function (a) {
      if (snap[a.id]) { a.mapX = snap[a.id].mapX; a.mapY = snap[a.id].mapY; }
    });
    (CFG.LANDMARKS || []).forEach(function (L) {
      if (snap[L.id]) { L.mapX = snap[L.id].mapX; L.mapY = snap[L.id].mapY; }
    });
  })();


  function emptyState() {
    return { user: null, drawings: {}, order: [], visited: {} };
  }
  function loadState() {
    try {
      var raw = localStorage.getItem(CFG.STORAGE_KEY);
      if (!raw) return emptyState();
      var s = JSON.parse(raw);
      s.drawings = s.drawings || {}; s.order = s.order || []; s.visited = s.visited || {};
      return s;
    } catch (e) { return emptyState(); }
  }
  function saveState() {
    try { localStorage.setItem(CFG.STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }
  var state = loadState();

  function $(id) { return document.getElementById(id); }
  function show(id) {
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
    var el = $(id); if (el) el.classList.add('active');
    var dir = $('dirSheet'); if (dir) dir.classList.add('hidden');
  }
  function animalById(id) {
    for (var i = 0; i < CFG.ANIMALS.length; i++) if (CFG.ANIMALS[i].id === id) return CFG.ANIMALS[i];
    return null;
  }
  function landmarkById(id) {
    for (var i = 0; i < CFG.LANDMARKS.length; i++) if (CFG.LANDMARKS[i].id === id) return CFG.LANDMARKS[i];
    return null;
  }
  function nodePos(id) {
    if (PATHG.nodes && PATHG.nodes[id]) return { x: PATHG.nodes[id].x, y: PATHG.nodes[id].y };
    var a = animalById(id); if (a) return { x: a.mapX, y: a.mapY };
    var l = landmarkById(id); if (l) return { x: l.mapX, y: l.mapY };
    return null;
  }
  function drawnCount() {
    var n = 0; for (var k in state.drawings) if (state.drawings.hasOwnProperty(k)) n++; return n;
  }
  function drawnAnimals() {
    var list = [];
    for (var i = 0; i < state.order.length; i++) {
      var a = animalById(state.order[i]);
      if (a && state.drawings[a.id]) list.push(a);
    }
    return list;
  }
  function pickMotion(id) {
    var m = CFG.MOTIONS, h = 0;
    for (var i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * 17) % m.length;
    return m[h];
  }
  function pointerPos(e, el) {
    var rect = el.getBoundingClientRect();
    var scale = rect.width / (el.offsetWidth || rect.width) || 1;
    var cx, cy;
    if (e.touches && e.touches.length) { cx = e.touches[0].clientX; cy = e.touches[0].clientY; }
    else if (e.changedTouches && e.changedTouches.length) { cx = e.changedTouches[0].clientX; cy = e.changedTouches[0].clientY; }
    else { cx = e.clientX; cy = e.clientY; }
    return { x: (cx - rect.left) / scale, y: (cy - rect.top) / scale };
  }

  /* Graph — extracted grey paths from map-v3 */
  function buildGraph() {
    var g = {};
    function add(a, b, w) { if (!g[a]) g[a] = []; g[a].push({ to: b, w: w }); }
    var edges = (PATHG.edges && PATHG.edges.length) ? PATHG.edges : CFG.PATH_EDGES;
    for (var i = 0; i < edges.length; i++) {
      var e = edges[i]; add(e[0], e[1], e[2]); add(e[1], e[0], e[2]);
    }
    return g;
  }
  var GRAPH = buildGraph();

  function attachId(id) {
    var snap = PATHG.animalSnap && PATHG.animalSnap[id];
    return (snap && snap.attach) ? snap.attach : id;
  }
  function routeBetween(fromId, toId) {
    return shortestPath(attachId(fromId), attachId(toId));
  }

  function catmullRomPath(pts, segments) {
    segments = segments || 8;
    if (!pts || pts.length < 2) return pts || [];
    if (pts.length === 2) return pts.slice();
    var out = [];
    var p = pts.slice();
    p.unshift(pts[0]);
    p.push(pts[pts.length - 1]);
    for (var i = 0; i < p.length - 3; i++) {
      var p0 = p[i], p1 = p[i + 1], p2 = p[i + 2], p3 = p[i + 3];
      for (var j = 0; j < segments; j++) {
        var tt = j / segments, t2 = tt * tt, t3 = t2 * tt;
        out.push({
          x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * tt + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * tt + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
        });
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  function dist2(a, b) {
    var dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy;
  }
  function dist(a, b) { return Math.sqrt(dist2(a, b)); }

  /* Ramer–Douglas–Peucker; epsilon in map-% units (~6px on 368px world ≈ 1.6) */
  function rdpSimplify(pts, epsilon) {
    if (!pts || pts.length < 3) return pts ? pts.slice() : [];
    epsilon = epsilon == null ? 1.6 : epsilon;
    var keep = new Array(pts.length); keep[0] = true; keep[pts.length - 1] = true;
    function rec(i0, i1) {
      if (i1 <= i0 + 1) return;
      var a = pts[i0], b = pts[i1];
      var abx = b.x - a.x, aby = b.y - a.y;
      var ab2 = abx * abx + aby * aby || 1e-9;
      var maxD = -1, maxI = -1;
      for (var i = i0 + 1; i < i1; i++) {
        var px = pts[i].x - a.x, py = pts[i].y - a.y;
        var t = Math.max(0, Math.min(1, (px * abx + py * aby) / ab2));
        var cx = a.x + t * abx, cy = a.y + t * aby;
        var d = Math.sqrt((pts[i].x - cx) * (pts[i].x - cx) + (pts[i].y - cy) * (pts[i].y - cy));
        if (d > maxD) { maxD = d; maxI = i; }
      }
      if (maxD > epsilon && maxI > 0) {
        keep[maxI] = true;
        rec(i0, maxI); rec(maxI, i1);
      }
    }
    rec(0, pts.length - 1);
    var out = [];
    for (var i = 0; i < pts.length; i++) if (keep[i]) out.push(pts[i]);
    return out;
  }

  /* Drop hairpin / reverse turnbacks: interior angle < 60° (turn > 120°) over short span */
  function removeSharpReversals(pts) {
    if (!pts || pts.length < 3) return pts ? pts.slice() : [];
    var out = [pts[0]];
    for (var i = 1; i < pts.length - 1; i++) {
      var a = out[out.length - 1], b = pts[i], c = pts[i + 1];
      var d1 = dist(a, b), d2 = dist(b, c);
      if (d1 < 0.05) continue;
      var ux = (b.x - a.x) / d1, uy = (b.y - a.y) / d1;
      var vx = c.x - b.x, vy = c.y - b.y;
      var vlen = Math.sqrt(vx * vx + vy * vy) || 1;
      vx /= vlen; vy /= vlen;
      var dot = ux * vx + uy * vy; /* 1=straight, -1=reverse */
      var short = (d1 + d2) < 6.0;
      if (short && dot < -0.5) {
        /* skip b — reverse/hairpin */
        continue;
      }
      out.push(b);
    }
    out.push(pts[pts.length - 1]);
    /* second pass */
    if (out.length >= 3) {
      var out2 = [out[0]];
      for (var i = 1; i < out.length - 1; i++) {
        var a = out2[out2.length - 1], b = out[i], c = out[i + 1];
        var d1 = dist(a, b), d2 = dist(b, c);
        if (d1 < 0.05) continue;
        var ux = (b.x - a.x) / d1, uy = (b.y - a.y) / d1;
        var vx = (c.x - b.x), vy = (c.y - b.y);
        var vlen = Math.sqrt(vx * vx + vy * vy) || 1;
        var dot = ux * (vx / vlen) + uy * (vy / vlen);
        if ((d1 + d2) < 7.0 && dot < -0.35) continue;
        out2.push(b);
      }
      out2.push(out[out.length - 1]);
      out = out2;
    }
    return out;
  }

  function chaikinSmooth(pts, iterations) {
    iterations = iterations == null ? 2 : iterations;
    if (!pts || pts.length < 3) return pts ? pts.slice() : [];
    var cur = pts.slice();
    for (var it = 0; it < iterations; it++) {
      var next = [cur[0]];
      for (var i = 0; i < cur.length - 1; i++) {
        var a = cur[i], b = cur[i + 1];
        next.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y });
        next.push({ x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y });
      }
      next.push(cur[cur.length - 1]);
      cur = next;
    }
    return cur;
  }

  /* Light smoother: RDP then Catmull-Rom only (no Chaikin — keeps route on-road) */
  function smoothRoutePoints(pts) {
    if (!pts || pts.length < 2) return pts ? pts.slice() : [];
    var p = removeSharpReversals(pts);
    p = rdpSimplify(p, 0.85); /* ~3px — light simplify */
    if (p.length < 2) p = pts.slice(0, 2);
    p = catmullRomPath(p, p.length > 40 ? 2 : 3);
    return p;
  }

  function pathPoints(pathIds) {
    var pts = [];
    for (var i = 0; i < pathIds.length; i++) {
      var p = nodePos(pathIds[i]); if (p) pts.push({ x: p.x, y: p.y });
    }
    return smoothRoutePoints(pts);
  }

  function shortestPath(from, to) {
    if (from === to) return { path: [from], dist: 0 };
    var dist = {}, prev = {}, q = [];
    for (var k in GRAPH) { dist[k] = Infinity; q.push(k); }
    if (dist[from] === undefined) return null;
    dist[from] = 0;
    while (q.length) {
      q.sort(function (a, b) { return dist[a] - dist[b]; });
      var u = q.shift();
      if (u === to) break;
      (GRAPH[u] || []).forEach(function (edge) {
        var alt = dist[u] + edge.w;
        if (alt < (dist[edge.to] == null ? Infinity : dist[edge.to])) {
          dist[edge.to] = alt; prev[edge.to] = u;
          if (q.indexOf(edge.to) < 0 && GRAPH[edge.to]) q.push(edge.to);
        }
      });
    }
    if (dist[to] == null || !isFinite(dist[to])) return null;
    var path = [to];
    while (path[0] !== from) {
      if (!prev[path[0]]) return null;
      path.unshift(prev[path[0]]);
    }
    return { path: path, dist: dist[to] };
  }

  function nearestUndrawn(fromId) {
    var best = null, bestD = Infinity;
    for (var i = 0; i < CFG.ANIMALS.length; i++) {
      var a = CFG.ANIMALS[i];
      if (state.drawings[a.id] || a.id === fromId) continue;
      var sp = routeBetween(fromId, a.id);
      var d = sp ? sp.dist : 9999;
      if (d < bestD) { bestD = d; best = { animal: a, route: sp }; }
    }
    return best;
  }

  /* Welcome */
  function resetDemo() {
    state = emptyState(); saveState(); show('screen-welcome');
  }
  $('btnReset').addEventListener('click', function () {
    if (confirm('Xóa toàn bộ tiến độ demo?')) resetDemo();
  });
  (function () {
    var t = $('welcomeTitle'), timer = null;
    t.addEventListener('pointerdown', function () {
      timer = setTimeout(function () { if (confirm('Giữ tiêu đề — reset demo?')) resetDemo(); }, 900);
    });
    t.addEventListener('pointerup', function () { clearTimeout(timer); });
    t.addEventListener('pointerleave', function () { clearTimeout(timer); });
  })();

  $('btnScanNfc').addEventListener('click', function () {
    if (drawnCount() === 0 && !state.drawings[CFG.FIRST_ANIMAL]) startDraw(CFG.FIRST_ANIMAL);
    else openNfcPicker();
  });

  /* NFC */
  function openNfcPicker() {
    var grid = $('animalGrid'); grid.innerHTML = '';
    CFG.ANIMALS.forEach(function (a) {
      var done = !!state.drawings[a.id];
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'animal-card' + (done ? ' done' : '');
      btn.innerHTML = '<span class="em">' + a.emoji + '</span><span><div class="nm">' + a.name + '</div><div class="st">' + (done ? 'Đã vẽ' : 'Chưa vẽ') + '</div></span>';
      btn.addEventListener('click', function () { startDraw(a.id); });
      grid.appendChild(btn);
    });
    show('screen-nfc');
  }
  $('btnNfcBack').addEventListener('click', function () {
    if (drawnCount() > 0) openMap(); else show('screen-welcome');
  });

  /* Drawing */
  var draw = {
    animalId: null, strokes: [], current: null, mode: 'brush',
    timerId: null, left: CFG.DRAW_SECONDS, startedAt: 0, autoSubmit: false, canvasApi: null,
  };

  function setupCanvas() {
    var canvas = $('drawCanvas'), wrap = $('canvasWrap');
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    var w = wrap.clientWidth, h = wrap.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    return { canvas: canvas, ctx: ctx, w: w, h: h, dpr: dpr };
  }
  function redrawStrokes(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    draw.strokes.forEach(function (s) {
      if (s.erased || s.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = CFG.BRUSH_COLOR; ctx.lineWidth = CFG.BRUSH_WIDTH;
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (var j = 1; j < s.points.length; j++) ctx.lineTo(s.points[j].x, s.points[j].y);
      ctx.stroke();
    });
  }
  function hitStroke(x, y) {
    var thresh = 14;
    for (var i = draw.strokes.length - 1; i >= 0; i--) {
      var s = draw.strokes[i]; if (s.erased) continue;
      for (var j = 0; j < s.points.length; j++) {
        var dx = s.points[j].x - x, dy = s.points[j].y - y;
        if (dx * dx + dy * dy <= thresh * thresh) return i;
      }
    }
    return -1;
  }
  function startDraw(animalId) {
    var a = animalById(animalId); if (!a) return;
    draw.animalId = animalId; draw.strokes = []; draw.current = null;
    draw.mode = 'brush'; draw.left = CFG.DRAW_SECONDS; draw.autoSubmit = false;
    draw.startedAt = Date.now();
    $('drawAnimalName').textContent = a.emoji + ' ' + a.name;
    $('btnBrush').classList.add('active'); $('btnEraser').classList.remove('active');
    $('chkGuide').checked = false;
    var guide = $('guideLayer');
    var pack = (window.SUMMIT_GUIDES && window.SUMMIT_GUIDES[animalId]) || null;
    /* data URI so the hint works on file:// without fetch */
    guide.src = (pack && pack.dataUri) || a.guide;
    guide.classList.remove('on');
    show('screen-draw');
    requestAnimationFrame(function () {
      draw.canvasApi = setupCanvas();
      redrawStrokes(draw.canvasApi.ctx, draw.canvasApi.w, draw.canvasApi.h);
      bindDrawEvents(draw.canvasApi);
      startTimer();
    });
  }
  function startTimer() {
    clearInterval(draw.timerId); updateTimerUi();
    draw.timerId = setInterval(function () {
      draw.left -= 1; updateTimerUi();
      if (draw.left <= 0) { clearInterval(draw.timerId); draw.autoSubmit = true; submitDrawing(); }
    }, 1000);
  }
  function updateTimerUi() {
    var m = Math.floor(draw.left / 60), s = draw.left % 60;
    var el = $('timer');
    el.textContent = m + ':' + (s < 10 ? '0' : '') + s;
    el.classList.toggle('warn', draw.left <= 10);
  }
  function bindDrawEvents(c) {
    var canvas = c.canvas;
    function onDown(e) {
      e.preventDefault();
      var p = pointerPos(e, canvas);
      if (draw.mode === 'eraser') {
        var idx = hitStroke(p.x, p.y);
        if (idx >= 0) { draw.strokes[idx].erased = true; redrawStrokes(c.ctx, c.w, c.h); }
        return;
      }
      draw.current = { points: [p], erased: false };
      draw.strokes.push(draw.current);
    }
    function onMove(e) {
      e.preventDefault();
      if (draw.mode === 'eraser') {
        if (!(e.buttons || (e.touches && e.touches.length))) return;
        var p2 = pointerPos(e, canvas);
        var idx = hitStroke(p2.x, p2.y);
        if (idx >= 0) { draw.strokes[idx].erased = true; redrawStrokes(c.ctx, c.w, c.h); }
        return;
      }
      if (!draw.current) return;
      draw.current.points.push(pointerPos(e, canvas));
      redrawStrokes(c.ctx, c.w, c.h);
    }
    function onUp(e) { e.preventDefault(); draw.current = null; }
    canvas.onpointerdown = onDown; canvas.onpointermove = onMove;
    canvas.onpointerup = onUp; canvas.onpointercancel = onUp;
    canvas.ontouchstart = onDown; canvas.ontouchmove = onMove; canvas.ontouchend = onUp;
  }
  $('btnBrush').addEventListener('click', function () {
    draw.mode = 'brush'; $('btnBrush').classList.add('active'); $('btnEraser').classList.remove('active');
  });
  $('btnEraser').addEventListener('click', function () {
    draw.mode = 'eraser'; $('btnEraser').classList.add('active'); $('btnBrush').classList.remove('active');
  });
  $('btnUndo').addEventListener('click', function () {
    for (var i = draw.strokes.length - 1; i >= 0; i--) {
      if (!draw.strokes[i].erased) { draw.strokes.splice(i, 1); break; }
    }
    if (draw.canvasApi) redrawStrokes(draw.canvasApi.ctx, draw.canvasApi.w, draw.canvasApi.h);
  });
  $('chkGuide').addEventListener('change', function () {
    $('guideLayer').classList.toggle('on', $('chkGuide').checked);
  });
  $('btnSubmit').addEventListener('click', function () { submitDrawing(); });

  function cropTransparentPng(sourceCanvas) {
    var w = sourceCanvas.width, h = sourceCanvas.height;
    var ctx = sourceCanvas.getContext('2d');
    var img = ctx.getImageData(0, 0, w, h), data = img.data;
    var minX = w, minY = h, maxX = 0, maxY = 0, found = false;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var i = (y * w + x) * 4;
      if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) {
        found = true;
        if (x < minX) minX = x; if (y < minY) minY = y;
        if (x > maxX) maxX = x; if (y > maxY) maxY = y;
      }
    }
    var out = document.createElement('canvas');
    if (!found) { out.width = 64; out.height = 64; return out.toDataURL('image/png'); }
    var pad = 8;
    minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
    maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad);
    var cw = maxX - minX + 1, ch = maxY - minY + 1;
    out.width = cw; out.height = ch;
    var octx = out.getContext('2d');
    var src = ctx.getImageData(minX, minY, cw, ch);
    var dst = octx.createImageData(cw, ch);
    for (var p = 0; p < src.data.length; p += 4) {
      if (src.data[p] >= 245 && src.data[p + 1] >= 245 && src.data[p + 2] >= 245) {
        dst.data[p] = dst.data[p + 1] = dst.data[p + 2] = dst.data[p + 3] = 0;
      } else {
        dst.data[p] = src.data[p]; dst.data[p + 1] = src.data[p + 1];
        dst.data[p + 2] = src.data[p + 2]; dst.data[p + 3] = 255;
      }
    }
    octx.putImageData(dst, 0, 0);
    return out.toDataURL('image/png');
  }

  function submitDrawing() {
    clearInterval(draw.timerId);
    var canvas = $('drawCanvas'), wrap = $('canvasWrap');
    var tmp = document.createElement('canvas');
    tmp.width = canvas.width; tmp.height = canvas.height;
    var tctx = tmp.getContext('2d');
    var dpr = canvas.width / wrap.clientWidth;
    tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    tctx.fillStyle = '#ffffff'; tctx.fillRect(0, 0, wrap.clientWidth, wrap.clientHeight);
    tctx.lineCap = 'round'; tctx.lineJoin = 'round';
    draw.strokes.forEach(function (s) {
      if (s.erased || s.points.length < 2) return;
      tctx.beginPath(); tctx.strokeStyle = CFG.BRUSH_COLOR; tctx.lineWidth = CFG.BRUSH_WIDTH;
      tctx.moveTo(s.points[0].x, s.points[0].y);
      for (var j = 1; j < s.points.length; j++) tctx.lineTo(s.points[j].x, s.points[j].y);
      tctx.stroke();
    });
    var dataUrl = cropTransparentPng(tmp);
    var durationSec = Math.max(1, Math.round((Date.now() - draw.startedAt) / 1000));
    if (draw.left <= 0) durationSec = CFG.DRAW_SECONDS;
    var id = draw.animalId;
    if (!state.drawings[id]) state.order.push(id);
    state.drawings[id] = {
      dataUrl: dataUrl, durationSec: durationSec, autoSubmit: !!draw.autoSubmit,
      motion: pickMotion(id), at: Date.now(),
    };
    state.visited[id] = true; saveState();
    if (!state.user) show('screen-login');
    else openMap();
  }
  $('btnGoogleLogin').addEventListener('click', function () {
    state.user = { name: 'Demo User', email: 'demo@thao-cam-vien.local' };
    saveState(); openMap();
  });

  /* Map */
  var mapView = { scale: 1, x: 0, y: 0, min: 1, max: 2.8 };
  var mapDrag = null;
  function applyMapTransform() {
    $('mapWorld').style.transform = 'translate(' + mapView.x + 'px,' + mapView.y + 'px) scale(' + mapView.scale + ')';
  }
  function fillWidthScale() {
    var vp = $('mapViewport'), world = $('mapWorld');
    return vp.clientWidth / Math.max(1, world.offsetWidth);
  }
  function sheetOverlapPx() {
    var vp = $('mapViewport');
    var sheet = $('dirSheet');
    if (!vp || !sheet || sheet.classList.contains('hidden')) return 0;
    var card = sheet.querySelector('.sheet-card');
    if (!card) return 0;
    var vr = vp.getBoundingClientRect();
    var cr = card.getBoundingClientRect();
    return Math.max(0, Math.min(vr.height, vr.bottom - cr.top));
  }
  function clampMap(opts) {
    opts = opts || {};
    var vp = $('mapViewport'), vw = vp.clientWidth, vhFull = vp.clientHeight;
    var sheetReserve = opts.sheetReserve;
    if (sheetReserve == null) sheetReserve = sheetOverlapPx();
    var usableH = Math.max(120, vhFull - sheetReserve);
    var world = $('mapWorld');
    /* never zoom below fill-width — no white gutters beside the map */
    var fillW = fillWidthScale();
    if (mapView.scale < fillW) mapView.scale = fillW;
    mapView.min = fillW;
    var ww = world.offsetWidth * mapView.scale, wh = world.offsetHeight * mapView.scale;
    if (ww <= vw + 0.5) mapView.x = (vw - ww) / 2;
    else mapView.x = Math.max(vw - ww, Math.min(0, mapView.x));
    if (wh <= usableH + 0.5) {
      /* map shorter than usable band: vertically center (blends into white map bg) */
      mapView.y = (usableH - wh) / 2;
    } else {
      var minY = usableH - wh;
      mapView.y = Math.max(minY, Math.min(0, mapView.y));
    }
  }
  function setZoom(next, cx, cy) {
    var vp = $('mapViewport'), vw = vp.clientWidth, vh = vp.clientHeight;
    cx = cx == null ? vw / 2 : cx; cy = cy == null ? vh / 2 : cy;
    var prev = mapView.scale;
    mapView.scale = Math.max(mapView.min, Math.min(mapView.max, next));
    var k = mapView.scale / prev;
    mapView.x = cx - (cx - mapView.x) * k;
    mapView.y = cy - (cy - mapView.y) * k;
    clampMap(); applyMapTransform();
  }
  function bindMapGestures() {
    var vp = $('mapViewport');
    vp.onpointerdown = function (e) {
      if (e.target.closest && e.target.closest('.encl-cell')) return;
      mapDrag = { x: e.clientX, y: e.clientY, ox: mapView.x, oy: mapView.y, id: e.pointerId };
      try { vp.setPointerCapture(e.pointerId); } catch (err) {}
    };
    vp.onpointermove = function (e) {
      if (!mapDrag || e.pointerId !== mapDrag.id) return;
      var scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fit')) || 1;
      mapView.x = mapDrag.ox + (e.clientX - mapDrag.x) / scale;
      mapView.y = mapDrag.oy + (e.clientY - mapDrag.y) / scale;
      clampMap(); applyMapTransform();
    };
    vp.onpointerup = function () { mapDrag = null; };
    vp.onpointercancel = function () { mapDrag = null; };
    vp.addEventListener('wheel', function (e) {
      e.preventDefault();
      var rect = vp.getBoundingClientRect();
      var fit = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fit')) || 1;
      setZoom(mapView.scale * (e.deltaY < 0 ? 1.12 : 0.9), (e.clientX - rect.left) / fit, (e.clientY - rect.top) / fit);
    }, { passive: false });
  }
  $('btnZoomIn').addEventListener('click', function () { setZoom(mapView.scale * 1.3); });
  $('btnZoomOut').addEventListener('click', function () { setZoom(mapView.scale / 1.3); });
  $('btnZoomReset').addEventListener('click', function () { overviewMap(); });
  $('btnZoomReset').title = 'Thu gọn · toàn cảnh';


  function drawSpurSvg(svg) {
    svg.innerHTML = '';
    var spurs = (PATHG && PATHG.spurs) || [];
    spurs.forEach(function (sp) {
      var a = sp.from, b = sp.to;
      if (!a || !b) return;
      /* slight hand-drawn wobble via quadratic mid */
      var mx = (a[0] + b[0]) / 2 + (b[1] - a[1]) * 0.08;
      var my = (a[1] + b[1]) / 2 - (b[0] - a[0]) * 0.08;
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M' + a[0] + ' ' + a[1] + ' Q' + mx + ' ' + my + ' ' + b[0] + ' ' + b[1]);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', '#b0b0b0');
      path.setAttribute('stroke-width', '0.55');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('opacity', '0.85');
      svg.appendChild(path);
    });
  }

  function drawPathSvg(svg, edges) {
    svg.innerHTML = '';
    edges.forEach(function (e) {
      var a = nodePos(e[0]), b = nodePos(e[1]);
      if (!a || !b) return;
      var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
      line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
      line.setAttribute('stroke', CFG.COLORS.path);
      line.setAttribute('stroke-width', '0.55');
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('opacity', '0.55');
      svg.appendChild(line);
    });
  }

  function drawRouteSvg(svg, pathIds, opts) {
    opts = opts || {};
    svg.innerHTML = '';
    if (!pathIds || pathIds.length < 2) return null;
    var raw = [];
    for (var i = 0; i < pathIds.length; i++) {
      var p = nodePos(pathIds[i]); if (p) raw.push(p);
    }
    if (raw.length < 2) return null;
    var pts = smoothRoutePoints(raw);
    var d = '';
    for (var i = 0; i < pts.length; i++) d += (i === 0 ? 'M' : 'L') + pts[i].x.toFixed(2) + ' ' + pts[i].y.toFixed(2) + ' ';

    function mk(cls, w, color, opacity) {
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', color);
      path.setAttribute('stroke-width', String(w));
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      if (opacity != null) path.setAttribute('opacity', String(opacity));
      path.setAttribute('class', cls);
      svg.appendChild(path);
      return path;
    }
    /* Google Maps–style thin dotted stubs: user → route start, route end → dest pin */
    function animalXY(id) {
      var a = animalById(id);
      if (a) return { x: a.mapX, y: a.mapY };
      return nodePos(id);
    }
    function mkDot(x1, y1, x2, y2) {
      if (x1 == null || x2 == null) return;
      var dx = x2 - x1, dy = y2 - y1;
      if (Math.sqrt(dx * dx + dy * dy) < 0.35) return;
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M' + x1.toFixed(2) + ' ' + y1.toFixed(2) + ' L' + x2.toFixed(2) + ' ' + y2.toFixed(2));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', '#1A73E8');
      path.setAttribute('stroke-width', '0.42');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-dasharray', '0.55 0.85');
      path.setAttribute('opacity', '0.95');
      path.setAttribute('class', 'gmaps-route-stub');
      svg.appendChild(path);
    }
    var fromXY = opts.fromId ? animalXY(opts.fromId) : null;
    var toXY = opts.toId ? animalXY(opts.toId) : null;
    if (fromXY && pts[0]) mkDot(fromXY.x, fromXY.y, pts[0].x, pts[0].y);
    if (toXY && pts[pts.length - 1]) mkDot(pts[pts.length - 1].x, pts[pts.length - 1].y, toXY.x, toXY.y);

    /* ~6px visual at default zoom: viewBox is 0-100 so ~0.7–0.9 */
    mk('gmaps-route-outer', 1.45, '#0d47a1', 0.28);
    mk('gmaps-route-outline', 1.25, '#ffffff', 1);
    var main = mk('gmaps-route', 0.72, opts.color || '#1A73E8', 1);

    /* evenly spaced chevron arrows */
    var total = 0; var seglen = [];
    for (var i = 0; i < pts.length - 1; i++) {
      var dx = pts[i + 1].x - pts[i].x, dy = pts[i + 1].y - pts[i].y;
      var L = Math.sqrt(dx * dx + dy * dy); seglen.push(L); total += L;
    }
    var spacing = Math.max(3.5, total / 10);
    var acc = 0, next = spacing;
    for (var i = 0; i < seglen.length; i++) {
      var a = pts[i], b = pts[i + 1], L = seglen[i];
      while (acc + L >= next && L > 0.001) {
        var lt = (next - acc) / L;
        var x = a.x + (b.x - a.x) * lt, y = a.y + (b.y - a.y) * lt;
        var ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
        var arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        arrow.setAttribute('points', '-0.55,-0.45 0.7,0 -0.55,0.45');
        arrow.setAttribute('fill', '#fff');
        arrow.setAttribute('transform', 'translate(' + x + ' ' + y + ') rotate(' + ang + ')');
        svg.appendChild(arrow);
        next += spacing;
      }
      acc += L;
    }

    if (opts.animate) {
      try {
        var len = main.getTotalLength();
        main.style.strokeDasharray = String(len);
        main.style.strokeDashoffset = String(len);
        main.getBoundingClientRect();
        main.style.transition = 'stroke-dashoffset 0.85s ease-out';
        main.style.strokeDashoffset = '0';
      } catch (err) {}
    }
    return { pts: pts, pathIds: pathIds, smooth: pts };
  }

  function fitRouteInView(pathIds) {
    var pts = pathPoints(pathIds);
    if (!pts.length) return;
    var minX = 100, maxX = 0, minY = 100, maxY = 0;
    pts.forEach(function (p) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    });
    function includeAnimal(id) {
      var da = animalById(id);
      if (!da) return;
      if (da.mapX < minX) minX = da.mapX; if (da.mapX > maxX) maxX = da.mapX;
      if (da.mapY < minY) minY = da.mapY; if (da.mapY > maxY) maxY = da.mapY;
    }
    if (dirTarget) includeAnimal(dirTarget);
    var fromId = state.order && state.order.length ? state.order[state.order.length - 1] : null;
    if (fromId) includeAnimal(fromId);
    var pad = 6;
    minX = Math.max(0, minX - pad); maxX = Math.min(100, maxX + pad);
    minY = Math.max(0, minY - pad); maxY = Math.min(100, maxY + pad);

    var vp = $('mapViewport');
    var sheet = $('dirSheet');
    var sheetCard = sheet && sheet.querySelector('.sheet-card');
    var vw = Math.max(1, vp.clientWidth);
    var world = $('mapWorld');
    var ww = world.offsetWidth, wh = world.offsetHeight;
    var fillW = fillWidthScale();

    /* compact sheet when route is tall relative to the frame */
    var routeHfrac = (maxY - minY) / 100;
    if (sheetCard) {
      if (routeHfrac > 0.45) sheetCard.classList.add('compact');
      else sheetCard.classList.remove('compact');
    }
    /* only the part of the sheet-card that actually covers the viewport */
    var sheetH = sheetOverlapPx();
    if (sheet && !sheet.classList.contains('hidden') && sheetCard && sheetH < 8) {
      /* card just below viewport — still leave a tiny pad */
      sheetH = 4;
    }
    var usableTop = 0;
    var usableH = Math.max(140, vp.clientHeight - sheetH);

    var bw = ((maxX - minX) / 100) * ww;
    var bh = ((maxY - minY) / 100) * wh;
    var fitMax = 1.55;
    /* prefer fitting the route, but NEVER below fill-width */
    var scale = Math.min(vw / Math.max(bw, 24), usableH / Math.max(bh, 24), fitMax);
    scale = Math.max(fillW, Math.min(fitMax, scale * 0.94));
    mapView.scale = scale;

    /* if still can't fit height at fill-width, keep fillW and center start↔dest vertically */
    var cx = ((minX + maxX) / 2 / 100) * ww * scale;
    var cy = ((minY + maxY) / 2 / 100) * wh * scale;
    mapView.x = vw / 2 - cx;
    mapView.y = usableH / 2 - cy;
    clampMap({ sheetReserve: sheetH });
    applyMapTransform();
  }



  function seededRand(seed) {
    var x = Math.sin((seed + 1) * 127.1) * 43758.5453;
    return x - Math.floor(x);
  }

  function enclosurePenPath(seed) {
    /* organic soft pad: Catmull-Rom through irregular vertices → cubic SVG
       NOT circle/oval — uneven aspect + concave dents; seed-stable */
    var n = 7;
    var pts = [];
    var aspect = 0.50 + seededRand(seed * 3 + 1) * 0.24; /* clearly flatter */
    for (var i = 0; i < n; i++) {
      var ang = (i / n) * Math.PI * 2 - Math.PI / 2;
      ang += (seededRand(seed * 13 + i) - 0.5) * 0.38; /* uneven spacing */
      var wobble = 0.55 + seededRand(seed * 11 + i * 17) * 0.58;
      if (seededRand(seed * 19 + i * 7) > 0.42) wobble *= 0.58; /* dent */
      if (seededRand(seed * 29 + i * 3) > 0.72) wobble *= 1.25; /* bulge */
      var rx = 46 * wobble;
      var ry = 46 * aspect * (0.72 + seededRand(seed * 5 + i) * 0.42);
      pts.push({
        x: 50 + Math.cos(ang) * rx,
        y: 35 + Math.sin(ang) * ry
      });
    }
    /* Catmull-Rom → cubic bezier closed */
    function get(i) { return pts[(i + pts.length) % pts.length]; }
    var d = '';
    for (var i = 0; i < pts.length; i++) {
      var p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
      var c1x = p1.x + (p2.x - p0.x) / 6;
      var c1y = p1.y + (p2.y - p0.y) / 6;
      var c2x = p2.x - (p3.x - p1.x) / 6;
      var c2y = p2.y - (p3.y - p1.y) / 6;
      if (i === 0) d += 'M' + p1.x.toFixed(1) + ' ' + p1.y.toFixed(1);
      d += ' C' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) + ' ' +
           c2x.toFixed(1) + ' ' + c2y.toFixed(1) + ' ' +
           p2.x.toFixed(1) + ' ' + p2.y.toFixed(1);
    }
    return d + ' Z';
  }

  function enclosureOffset(a, ai) {
    /* curated inset positions; tiny path-hug; keep off hard edges so cover view clips less */
    var snap = PATHG.animalSnap && PATHG.animalSnap[a.id];
    var ax = a.mapX, ay = a.mapY;
    if (snap && snap.attach && PATHG.nodes[snap.attach]) {
      var att = PATHG.nodes[snap.attach];
      var dx = ax - att.x, dy = ay - att.y;
      ax = att.x + dx * 0.92;
      ay = att.y + dy * 0.92;
    }
    ax = Math.max(16.5, Math.min(83.5, ax));
    ay = Math.max(9, Math.min(88, ay));
    return { x: ax, y: ay };
  }

  function renderMap() {
    $('mapBg').src = MAP_URI;
    /* hide spur scratches — routing still uses attach graph */
    if ($('mapPaths')) { $('mapPaths').innerHTML = ''; $('mapPaths').style.display = 'none'; }
    var cells = $('mapCells'); cells.innerHTML = '';
    CFG.ANIMALS.forEach(function (a, ai) {
      var d = state.drawings[a.id];
      var cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'encl-cell ' + (d ? 'drawn ' + (d.motion || 'bob') : 'undrawn');
      var pos = enclosureOffset(a, ai);
      cell.style.left = pos.x + '%';
      cell.style.top = pos.y + '%';
      cell.setAttribute('data-id', a.id);
      cell.style.setProperty('--encl-rot', ((ai * 23) % 13 - 6) + 'deg');

      var pad = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      pad.setAttribute('class', 'encl-pad');
      pad.setAttribute('viewBox', '0 0 100 70');
      pad.setAttribute('preserveAspectRatio', 'none');
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', enclosurePenPath(ai * 3 + 1));
      if (d) {
        path.setAttribute('class', 'pad-drawn ' + (ai % 2 ? 'tint-mint' : 'tint-lemon'));
      } else {
        path.setAttribute('class', 'pad-empty');
      }
      pad.appendChild(path);
      cell.appendChild(pad);

      var inner = document.createElement('div');
      inner.className = 'encl-inner';
      if (d) {
        var img = document.createElement('img');
        img.className = 'drawing'; img.src = d.dataUrl; img.alt = a.short || a.name;
        inner.appendChild(img);
      }
      /* undrawn: no center grey dot — only dotted pen + label */
      cell.appendChild(inner);

      var tag = document.createElement('span');
      tag.className = 'encl-tag';
      if (pos.x < 22) tag.classList.add('tag-right');
      else if (pos.x > 78) tag.classList.add('tag-left');
      else tag.classList.add('tag-below');
      tag.textContent = a.short || a.name;
      cell.appendChild(tag);

      cell.addEventListener('click', function (e) {
        e.stopPropagation(); openDirections(a.id);
      });
      cells.appendChild(cell);
    });
    var lm = $('mapLandmarks'); lm.innerHTML = '';
    CFG.LANDMARKS.forEach(function (L) {
      if (L.id === 'cong-a') return;
      var el = document.createElement('div');
      el.className = 'landmark';
      el.style.left = L.mapX + '%'; el.style.top = L.mapY + '%';
      el.textContent = L.emoji; el.title = L.name;
      lm.appendChild(el);
    });
    $('mapStats').textContent = drawnCount() + ' / ' + CFG.ANIMALS.length;
    var last = state.order.length ? state.order[state.order.length - 1] : CFG.FIRST_ANIMAL;
    var near = nearestUndrawn(last);
    $('suggestHint').textContent = near
      ? near.animal.emoji + ' ' + (near.animal.short || near.animal.name) + ' · ~' + Math.round(near.route.dist) + ' m'
      : 'Bạn đã vẽ đủ 15 chuồng!';
    $('btnWrapped').disabled = drawnCount() < 1;
    drawRouteSvg($('mapRoute'), []);
    placeUserLoc(last);
    requestAnimationFrame(clampEnclosureLabels);
  }

  function clampEnclosureLabels() {
    var vp = $('mapViewport'); if (!vp) return;
    var vr = vp.getBoundingClientRect();
    var pad = 4;
    document.querySelectorAll('#mapCells .encl-tag').forEach(function (tag) {
      tag.style.left = ''; tag.style.right = ''; tag.style.top = '';
      tag.style.transform = '';
      /* re-apply class-based default via classList (already set) */
      var r = tag.getBoundingClientRect();
      var dx = 0, dy = 0;
      if (r.left < vr.left + pad) dx = (vr.left + pad) - r.left;
      if (r.right > vr.right - pad) dx = (vr.right - pad) - r.right;
      if (r.top < vr.top + pad) dy = (vr.top + pad) - r.top;
      if (r.bottom > vr.bottom - pad) dy = (vr.bottom - pad) - r.bottom;
      if (dx || dy) {
        /* nudge with translate on top of class transform */
        var base = '';
        if (tag.classList.contains('tag-below')) base = 'translateX(-50%)';
        else if (tag.classList.contains('tag-right') || tag.classList.contains('tag-left')) base = 'translateY(-50%)';
        tag.style.transform = base + ' translate(' + dx + 'px,' + dy + 'px)';
      }
    });
  }


  function placeUserLoc(id) {
    var el = $('userLoc'); if (!el) return;
    var pos = nodePos(id); if (!pos) { el.classList.add('hidden'); return; }
    var world = $('mapWorld');
    if (el.parentNode !== world) world.appendChild(el);
    el.classList.remove('hidden');
    el.style.left = pos.x + '%';
    el.style.top = pos.y + '%';
  }

  function openMap() {
    show('screen-map'); renderMap(); bindMapGestures();
    requestAnimationFrame(function () {
      /* default = fill-width overview (river/lake/trees visible), vertically centered */
      fitDefaultMapView();
      placeUserLoc(state.order.length ? state.order[state.order.length - 1] : null);
    });
  }
  function fitDefaultMapView() {
    var vp = $('mapViewport'); if (!vp) return;
    var world = $('mapWorld');
    var vw = vp.clientWidth, vh = vp.clientHeight;
    var ww = world.offsetWidth, wh = world.offsetHeight;
    var fillW = vw / Math.max(1, ww);
    /* fill-width: toàn bộ bề ngang trong khung, không cần kéo ngang;
       dải trắng trên/dưới nhỏ hơn cover-crop mép */
    mapView.scale = fillW;
    mapView.min = fillW;
    mapView.x = 0;
    mapView.y = (vh - wh * fillW) / 2;
    clampMap({ sheetReserve: 0 });
    applyMapTransform();
    requestAnimationFrame(function () {
      ensureEnclosuresInView(12);
      clampEnclosureLabels();
    });
  }

  function ensureEnclosuresInView(padPx) {
    var vp = $('mapViewport'); if (!vp) return;
    var world = $('mapWorld');
    var vw = vp.clientWidth, vh = vp.clientHeight;
    var ww = world.offsetWidth, wh = world.offsetHeight;
    var vr = vp.getBoundingClientRect();
    var pad = padPx == null ? 10 : padPx;
    var cells = document.querySelectorAll('#mapCells .encl-cell');
    if (!cells.length) return;
    function contentBox() {
      var minL = Infinity, minT = Infinity, maxR = -Infinity, maxB = -Infinity;
      cells.forEach(function (cell) {
        [cell.querySelector('.drawing'), cell.querySelector('.encl-pad'), cell.querySelector('.encl-tag')].forEach(function (el) {
          if (!el) return;
          var r = el.getBoundingClientRect();
          if (r.width < 1 || r.height < 1) return;
          minL = Math.min(minL, r.left); minT = Math.min(minT, r.top);
          maxR = Math.max(maxR, r.right); maxB = Math.max(maxB, r.bottom);
        });
      });
      if (!isFinite(minL)) return null;
      return { left: minL, top: minT, right: maxR, bottom: maxB };
    }
    var box = contentBox();
    if (!box) return;
    var needL = (vr.left + pad) - box.left;
    var needR = box.right - (vr.right - pad);
    var needT = (vr.top + pad) - box.top;
    var needB = box.bottom - (vr.bottom - pad);
    /* shift first */
    if (needL > 0) mapView.x += needL;
    if (needR > 0) mapView.x -= needR;
    if (needT > 0) mapView.y += needT;
    if (needB > 0) mapView.y -= needB;
    clampMap({ sheetReserve: 0 });
    applyMapTransform();
    box = contentBox();
    if (!box) return;
    needL = (vr.left + pad) - box.left;
    needR = box.right - (vr.right - pad);
    needT = (vr.top + pad) - box.top;
    needB = box.bottom - (vr.bottom - pad);
    var overflowX = Math.max(0, needL, needR);
    var overflowY = Math.max(0, needT, needB);
    if (overflowX > 0.5 || overflowY > 0.5) {
      var contentW = box.right - box.left + pad * 2;
      var contentH = box.bottom - box.top + pad * 2;
      var sx = vw / Math.max(1, contentW);
      var sy = vh / Math.max(1, contentH);
      var factor = Math.min(1, sx, sy) * 0.98;
      if (factor < 0.999) {
        var cx = vw / 2, cy = vh / 2;
        /* zoom about viewport center */
        mapView.x = cx - (cx - mapView.x) * factor;
        mapView.y = cy - (cy - mapView.y) * factor;
        mapView.scale = Math.max(mapView.min * 0.92, mapView.scale * factor);
        clampMap({ sheetReserve: 0 });
        applyMapTransform();
        /* final shift */
        box = contentBox();
        if (box) {
          needL = (vr.left + pad) - box.left;
          needR = box.right - (vr.right - pad);
          needT = (vr.top + pad) - box.top;
          needB = box.bottom - (vr.bottom - pad);
          if (needL > 0) mapView.x += needL;
          if (needR > 0) mapView.x -= needR;
          if (needT > 0) mapView.y += needT;
          if (needB > 0) mapView.y -= needB;
          clampMap({ sheetReserve: 0 });
          applyMapTransform();
        }
      }
    }
  }

  function focusAnimal(id) {
    var a = id ? animalById(id) : null;
    var vp = $('mapViewport'); if (!vp) return;
    var vw = vp.clientWidth, vh = vp.clientHeight;
    var world = $('mapWorld');
    var wh = world.offsetHeight, ww = world.offsetWidth;
    if (!a) {
      mapView.scale = 1; mapView.x = 0; mapView.y = 0; clampMap(); applyMapTransform(); return;
    }
    var cx = (a.mapX / 100) * ww * mapView.scale;
    var cy = (a.mapY / 100) * wh * mapView.scale;
    mapView.x = vw / 2 - cx;
    mapView.y = vh / 2 - cy;
    clampMap(); applyMapTransform();
  }
  function overviewMap() {
    fitDefaultMapView();
  }

  var dirTarget = null;
  var activeRoute = null;
  var navTimer = null;
  var navState = null;

  function walkMinutes(meters) {
    /* ~80 m/min casual walk */
    return Math.max(1, Math.round(meters / 80));
  }

  function buildTurnSteps(pathIds, totalDist) {
    var steps = [];
    if (!pathIds || pathIds.length < 2) {
      steps.push('Đi theo lối đi ~' + Math.round(totalDist || 0) + ' m');
      return steps;
    }
    /* summarize dense path graph into a few human steps */
    var landmarks = {};
    (CFG.ANIMALS || []).forEach(function (a) { landmarks[attachId(a.id)] = a.short || a.name; });
    (CFG.LANDMARKS || []).forEach(function (L) { landmarks[attachId(L.id)] = L.name; });
    var named = [];
    pathIds.forEach(function (id, i) {
      if (landmarks[id]) named.push({ i: i, name: landmarks[id] });
    });
    var chunks = Math.min(4, Math.max(2, Math.ceil((pathIds.length) / 40)));
    var seg = Math.round((totalDist || 200) / chunks);
    steps.push('Đi thẳng ~' + seg + ' m theo lối đi');
    if (named.length) {
      for (var k = 0; k < Math.min(2, named.length); k++) {
        var turn = (k % 2 === 0) ? 'Rẽ trái' : 'Rẽ phải';
        steps.push(turn + ' gần ' + named[k].name + ', đi ~' + seg + ' m');
      }
    }
    steps.push('Đến chuồng đích (~' + Math.round(totalDist || 0) + ' m)');
    return steps;
  }

  function openDirections(targetId) {
    stopNav();
    var a = animalById(targetId); if (!a) return;
    dirTarget = targetId;
    resetDirSheetActions();
    var from = state.order.length ? state.order[state.order.length - 1] : 'cong-a';
    if (from === targetId && state.order.length > 1) from = state.order[state.order.length - 2];
    if (from === targetId) from = 'cong-a';
    var sp = routeBetween(from, targetId);
    $('dirTitle').textContent = (a.short || a.name);
    var dest = $('destPin');
    if (dest) {
      var world = $('mapWorld');
      if (dest.parentNode !== world) world.appendChild(dest);
      dest.classList.remove('hidden');
      dest.style.left = a.mapX + '%';
      dest.style.top = a.mapY + '%';
    }
    /* dim drawings except from/to while routing */
    document.querySelectorAll('#mapCells .encl-cell').forEach(function (el) {
      var id = el.getAttribute('data-id');
      el.classList.toggle('dimmed', !(id === targetId || id === from));
    });
    $('mapWorld').classList.add('routing');
    if (sp) {
      activeRoute = sp;
      var mins = walkMinutes(sp.dist);
      $('dirMins').textContent = mins + ' phút';
      if ($('dirDist')) $('dirDist').textContent = Math.round(sp.dist) + ' m';
      if ($('dirMeta')) $('dirMeta').textContent = Math.round(sp.dist) + ' m · ' + Math.round(sp.dist / CFG.STEP_METERS) + ' bước';
      if ($('dirSub')) $('dirSub').textContent = '~' + Math.round(sp.dist) + ' m';
      var steps = buildTurnSteps(sp.path, sp.dist);
      var icons = ['↑', '↰', '↱', '↑', '↵'];
      var ol = $('dirSteps');
      ol.innerHTML = steps.map(function (s, i) {
        return '<li><span class="turn">' + icons[i % icons.length] + '</span><span>' + s + '</span></li>';
      }).join('');
      ol.classList.add('collapsed');
      var tog = $('btnStepsToggle');
      if (tog) tog.textContent = 'Chi tiết chỉ đường ▾';
      if ($('dirPreview')) $('dirPreview').textContent = steps.join(' → ');
      drawRouteSvg($('mapRoute'), sp.path, { animate: true, fromId: from, toId: targetId });
      $('dirSheet').classList.remove('hidden');
      setMapSheetOpen(true);
      var sc0 = $('dirSheet').querySelector('.sheet-card');
      if (sc0) sc0.classList.remove('compact');
      requestAnimationFrame(function () { fitRouteInView(sp.path); });
      placeUserLoc(from);
    } else {
      activeRoute = null;
      $('dirMins').textContent = '—';
      if ($('dirDist')) $('dirDist').textContent = '—';
      if ($('dirMeta')) $('dirMeta').textContent = 'Không tìm được đường';
      ol = $('dirSteps'); if (ol) ol.innerHTML = '';
      $('dirSheet').classList.remove('hidden');
      setMapSheetOpen(true);
    }
  }

  function clearRouteDim() {
    document.querySelectorAll('#mapCells .encl-cell.dimmed').forEach(function (el) { el.classList.remove('dimmed'); });
    if ($('mapWorld')) $('mapWorld').classList.remove('routing');
  }
  function stopNav() {
    clearInterval(navTimer); navTimer = null; navState = null;
    var ban = $('navBanner'); if (ban) ban.classList.remove('show');
  }

  function startNavigation() {
    if (!activeRoute || !activeRoute.path || activeRoute.path.length < 2) return;
    $('dirSheet').classList.add('hidden');
    setMapSheetOpen(false);
    var path = activeRoute.path.slice();
    var pts = pathPoints(path);
    if (pts.length < 2) return;
    navState = { pts: pts, path: path, i: 0, t: 0, steps: buildTurnSteps(path, activeRoute.dist) };
    var ban = $('navBanner');
    ban.classList.add('show');
    $('navBannerText').textContent = navState.steps[0] || 'Bắt đầu di chuyển';
    $('navBannerSub').textContent = 'Đang dẫn đường tới ' + (animalById(dirTarget) || {}).short;
    fitRouteInView(path);
    clearInterval(navTimer);
    navTimer = setInterval(function () {
      if (!navState) return;
      navState.t += 0.04;
      if (navState.t >= 1) {
        navState.t = 0;
        navState.i++;
        if (navState.i >= navState.pts.length - 1) {
          clearInterval(navTimer);
          navTimer = null;
          $('navBannerText').textContent = 'Bạn đã tới nơi';
          $('navBannerSub').textContent = 'Quét NFC ở chuồng này để vẽ';
          placeUserLoc(dirTarget);
          setTimeout(function () {
            showArrivalSheet();
          }, 700);
          return;
        }
        $('navBannerText').textContent = navState.steps[Math.min(navState.i, navState.steps.length - 1)] || 'Tiếp tục';
      }
      var a = navState.pts[navState.i], b = navState.pts[navState.i + 1];
      var x = a.x + (b.x - a.x) * navState.t;
      var y = a.y + (b.y - a.y) * navState.t;
      var el = $('userLoc');
      el.classList.remove('hidden');
      el.style.left = x + '%';
      el.style.top = y + '%';
      var ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI + 90;
      el.style.setProperty('--heading', ang + 'deg');
      /* gentle follow camera */
      var vp = $('mapViewport');
      var world = $('mapWorld');
      var cx = (x / 100) * world.offsetWidth * mapView.scale;
      var cy = (y / 100) * world.offsetHeight * mapView.scale;
      mapView.x += (vp.clientWidth / 2 - cx - mapView.x) * 0.12;
      mapView.y += (vp.clientHeight * 0.42 - cy - mapView.y) * 0.12;
      clampMap(); applyMapTransform();
    }, 50);
  }

  $('btnDirClose').addEventListener('click', function () {
    stopNav();
    $('dirSheet').classList.add('hidden');
    setMapSheetOpen(false);
    drawRouteSvg($('mapRoute'), []);
    var dest = $('destPin'); if (dest) dest.classList.add('hidden');
    clearRouteDim();
  });
  if ($('btnDirStart')) $('btnDirStart').addEventListener('click', startNavigation);
  $('btnDirGo').addEventListener('click', function () {
    stopNav();
    $('dirSheet').classList.add('hidden');
    setMapSheetOpen(false);
    var dest = $('destPin'); if (dest) dest.classList.add('hidden');
    clearRouteDim();
    if (dirTarget) startDraw(dirTarget);
  });

  function setMapSheetOpen(on) {
    var map = $('screen-map');
    if (map) map.classList.toggle('sheet-open', !!on);
  }
  function closeAnimalList() {
    var sh = $('animalSheet');
    if (sh) sh.classList.add('hidden');
    var ds = $('dirSheet');
    setMapSheetOpen(!!(ds && !ds.classList.contains('hidden')));
  }
  function renderAnimalList() {
    var list = $('animalList'); if (!list) return;
    list.innerHTML = '';
    var from = state.order.length ? state.order[state.order.length - 1] : 'cong-a';
    CFG.ANIMALS.forEach(function (a) {
      var done = !!state.drawings[a.id];
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'animal-row' + (done ? ' done' : '');
      var distHtml = '';
      if (a.id === from) {
        distHtml = 'Đang ở đây';
      } else {
        var sp = routeBetween(from, a.id);
        distHtml = sp ? ('~' + Math.round(sp.dist) + ' m') : '—';
      }
      var thumb = done && state.drawings[a.id].dataUrl
        ? '<img src="' + state.drawings[a.id].dataUrl + '" alt="">'
        : (a.emoji || '🐾');
      btn.innerHTML =
        '<span class="thumb">' + thumb + '</span>' +
        '<span class="meta"><div class="nm">' + a.name + '</div>' +
        '<div class="st' + (done ? ' done' : '') + '">' + (done ? 'Đã vẽ' : 'Chưa vẽ') + '</div></span>' +
        '<span class="dist">' + distHtml + '</span>';
      btn.addEventListener('click', function () {
        closeAnimalList();
        openDirections(a.id);
      });
      list.appendChild(btn);
    });
  }
  function openAnimalList() {
    stopNav();
    var ds = $('dirSheet'); if (ds) ds.classList.add('hidden');
    var dest = $('destPin'); if (dest) dest.classList.add('hidden');
    clearRouteDim();
    drawRouteSvg($('mapRoute'), []);
    renderAnimalList();
    var sh = $('animalSheet');
    if (sh) sh.classList.remove('hidden');
    setMapSheetOpen(true);
  }
  function resetDirSheetActions() {
    var start = $('btnDirStart');
    var go = $('btnDirGo');
    var sc = $('dirSheet') && $('dirSheet').querySelector('.sheet-card');
    if (start) start.classList.remove('hidden');
    if (go) {
      go.textContent = 'Quét NFC';
      go.classList.remove('btn-arrive', 'btn-accent');
      go.classList.add('btn-ghost');
    }
    var tog = $('btnStepsToggle'); if (tog) tog.classList.remove('hidden');
    if (sc) sc.classList.remove('arrived');
  }
  function showArrivalSheet() {
    var ban = $('navBanner'); if (ban) ban.classList.remove('show');
    navTimer = null;
    var a = animalById(dirTarget);
    if ($('dirTitle')) $('dirTitle').textContent = a ? (a.short || a.name) : 'Đã tới nơi';
    if ($('dirMins')) $('dirMins').textContent = 'Đã tới nơi';
    if ($('dirDist')) $('dirDist').textContent = 'Quét NFC để vẽ';
    var tog = $('btnStepsToggle'); if (tog) tog.classList.add('hidden');
    var ol = $('dirSteps'); if (ol) ol.classList.add('collapsed');
    var start = $('btnDirStart'); if (start) start.classList.add('hidden');
    var go = $('btnDirGo');
    if (go) {
      go.textContent = 'Đã tới nơi – quét NFC';
      go.classList.remove('btn-ghost');
      go.classList.add('btn-arrive');
    }
    var sc = $('dirSheet') && $('dirSheet').querySelector('.sheet-card');
    if (sc) {
      sc.classList.remove('compact');
      sc.classList.add('arrived');
    }
    if ($('dirSheet')) $('dirSheet').classList.remove('hidden');
    setMapSheetOpen(true);
    if (dirTarget) placeUserLoc(dirTarget);
  }
  if ($('btnAnimalList')) $('btnAnimalList').addEventListener('click', openAnimalList);
  if ($('btnAnimalListClose')) $('btnAnimalListClose').addEventListener('click', closeAnimalList);
  if ($('animalSheet')) $('animalSheet').addEventListener('click', function (e) {
    if (e.target === $('animalSheet')) closeAnimalList();
  });
  $('btnWrapped').addEventListener('click', openWrapped);

  /* Tour */
  function formatKm(meters) {
    var km = meters / 1000;
    return km.toFixed(2).replace('.', ',') + ' km';
  }
  function computeTour() {
    var dist = 0, path = [];
    if (state.order.length) {
      path = ['cong-a'].concat(state.order);
      for (var i = 0; i < path.length - 1; i++) {
        var sp = routeBetween(path[i], path[i + 1]);
        dist += sp ? sp.dist : 120;
      }
    }
    var steps = Math.round(dist / CFG.STEP_METERS);
    var totalTime = 0, autoN = 0;
    for (var k in state.drawings) {
      totalTime += state.drawings[k].durationSec || 0;
      if (state.drawings[k].autoSubmit) autoN++;
    }
    var n = drawnCount() || 1, avg = totalTime / n;
    var titles = [];
    /* Fast XOR Slow — không cùng lúc */
    if (avg < CFG.TITLES.FAST_AVG_SEC && autoN === 0) titles.push(CFG.TITLES.FAST);
    else if (avg >= CFG.TITLES.SLOW_AVG_SEC || autoN > 0) titles.push(CFG.TITLES.SLOW);
    if (drawnCount() >= CFG.ANIMALS.length) titles.push(CFG.TITLES.ALL);
    if (!titles.length) titles.push({ id: 'explorer', name: 'Nhà thám hiểm TCV', desc: 'Đã bắt đầu hành trình vẽ' });
    return { dist: dist, steps: steps, path: path, avg: avg, titles: titles, count: drawnCount(), kmLabel: formatKm(dist) };
  }

  var stravaAnim = null;
  function openWrapped() {
    stopStravaAnim();
    var tour = computeTour();
    $('stravaStats').innerHTML =
      '<div class="stat-pill"><div class="v" id="stravaKmPill">' + tour.kmLabel + '</div><div class="l">Quãng đường</div></div>' +
      '<div class="stat-pill"><div class="v" id="stravaStepsPill">' + tour.steps.toLocaleString('vi-VN') + '</div><div class="l">Bước chân</div></div>' +
      '<div class="stat-pill"><div class="v">' + tour.count + '</div><div class="l">Chuồng</div></div>';
    if ($('stravaMapBg')) $('stravaMapBg').src = MAP_URI;
    show('screen-strava');
    requestAnimationFrame(function () { playStravaTimelapse(tour); });
  }

  function stopStravaAnim() {
    if (stravaAnim) cancelAnimationFrame(stravaAnim);
    stravaAnim = null;
  }

  function playStravaTimelapse(tour) {
    var canvas = $('stravaCanvas'); if (!canvas) return;
    var stage = $('stravaStage') || canvas.parentElement;
    var dpr = Math.min(devicePixelRatio || 1, 2);
    var W = stage.clientWidth, H = stage.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var order = state.order.slice();
    if (!order.length) return;
    var nodes = ['cong-a'].concat(order);
    var poly = [];
    for (var i = 0; i < nodes.length - 1; i++) {
      var sp = routeBetween(nodes[i], nodes[i + 1]);
      var seg = sp ? sp.path : [nodes[i], nodes[i + 1]];
      for (var j = 0; j < seg.length; j++) {
        if (!poly.length || poly[poly.length - 1] !== seg[j]) poly.push(seg[j]);
      }
    }
    var smooth = smoothRoutePoints(poly.map(function (id) { return nodePos(id); }).filter(Boolean));
    var pts = smooth.map(function (p) {
      return { x: p.x / 100 * W, y: p.y / 100 * H };
    });
    if (pts.length < 2) return;

    var totalDist = tour.dist || 1;
    var duration = 8000;
    var t0 = performance.now();
    var revealed = {};
    var imgs = {};
    order.forEach(function (id) {
      if (state.drawings[id]) {
        var im = new Image(); im.src = state.drawings[id].dataUrl; imgs[id] = im;
      }
    });

    function posAt(u) {
      var dist = 0, seglen = [];
      for (var i = 0; i < pts.length - 1; i++) {
        var dx = pts[i + 1].x - pts[i].x, dy = pts[i + 1].y - pts[i].y;
        seglen.push(Math.sqrt(dx * dx + dy * dy));
        dist += seglen[i];
      }
      var target = u * dist, acc = 0;
      for (var i = 0; i < seglen.length; i++) {
        if (acc + seglen[i] >= target) {
          var lt = seglen[i] ? (target - acc) / seglen[i] : 0;
          return {
            x: pts[i].x + (pts[i + 1].x - pts[i].x) * lt,
            y: pts[i].y + (pts[i + 1].y - pts[i].y) * lt,
            idx: i, lt: lt, distPx: target, totalPx: dist
          };
        }
        acc += seglen[i];
      }
      var last = pts[pts.length - 1];
      return { x: last.x, y: last.y, idx: pts.length - 2, lt: 1, distPx: dist, totalPx: dist };
    }

    stopStravaAnim();
    function frame(now) {
      var u = Math.min(1, (now - t0) / duration);
      var pos = posAt(u);
      ctx.clearRect(0, 0, W, H);

      /* trail */
      ctx.beginPath();
      ctx.strokeStyle = '#ff6a00'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.setLineDash([]);
      var drawn = 0, need = pos.distPx;
      ctx.moveTo(pts[0].x, pts[0].y);
      for (var i = 0; i < pts.length - 1; i++) {
        var dx = pts[i + 1].x - pts[i].x, dy = pts[i + 1].y - pts[i].y;
        var L = Math.sqrt(dx * dx + dy * dy);
        if (drawn + L <= need) {
          ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
          drawn += L;
          if (pts[i + 1].id && state.drawings[pts[i + 1].id]) revealed[pts[i + 1].id] = true;
        } else {
          var lt = L ? (need - drawn) / L : 0;
          ctx.lineTo(pts[i].x + dx * lt, pts[i].y + dy * lt);
          break;
        }
      }
      ctx.stroke();

      /* reveal animals when avatar near */
      order.forEach(function (id) {
        var a = animalById(id); if (!a) return;
        var ax = a.mapX / 100 * W, ay = a.mapY / 100 * H;
        if (Math.hypot(pos.x - ax, pos.y - ay) < 28) revealed[id] = true;
      });
      /* revealed drawings */
      Object.keys(revealed).forEach(function (id) {
        var a = animalById(id); if (!a || !imgs[id] || !imgs[id].complete) return;
        var ax = a.mapX / 100 * W, ay = a.mapY / 100 * H;
        var bob = Math.sin(now / 90) * 4;
        ctx.drawImage(imgs[id], ax - 28, ay - 28 + bob, 56, 56);
        ctx.fillStyle = '#ff6a00'; ctx.font = '700 11px Be Vietnam Pro, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(a.short || a.name, ax, ay + 36 + bob);
      });

      /* avatar */
      ctx.beginPath();
      ctx.fillStyle = '#1A73E8';
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
      ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.fillStyle = 'rgba(26,115,232,0.25)';
      ctx.arc(pos.x, pos.y, 16 + Math.sin(now / 200) * 3, 0, Math.PI * 2); ctx.fill();

      /* live counters */
      var km = (totalDist * u / 1000);
      var steps = Math.round((tour.steps || 0) * u);
      var mins = Math.floor(u * 48); /* fake clock advance */
      var hh = 9 + Math.floor(mins / 60), mm = mins % 60;
      if ($('stravaClock')) $('stravaClock').textContent = (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
      if ($('stravaKmLive')) $('stravaKmLive').textContent = km.toFixed(2).replace('.', ',') + ' km';
      if ($('stravaStepsLive')) $('stravaStepsLive').textContent = steps.toLocaleString('vi-VN') + ' bước';
      if ($('stravaKmPill')) $('stravaKmPill').textContent = km.toFixed(2).replace('.', ',') + ' km';
      if ($('stravaStepsPill')) $('stravaStepsPill').textContent = steps.toLocaleString('vi-VN');

      if (u < 1) stravaAnim = requestAnimationFrame(frame);
      else {
        order.forEach(function (id) { revealed[id] = true; });
        /* final paint */
        stravaAnim = requestAnimationFrame(function (n) { frame(t0 + duration); });
        stopStravaAnim();
      }
    }
    stravaAnim = requestAnimationFrame(frame);
  }

  if ($('btnStravaReplay')) $('btnStravaReplay').addEventListener('click', function () {
    playStravaTimelapse(computeTour());
  });
  $('btnStravaNext').addEventListener('click', openGrid);


  /* Grid — ONLY drawn animals, equal 3-column grid (ref-bo-cuc-luoi-3-cot) */
  function openGrid() {
    clearInterval(openGrid._t);
    var stage = $('showcaseStage');
    if (stage) stage.classList.add('hidden');
    var img = $('showcaseImg');
    if (img) { img.removeAttribute('src'); img.alt = ''; }
    var grid = $('grid3');
    grid.innerHTML = '';
    grid.className = 'grid-3 grid-full';
    var drawn = drawnAnimals();
    drawn.forEach(function (a) {
      var cell = document.createElement('div');
      cell.className = 'cell';
      var thumb = document.createElement('div');
      thumb.className = 'thumb';
      var im = document.createElement('img');
      im.src = state.drawings[a.id].dataUrl; im.alt = a.name;
      thumb.appendChild(im);
      var nm = document.createElement('div');
      nm.className = 'nm';
      nm.textContent = a.short || a.name;
      cell.appendChild(thumb);
      cell.appendChild(nm);
      grid.appendChild(cell);
    });
    show('screen-grid');
    requestAnimationFrame(function () {
      grid.classList.remove('fit-all');
      grid.style.alignContent = '';
      grid.style.removeProperty('--cell-h');
      grid.querySelectorAll('.cell').forEach(function (c) { c.style.height = ''; });
      if (grid.scrollHeight > grid.clientHeight + 4) {
        var rows = Math.max(1, Math.ceil(drawn.length / 3));
        var styles = getComputedStyle(grid);
        var gapY = parseFloat(styles.rowGap || styles.gap) || 8;
        var cellH = (grid.clientHeight - gapY * (rows - 1)) / rows;
        grid.classList.add('fit-all');
        grid.style.alignContent = 'start';
        grid.style.setProperty('--cell-h', cellH + 'px');
        grid.querySelectorAll('.cell').forEach(function (c) { c.style.height = cellH + 'px'; });
      } else {
        grid.style.alignContent = 'center';
      }
    });
  }
  $('btnGridNext').addEventListener('click', openTitles);

  /* Titles + canvas fireworks */
  var fwAnim = null;
  function breakTitle(name) {
    var map = {
      'Vị thần tốc độ': 'Vị thần\ntốc độ',
      'Đứa con của mẹ hoàn hảo': 'Đứa con\ncủa mẹ\nhoàn hảo',
      'Vị thần chăm chỉ': 'Vị thần\nchăm chỉ',
      'Nhà thám hiểm TCV': 'Nhà thám hiểm\nTCV',
    };
    return map[name] || name;
  }
  function openTitles() {
    clearInterval(openGrid._t);
    var tour = computeTour();
    var main = tour.titles[0];
    $('mainTitleName').textContent = breakTitle(main.name);
    var long = (main.name || '').length >= 18;
    $('mainTitleName').style.fontSize = long ? '26px' : '34px';
    $('mainTitleName').style.maxWidth = long ? '108px' : '138px';
    $('mainTitleName').style.fontWeight = '700';
    $('mainTitleDesc').textContent = main.desc;
    var list = $('titlesList');
    var extras = tour.titles.slice(1);
    if (extras.length) {
      list.hidden = false;
      list.textContent = 'Còn đạt thêm: ' + extras.map(function (x) { return x.name; }).join(', ');
    } else {
      list.hidden = true; list.textContent = '';
    }
    show('screen-titles');
    requestAnimationFrame(function () { startFireworks(); });
  }
  function startFireworks() {
    var canvas = $('fwCanvas'); if (!canvas) return;
    var parent = canvas.parentElement;
    var dpr = Math.min(devicePixelRatio || 1, 2);
    var W = parent.clientWidth, H = parent.clientHeight;
    if (W < 10 || H < 10) { setTimeout(startFireworks, 50); return; }
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var bursts = [];
    var colors = ['#ff6a00', '#ffd54a', '#ffe566', '#e53935', '#2e7d32', '#66bb6a', '#ff8a65'];
    /* spawn around wreath ring — not one dense center cluster */
    function spawnSites() {
      var wrap = document.querySelector('.wreath-wrap');
      var wr = wrap ? wrap.getBoundingClientRect() : null;
      var pr = parent.getBoundingClientRect();
      var sites = [];
      if (wr) {
        var cx = wr.left - pr.left + wr.width / 2;
        var cy = wr.top - pr.top + wr.height / 2;
        var rx = wr.width * 0.62, ry = wr.height * 0.58;
        for (var k = 0; k < 8; k++) {
          var a = (Math.PI * 2 * k) / 8 + Math.random() * 0.4;
          sites.push({
            x: cx + Math.cos(a) * rx * (0.85 + Math.random() * 0.35),
            y: cy + Math.sin(a) * ry * (0.75 + Math.random() * 0.4)
          });
        }
        /* a few corner scatters */
        sites.push({ x: 36 + Math.random() * 40, y: 60 + Math.random() * 50 });
        sites.push({ x: W - 76 + Math.random() * 40, y: 55 + Math.random() * 50 });
        sites.push({ x: 40 + Math.random() * 50, y: H * 0.55 + Math.random() * 40 });
        sites.push({ x: W - 90 + Math.random() * 50, y: H * 0.52 + Math.random() * 40 });
      } else {
        for (var i = 0; i < 10; i++) sites.push({ x: 40 + Math.random() * (W - 80), y: 50 + Math.random() * (H * 0.55) });
      }
      return sites;
    }
    var sites = spawnSites();
    var siteIdx = 0;
    function spawnBurst() {
      if (!sites.length) sites = spawnSites();
      var s = sites[siteIdx % sites.length]; siteIdx++;
      var cx = s.x + (Math.random() - 0.5) * 18;
      var cy = s.y + (Math.random() - 0.5) * 18;
      var parts = [];
      var n = 14 + (Math.random() * 12) | 0; /* lighter, not a solid ball */
      for (var i = 0; i < n; i++) {
        var ang = Math.random() * Math.PI * 2;
        var sp = 1.6 + Math.random() * 4.2;
        parts.push({
          x: cx, y: cy,
          vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp * 0.9 - 0.4,
          life: 1, decay: 0.012 + Math.random() * 0.012,
          color: colors[(Math.random() * colors.length) | 0],
          r: 1.6 + Math.random() * 2.0,
        });
      }
      bursts.push({ parts: parts });
      if (bursts.length > 7) bursts.shift();
    }
    var lastSpawn = 0, t0 = performance.now(), burstCount = 0;
    cancelAnimationFrame(fwAnim);
    /* immediate scatter of several bursts around wreath */
    for (var i = 0; i < 5; i++) spawnBurst();
    burstCount = 5; lastSpawn = performance.now();
    function frame(now) {
      ctx.clearRect(0, 0, W, H);
      if (now - lastSpawn > 380) { spawnBurst(); lastSpawn = now; burstCount++; }
      bursts.forEach(function (b) {
        b.parts.forEach(function (p) {
          p.x += p.vx; p.y += p.vy; p.vy += 0.028; p.vx *= 0.992; p.life -= p.decay;
          if (p.life <= 0) return;
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * Math.max(0.3, p.life), 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = p.color; ctx.lineWidth = 1.1;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 2.4, p.y - p.vy * 2.4); ctx.stroke();
        });
      });
      ctx.globalAlpha = 1;
      bursts = bursts.filter(function (b) { return b.parts.some(function (p) { return p.life > 0; }); });
      fwAnim = requestAnimationFrame(frame);
    }
    fwAnim = requestAnimationFrame(frame);
  }

  $('btnTitlesNext').addEventListener('click', function () {
    cancelAnimationFrame(fwAnim); openExport();
  });

  /* Export */
  var exportLayout = 'grid';
  var lastPngBlob = null, lastVideoBlob = null, lastVideoName = '', lastPngName = '';

  var exportMedia = 'image'; /* image | video */
  var previewVideoUrl = null;

  function openExport() {
    show('screen-export');
    updateShareButtons();
    refreshPreview();
  }

  document.querySelectorAll('.seg[data-layout]').forEach(function (card) {
    card.addEventListener('click', function () {
      document.querySelectorAll('.seg[data-layout]').forEach(function (c) { c.classList.remove('active'); });
      card.classList.add('active');
      exportLayout = card.getAttribute('data-layout');
      refreshPreview();
    });
  });
  document.querySelectorAll('.seg[data-media]').forEach(function (card) {
    card.addEventListener('click', function () {
      document.querySelectorAll('.seg[data-media]').forEach(function (c) { c.classList.remove('active'); });
      card.classList.add('active');
      exportMedia = card.getAttribute('data-media');
      refreshPreview();
    });
  });
  /* legacy layout-card support */
  document.querySelectorAll('.layout-card').forEach(function (card) {
    card.addEventListener('click', function () {
      exportLayout = card.getAttribute('data-layout');
      refreshPreview();
    });
  });
  $('btnExportBack').addEventListener('click', openMap);

  async function refreshPreview() {
    var hint = $('previewHint');
    var img = $('previewImg');
    var vid = $('previewVideo');
    var anim = $('previewAnim');
    if (hint) hint.textContent = 'Đang tạo xem trước…';
    if (exportMedia === 'image') {
      if (vid) { vid.classList.add('hidden'); vid.removeAttribute('src'); }
      if (anim) anim.classList.add('hidden');
      if (img) img.classList.remove('hidden');
      try {
        var blob = await exportPng();
        var url = URL.createObjectURL(blob);
        img.onload = function () { URL.revokeObjectURL(url); };
        img.src = url;
        if (hint) hint.textContent = exportLayout === 'map' ? 'Xem trước: bản đồ' : 'Xem trước: lưới tranh';
      } catch (e) {
        if (hint) hint.textContent = 'Lỗi xem trước ảnh';
      }
    } else {
      if (img) img.classList.add('hidden');
      if (hint) hint.textContent = 'Đang tạo video xem trước…';
      try {
        var blob = await exportVideo();
        if (previewVideoUrl) URL.revokeObjectURL(previewVideoUrl);
        previewVideoUrl = URL.createObjectURL(blob);
        if (vid) {
          vid.classList.remove('hidden');
          vid.src = previewVideoUrl;
          vid.play().catch(function () {});
        }
        if (anim) anim.classList.add('hidden');
        if (hint) hint.textContent = 'Xem trước video · chạm để phát';
      } catch (e) {
        if (hint) hint.textContent = 'Lỗi xem trước video';
      }
    }
  }

  async function doDownload() {
    if (exportMedia === 'image') {
      var blob = lastPngBlob || await exportPng();
      downloadBlob(blob, lastPngName || 'thao-cam-vien-wrapped.png');
    } else {
      var blob = lastVideoBlob || await exportVideo();
      downloadBlob(blob, lastVideoName || 'thao-cam-vien-wrapped.webm');
    }
  }
  async function doShare() {
    try {
      var blob, name, type;
      if (exportMedia === 'image') {
        blob = lastPngBlob || await exportPng();
        name = lastPngName || 'thao-cam-vien-wrapped.png'; type = 'image/png';
      } else {
        blob = lastVideoBlob || await exportVideo();
        name = lastVideoName || 'thao-cam-vien-wrapped.webm'; type = blob.type || 'video/webm';
      }
      var file = new File([blob], name, { type: type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'TCV Wrapped' });
      } else downloadBlob(blob, name);
    } catch (e) {
      if (e && e.name !== 'AbortError') alert('Chia sẻ thất bại');
    }
  }
  if ($('btnDownload')) $('btnDownload').addEventListener('click', doDownload);
  if ($('btnShare')) $('btnShare').addEventListener('click', doShare);


  function updateShareButtons() {
    var canFiles = false;
    try {
      canFiles = !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 't.png', { type: 'image/png' })] }));
    } catch (e) { canFiles = false; }
    if ($('btnSharePng')) $('btnSharePng').classList.toggle('hidden', !canFiles);
    if ($('btnShareVideo')) $('btnShareVideo').classList.toggle('hidden', !canFiles);
    if ($('btnShare')) $('btnShare').classList.toggle('hidden', !canFiles);
  }
  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename; a.rel = 'noopener';
    a.style.display = 'none'; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 2000);
  }
  function waitFonts() {
    if (document.fonts && document.fonts.ready) return document.fonts.ready.catch(function () {});
    return Promise.resolve();
  }
  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = reject; img.src = src;
    });
  }
  function roundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function paintExportFrame(ctx, W, H, tour, images, mapImg, t) {
    t = t || 0;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    var display = '"Quicksand", "Be Vietnam Pro", system-ui, sans-serif';
    var body = '"Be Vietnam Pro", "Quicksand", system-ui, sans-serif';

    ctx.fillStyle = '#111'; ctx.font = '700 36px ' + display; ctx.textAlign = 'center';
    ctx.fillText('Summit Your Drawing', W / 2, 58);
    ctx.font = '600 18px ' + body; ctx.fillStyle = '#ff6a00';
    ctx.fillText('Thảo Cầm Viên · Wrapped', W / 2, 88);

    var contentTop = 96, contentBottom = H - 170, contentH = contentBottom - contentTop;
    var drawn = drawnAnimals();

    if (exportLayout === 'map') {
      var mw = W - 40, mh = contentH - 8, mx = 20, my = contentTop;
      var labelSpace = 18;
      ctx.save();
      roundedRect(ctx, mx, my, mw, mh, 22); ctx.clip();
      if (mapImg) ctx.drawImage(mapImg, mx, my, mw, mh);
      else { ctx.fillStyle = '#fff'; ctx.fillRect(mx, my, mw, mh); }

      function mapXY(id) {
        var n = nodePos(id); if (!n) return null;
        return { x: mx + 8 + (n.x / 100) * (mw - 16), y: my + 10 + (n.y / 100) * (mh - 20 - labelSpace) };
      }
      /* orange tour trail along extracted grey-path graph (Catmull-Rom) */
      if (state.order.length) {
        var nodesT = ['cong-a'].concat(state.order);
        var polyIds = [];
        for (var ii = 0; ii < nodesT.length - 1; ii++) {
          var spp = routeBetween(nodesT[ii], nodesT[ii + 1]);
          var seg = spp ? spp.path : [nodesT[ii], nodesT[ii + 1]];
          seg.forEach(function (id) { if (!polyIds.length || polyIds[polyIds.length - 1] !== id) polyIds.push(id); });
        }
        var rawPts = polyIds.map(mapXY).filter(Boolean);
        /* convert to map-% for smoother, then back — or smooth in pixel space with scaled epsilon */
        var pctPts = polyIds.map(function (id) { return nodePos(id); }).filter(Boolean);
        var sm = smoothRoutePoints(pctPts);
        var ppts = sm.map(function (p) {
          return { x: mx + 8 + (p.x / 100) * (mw - 16), y: my + 10 + (p.y / 100) * (mh - 20 - labelSpace) };
        });
        /* PNG passes t=1 (full); video animates t from 0→1 */
        var uTrail = Math.max(0, Math.min(1, t));
        if (ppts.length > 1) {
          var dist = 0, lens = [];
          for (var i = 0; i < ppts.length - 1; i++) {
            var dx = ppts[i+1].x - ppts[i].x, dy = ppts[i+1].y - ppts[i].y;
            lens.push(Math.sqrt(dx*dx+dy*dy)); dist += lens[i];
          }
          var need = uTrail * dist, acc = 0, ax = ppts[0].x, ay = ppts[0].y;
          ctx.beginPath(); ctx.strokeStyle = '#ff6a00'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.moveTo(ppts[0].x, ppts[0].y);
          var drawnTrail = 0;
          for (var i = 0; i < lens.length; i++) {
            if (drawnTrail + lens[i] <= need) { ctx.lineTo(ppts[i+1].x, ppts[i+1].y); drawnTrail += lens[i]; ax = ppts[i+1].x; ay = ppts[i+1].y; }
            else {
              var lt2 = lens[i] ? (need - drawnTrail) / lens[i] : 0;
              ax = ppts[i].x + (ppts[i+1].x - ppts[i].x) * lt2;
              ay = ppts[i].y + (ppts[i+1].y - ppts[i].y) * lt2;
              ctx.lineTo(ax, ay);
              break;
            }
          }
          ctx.stroke();
          if (t > 0.02 && t < 0.995) {
            ctx.beginPath(); ctx.fillStyle = '#1A73E8'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
            ctx.arc(ax, ay, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          }
        }
      }
      CFG.ANIMALS.forEach(function (a, ai) {
        var snap = PATHG.animalSnap && PATHG.animalSnap[a.id];
        var mxp = a.mapX, myp = a.mapY;
        if (snap && snap.attach && PATHG.nodes[snap.attach]) {
          var att = PATHG.nodes[snap.attach];
          mxp = att.x + (a.mapX - att.x) * 0.92;
          myp = att.y + (a.mapY - att.y) * 0.92;
        }
        mxp = Math.max(16.5, Math.min(83.5, mxp));
        myp = Math.max(9, Math.min(88, myp));
        var pt = {
          x: mx + 8 + (mxp / 100) * (mw - 16),
          y: my + 10 + (myp / 100) * (mh - 20 - labelSpace)
        };
        var bob = state.drawings[a.id] ? Math.sin(t * Math.PI * 2 + ai * 0.7) * 4 : 0;
        var pw = 42, ph = 30;
        ctx.save();
        ctx.translate(pt.x, pt.y + bob);
        ctx.rotate((((ai * 23) % 13) - 6) * Math.PI / 180);
        /* organic soft pad (same generator spirit as SVG) */
        var n = 7, pts = [];
        var aspect = 0.50 + seededRand(ai * 3 + 1) * 0.24;
        for (var i = 0; i < n; i++) {
          var ang = (i / n) * Math.PI * 2 - Math.PI / 2;
          ang += (seededRand(ai * 13 + i) - 0.5) * 0.38;
          var wobble = 0.55 + seededRand(ai * 11 + i * 17) * 0.58;
          if (seededRand(ai * 19 + i * 7) > 0.42) wobble *= 0.58;
          if (seededRand(ai * 29 + i * 3) > 0.72) wobble *= 1.25;
          pts.push({
            x: Math.cos(ang) * (pw / 2) * wobble,
            y: Math.sin(ang) * (ph / 2) * wobble * (aspect / 0.65)
          });
        }
        function gp(i) { return pts[(i + pts.length) % pts.length]; }
        ctx.beginPath();
        for (var i = 0; i < pts.length; i++) {
          var p0 = gp(i - 1), p1 = gp(i), p2 = gp(i + 1), p3 = gp(i + 2);
          var c1x = p1.x + (p2.x - p0.x) / 6;
          var c1y = p1.y + (p2.y - p0.y) / 6;
          var c2x = p2.x - (p3.x - p1.x) / 6;
          var c2y = p2.y - (p3.y - p1.y) / 6;
          if (i === 0) ctx.moveTo(p1.x, p1.y);
          ctx.bezierCurveTo(c1x, c1y, c2x, c2y, p2.x, p2.y);
        }
        ctx.closePath();
        if (state.drawings[a.id]) {
          ctx.fillStyle = (ai % 2) ? 'rgba(190, 230, 170, 0.18)' : 'rgba(255, 242, 160, 0.18)';
          ctx.fill();
          ctx.strokeStyle = (ai % 2) ? 'rgba(122, 154, 92, 0.75)' : 'rgba(160, 130, 60, 0.75)';
          ctx.lineWidth = 1.3; ctx.setLineDash([]); ctx.stroke();
        } else {
          ctx.strokeStyle = 'rgba(140, 140, 130, 0.7)';
          ctx.lineWidth = 1.1; ctx.setLineDash([2.5, 2]); ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.restore();
        if (state.drawings[a.id] && images[a.id]) {
          var iw = 34, ih = 30;
          ctx.drawImage(images[a.id], pt.x - iw / 2, pt.y - ih / 2 + bob - 1, iw, ih);
        }
        var label = a.short || a.name;
        ctx.font = '700 10px ' + body; ctx.textAlign = 'center';
        var tw = ctx.measureText(label).width;
        var ly = pt.y + 22 + bob;
        ly = Math.min(my + mh - 8, Math.max(my + 14, ly));
        var lx = Math.min(mx + mw - tw / 2 - 8, Math.max(mx + tw / 2 + 8, pt.x));
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        roundedRect(ctx, lx - tw / 2 - 5, ly - 10, tw + 10, 14, 6); ctx.fill();
        ctx.fillStyle = state.drawings[a.id] ? '#ff6a00' : '#6b7280';
        ctx.fillText(label, lx, ly);
      });
      ctx.restore();
    } else {
      /* 3-col grid; last row centered; footer packed under the grid */
      var drawnList = drawnAnimals();
      var n = drawnList.length;
      var cols = 3;
      var rows = Math.max(1, Math.ceil(n / cols));
      var gap = 16;
      var labelH = 32;
      var padX = 36;
      var packGap = 28;
      var titleH = 34;
      var statsH = 58;
      var footerBlockH = titleH + 12 + statsH;
      var creditH = 36;
      var bottomSafe = 20 + creditH;
      var minTop = contentTop + 8;
      var maxBottom = H - bottomSafe;
      var availForPack = maxBottom - minTop;
      var maxGridH = Math.max(80, availForPack - packGap - footerBlockH);
      var gw = W - padX * 2;
      var cellW = (gw - gap * (cols - 1)) / cols;
      var cell = Math.max(72, Math.min(cellW, 260));
      var gridW = cols * cell + (cols - 1) * gap;
      var ox = (W - gridW) / 2;
      var cellHeight = (maxGridH - (rows - 1) * gap - rows * labelH) / rows;
      var maxAspect = rows <= 2 ? 1.32 : rows <= 3 ? 1.18 : 1.05;
      cellHeight = Math.min(cellHeight, cell * maxAspect);
      if (cellHeight < cell * 0.88) cellHeight = Math.max(64, (maxGridH - (rows - 1) * gap - rows * labelH) / rows);
      var gridH = rows * (cellHeight + labelH) + (rows - 1) * gap;
      if (gridH > maxGridH) {
        cellHeight = Math.max(56, (maxGridH - (rows - 1) * gap - rows * labelH) / rows);
        gridH = rows * (cellHeight + labelH) + (rows - 1) * gap;
      }
      var packH = gridH + packGap + footerBlockH;
      var packTop = minTop;
      if (packH < availForPack) packTop = minTop + (availForPack - packH) * 0.42;
      var oy = packTop;
      var footerY = oy + gridH + packGap;
      var lastRowCount = n % cols === 0 ? cols : n % cols;
      var lastRowOffset = (cols - lastRowCount) * (cell + gap) / 2;
      var rowStride = cellHeight + labelH + gap;
      var cellBoxH = cellHeight;

      drawnList.forEach(function (a, gi) {
        var col = gi % cols;
        var row = Math.floor(gi / cols);
        var isLast = row === rows - 1 && n > 0;
        var gx = ox + col * (cell + gap) + (isLast ? lastRowOffset : 0);
        var gy = oy + row * rowStride;
        var bob2 = Math.sin(t * Math.PI * 2 + gi * 0.5) * 3;
        ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 3;
        roundedRect(ctx, gx, gy + bob2, cell, cellBoxH, 14); ctx.fill(); ctx.stroke();
        if (images[a.id]) {
          var s = Math.min(cell, cellBoxH) * 0.82;
          ctx.drawImage(images[a.id], gx + (cell - s) / 2, gy + (cellBoxH - s) / 2 + bob2, s, s);
        }
        ctx.fillStyle = '#333';
        ctx.font = '600 18px ' + body;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(a.short || a.name, gx + cell / 2, gy + cellBoxH + 22 + bob2);
      });
      if (!n) {
        ctx.fillStyle = '#999'; ctx.font = '16px ' + body; ctx.textAlign = 'center';
        ctx.fillText('Chưa có tranh', W / 2, minTop + maxGridH / 2);
        footerY = minTop + maxGridH + packGap;
      }
    }

    /* Footer packed under content: title + 3 equal, centered stat columns */
    if (typeof footerY !== 'number') footerY = H - 150;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#111';
    ctx.font = '700 26px ' + display;
    var titleStr = tour.titles[0] ? tour.titles[0].name : '';
    ctx.fillText(titleStr, W / 2, footerY + 26);

    var mY = footerY + 70;
    var colX = [W / 6, W / 2, (W * 5) / 6];
    var values = [tour.kmLabel, String(tour.steps), tour.count + '/' + CFG.ANIMALS.length];
    var labels = ['QUÃNG ĐƯỜNG', 'BƯỚC CHÂN', 'CHUỒNG'];
    values.forEach(function (val, i) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff6a00';
      ctx.font = '700 28px ' + display;
      ctx.fillText(val, colX[i], mY);
      ctx.fillStyle = '#6b6b6b';
      ctx.font = '600 12px ' + body;
      ctx.fillText(labels[i], colX[i], mY + 20);
    });

    ctx.textAlign = 'center';
    ctx.fillStyle = '#999';
    ctx.font = '11px ' + body;
    ctx.fillText('© OpenStreetMap contributors · lối đi tham khảo', W / 2, H - 24);
  }

  async function prepareExportAssets() {
    await waitFonts();
    var mapImg = await loadImage(MAP_URI);
    var images = {};
    Object.keys(state.drawings).forEach(function () {});
    var ids = Object.keys(state.drawings);
    for (var i = 0; i < ids.length; i++) {
      try { images[ids[i]] = await loadImage(state.drawings[ids[i]].dataUrl); } catch (e) {}
    }
    return { mapImg: mapImg, images: images, tour: computeTour() };
  }

  async function exportPng() {
    var assets = await prepareExportAssets();
    var canvas = $('exportCanvas');
    canvas.width = 720; canvas.height = 1280;
    var ctx = canvas.getContext('2d');
    paintExportFrame(ctx, 720, 1280, assets.tour, assets.images, assets.mapImg, 1);
    return new Promise(function (resolve) {
      canvas.toBlob(function (blob) {
        lastPngBlob = blob;
        lastPngName = exportLayout === 'map' ? 'thao-cam-vien-wrapped-map.png' : 'thao-cam-vien-wrapped-luoi.png';
        resolve(blob);
      }, 'image/png');
    });
  }

  $('btnExportPng').addEventListener('click', async function () {
    exportMedia = 'image';
    try { var blob = await exportPng(); downloadBlob(blob, lastPngName); }
    catch (e) { alert('Không tạo được ảnh: ' + (e && e.message ? e.message : e)); }
  });
  $('btnSharePng').addEventListener('click', async function () {
    try {
      var blob = lastPngBlob || await exportPng();
      var file = new File([blob], lastPngName || 'thao-cam-vien-wrapped.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] }))
        await navigator.share({ files: [file], title: 'TCV Wrapped' });
      else downloadBlob(blob, lastPngName);
    } catch (e) { if (e && e.name !== 'AbortError') alert('Chia sẻ thất bại — thử Tải ảnh PNG'); }
  });

  function pickRecorderMime() {
    var types = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    for (var i = 0; i < types.length; i++)
      if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(types[i])) return types[i];
    return '';
  }

  async function exportVideo() {
    var assets = await prepareExportAssets();
    var canvas = $('exportCanvas');
    canvas.width = 720; canvas.height = 1280;
    var ctx = canvas.getContext('2d');
    var mime = pickRecorderMime();
    var ext = mime.indexOf('mp4') >= 0 ? 'mp4' : 'webm';
    lastVideoName = (exportLayout === 'map' ? 'thao-cam-vien-wrapped-map.' : 'thao-cam-vien-wrapped-luoi.') + ext;

    var progress = $('videoProgress'), bar = $('videoProgressBar'), text = $('videoProgressText');
    progress.classList.remove('hidden'); bar.style.width = '0%'; text.textContent = 'Chuẩn bị khung hình';

    var stream = canvas.captureStream(30);
    var chunks = [];
    var recorder;
    try { recorder = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 2500000 } : { videoBitsPerSecond: 2500000 }); }
    catch (e) { recorder = new MediaRecorder(stream); }
    recorder.ondataavailable = function (ev) { if (ev.data && ev.data.size) chunks.push(ev.data); };

    var durationMs = 8500, fps = 30, totalFrames = Math.round(durationMs / 1000 * fps), frame = 0;
    var tStart = performance.now();
    return new Promise(function (resolve, reject) {
      var finished = false;
      function finish() {
        if (finished) return; finished = true;
        try { if (recorder.state !== 'inactive') recorder.stop(); } catch (err) {}
        stream.getTracks().forEach(function (tr) { tr.stop(); });
      }
      recorder.onstop = function () {
        progress.classList.add('hidden');
        var blob = new Blob(chunks, { type: mime || 'video/webm' });
        lastVideoBlob = blob; resolve(blob);
      };
      recorder.onerror = function (e) { progress.classList.add('hidden'); reject(e.error || e); };
      recorder.start(100);
      function tick() {
        if (finished) return;
        var elapsed = performance.now() - tStart;
        var u = Math.min(1, elapsed / durationMs);
        paintExportFrame(ctx, 720, 1280, assets.tour, assets.images, assets.mapImg, u);
        var pct = Math.min(100, Math.round(u * 100));
        bar.style.width = pct + '%';
        text.textContent = 'Đang ghi ' + pct + '% · ' + (exportLayout === 'map' ? 'bản đồ' : 'lưới tranh');
        frame++;
        if (elapsed >= durationMs || frame > totalFrames + 30) {
          finish();
        } else {
          setTimeout(tick, 1000 / fps);
        }
      }
      /* hard stop at 10s wall clock */
      setTimeout(finish, 10000);
      tick();
    });
  }

  $('btnExportVideo').addEventListener('click', async function () {
    exportMedia = 'video';
    try {
      var blob = await exportVideo();
      if (!blob || blob.size < 100) throw new Error('Video rỗng');
      downloadBlob(blob, lastVideoName);
    } catch (e) {
      if ($('videoProgress')) $('videoProgress').classList.add('hidden');
      alert('Không tạo được video: ' + (e && e.message ? e.message : e));
    }
  });
  $('btnShareVideo').addEventListener('click', async function () {
    try {
      var blob = lastVideoBlob || await exportVideo();
      var file = new File([blob], lastVideoName || 'thao-cam-vien-wrapped.webm', { type: blob.type || 'video/webm' });
      if (navigator.canShare && navigator.canShare({ files: [file] }))
        await navigator.share({ files: [file], title: 'TCV Wrapped video' });
      else downloadBlob(blob, lastVideoName);
    } catch (e) { if (e && e.name !== 'AbortError') alert('Chia sẻ video thất bại'); }
  });

  /* Seed: childlike strokes following guide SVG paths */
  function makeStrokeFromPaths(pathDs, viewBox) {
    var c = document.createElement('canvas');
    c.width = 280; c.height = 280;
    var ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 280, 280);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 5.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    var vb = viewBox || [0, 0, 200, 200];
    var vbX = vb[0] || 0, vbY = vb[1] || 0;
    var vbW = vb[2] || 200, vbH = vb[3] || 200;
    var margin = 16;
    var scale = Math.min((280 - margin * 2) / vbW, (280 - margin * 2) / vbH);

    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', String(vbW));
    svg.setAttribute('height', String(vbH));
    svg.setAttribute('viewBox', vbX + ' ' + vbY + ' ' + vbW + ' ' + vbH);
    document.body.appendChild(svg);

    pathDs.forEach(function (d) {
      var path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', d);
      svg.appendChild(path);
      var len = 0;
      try { len = path.getTotalLength(); } catch (e) { return; }
      if (!len || len < 2) return;
      var steps = Math.max(40, Math.floor(len / 1.4));
      var pts = [];
      for (var i = 0; i <= steps; i++) {
        var pt = path.getPointAtLength((i / steps) * len);
        var jx = (Math.random() - 0.5) * 2.4;
        var jy = (Math.random() - 0.5) * 2.4;
        pts.push([
          margin + (pt.x - vbX) * scale + jx,
          margin + (pt.y - vbY) * scale + jy
        ]);
      }
      if (pts.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (var k = 1; k < pts.length; k++) {
        var mx = (pts[k - 1][0] + pts[k][0]) / 2 + (Math.random() - 0.5);
        var my = (pts[k - 1][1] + pts[k][1]) / 2 + (Math.random() - 0.5);
        ctx.quadraticCurveTo(pts[k - 1][0], pts[k - 1][1], mx, my);
      }
      ctx.stroke();
    });
    svg.remove();

    /* transparent crop — ink only */
    var img = ctx.getImageData(0, 0, 280, 280), data = img.data;
    var minX = 280, minY = 280, maxX = 0, maxY = 0, found = false;
    for (var y = 0; y < 280; y++) for (var x = 0; x < 280; x++) {
      var i = (y * 280 + x) * 4;
      if (data[i + 3] > 10 && data[i] < 200) {
        found = true;
        if (x < minX) minX = x; if (y < minY) minY = y;
        if (x > maxX) maxX = x; if (y > maxY) maxY = y;
      }
    }
    var out = document.createElement('canvas');
    if (!found) { out.width = 64; out.height = 64; return out.toDataURL('image/png'); }
    var pad = 12;
    minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
    maxX = Math.min(279, maxX + pad); maxY = Math.min(279, maxY + pad);
    var cw = maxX - minX + 1, ch = maxY - minY + 1;
    out.width = cw; out.height = ch;
    var octx = out.getContext('2d');
    var src = ctx.getImageData(minX, minY, cw, ch);
    var dst = octx.createImageData(cw, ch);
    for (var p = 0; p < src.data.length; p += 4) {
      if (src.data[p + 3] > 10 && src.data[p] < 200) {
        dst.data[p] = 17; dst.data[p + 1] = 17; dst.data[p + 2] = 17; dst.data[p + 3] = 255;
      }
    }
    octx.putImageData(dst, 0, 0);
    return out.toDataURL('image/png');
  }

  function makeStrokeDrawing(kind) {
    var a = animalById(kind);
    var pack = (window.SUMMIT_GUIDES && window.SUMMIT_GUIDES[kind]) || null;
    /* Prefer config.js guidePaths (hand-drawn strokes) so seeded map /
       wrapped drawings stay sketch-like. Filled v4 hint icons in
       SUMMIT_GUIDES are for the board overlay only. */
    var useSeedStrokes = a && a.guidePaths && a.guidePaths.length;
    var paths = useSeedStrokes ? a.guidePaths
      : (pack && pack.paths && pack.paths.length) ? pack.paths
      : null;
    var vb = useSeedStrokes ? [0, 0, 512, 512]
      : (pack && pack.viewBox) || [0, 0, 200, 200];
    if (paths) return makeStrokeFromPaths(paths, vb);
    /* fallback simple blob */
    return makeStrokeFromPaths(['M60 120 C60 80 90 55 130 60 C165 65 175 100 165 130 C155 160 120 175 90 170 C65 165 60 145 60 120 Z'], [0, 0, 200, 200]);
  }


  function seedCount(n) {
    state.user = { name: 'Demo', email: 'demo@test.local' };
    state.drawings = {}; state.order = [];
    n = Math.max(0, Math.min(CFG.ANIMALS.length, n | 0));
    /* pick evenly by mapY bands so enclosures look spread; always include FIRST_ANIMAL; end with southernmost pick */
    var all = CFG.ANIMALS.slice().sort(function (a, b) { return a.mapY - b.mapY; });
    var pick = [];
    if (n <= 0) { saveState(); return; }
    if (n === 1) {
      pick = [CFG.FIRST_ANIMAL];
    } else {
      pick.push(CFG.FIRST_ANIMAL);
      for (var i = 0; i < n - 1; i++) {
        var idx = Math.round(i * (all.length - 1) / Math.max(1, n - 2));
        var id = all[Math.min(all.length - 1, idx)].id;
        if (pick.indexOf(id) < 0) pick.push(id);
      }
      /* fill remaining */
      for (var j = 0; j < all.length && pick.length < n; j++) {
        if (pick.indexOf(all[j].id) < 0) pick.push(all[j].id);
      }
      /* move southernmost (max mapY) to end as current location */
      var south = pick[0], southY = -1;
      pick.forEach(function (id) {
        var a = animalById(id); if (a && a.mapY > southY) { southY = a.mapY; south = id; }
      });
      pick = pick.filter(function (id) { return id !== south; });
      pick.push(south);
    }
    pick.slice(0, n).forEach(function (id, i) {
      state.drawings[id] = {
        dataUrl: makeStrokeDrawing(id),
        durationSec: 16 + (i % 8) * 2,
        autoSubmit: false,
        motion: pickMotion(id),
        at: Date.now(),
      };
      state.order.push(id);
    });
    saveState();
  }

  function seedDemo() {
    state.user = { name: 'Demo', email: 'demo@test.local' };
    var ids = ['capybara', 'voi', 'huou', 'ho', 'meerkat'];
    state.drawings = {}; state.order = [];
    ids.forEach(function (id, i) {
      state.drawings[id] = {
        dataUrl: makeStrokeDrawing(id),
        /* durations: mid range so title is explorer/fast without contradicting slow */
        durationSec: 18 + i * 2,
        autoSubmit: false,
        motion: pickMotion(id),
        at: Date.now(),
      };
      state.order.push(id);
    });
    saveState();
  }

  function boot() {
    var img = new Image(); img.src = MAP_URI;
    if (drawnCount() > 0 && state.user) openMap();
    else show('screen-welcome');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.__SUMMIT__ = {
    state: function () { return state; },
    reset: resetDemo,
    seedDemo: seedDemo,
    seedCount: seedCount,
    openMap: openMap,
    overviewMap: overviewMap,
    focusAnimal: focusAnimal,
    openExport: openExport,
    openWrapped: openWrapped,
    playStravaTimelapse: function () { playStravaTimelapse(computeTour()); },
    openDirections: openDirections,
    openAnimalList: openAnimalList,
    closeAnimalList: closeAnimalList,
    showArrivalSheet: showArrivalSheet,
    startNavigation: startNavigation,
    stopNav: stopNav,
    openGrid: openGrid,
    openTitles: openTitles,
    startDraw: startDraw,
    setZoom: setZoom,
    exportPng: exportPng,
    exportVideo: exportVideo,
    setLayout: function (l) { exportLayout = l; },
    downloadBlob: downloadBlob,
    draw: function () { return draw; },
  };
})();
