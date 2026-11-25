/* cal-ocr.js — 달력형 당번표 이미지 → {year,month,duties} (순수 로직; OCR 엔진은 외부 주입) */
(function (root) {
  'use strict';
  // img: {width,height,data(RGBA)}
  function lum(d, i) { return (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000; }

  // 선(어두운 연속선) 위치 찾기: 투영 비율이 임계 이상인 구간의 중심
  function findLines(img, vertical, minFrac) {
    var W = img.width, H = img.height, d = img.data;
    var n = vertical ? W : H, m = vertical ? H : W, prof = new Array(n).fill(0);
    for (var a = 0; a < n; a++) {
      var run = 0, best = 0;
      for (var b = 0; b < m; b++) {
        var x = vertical ? a : b, y = vertical ? b : a;
        if (lum(d, (y * W + x) * 4) < 140) { run++; if (run > best) best = run; } else run = 0;
      }
      prof[a] = best / m;
    }
    var lines = [], i = 0;
    while (i < n) {
      if (prof[i] >= minFrac) {
        var j = i; while (j < n && prof[j] >= minFrac) j++;
        lines.push(Math.round((i + j - 1) / 2)); i = j;
      } else i++;
    }
    return lines;
  }

  function rowAvg(img, y) { var s = 0, W = img.width, d = img.data; for (var x = 0; x < W; x++) s += lum(d, (y * W + x) * 4); return s / W; }
  // 표 영역: 제목줄(진한 색) 가로 범위 → 7등분, 요일 머리줄 아래부터 행 시작, 행 높이는 가로선 간격 중앙값
  function detectGrid(img) {
    var W = img.width, H = img.height, d = img.data, y;
    var x0 = 0, x1 = W - 1;
    for (y = 2; y < 8; y++) { // 제목줄에서 좌우 끝
      var a = -1, b = -1;
      for (var x = 0; x < W; x++) if (lum(d, (y * W + x) * 4) < 120) { if (a < 0) a = x; b = x; }
      if (a >= 0 && b - a > W * 0.5) { x0 = a; x1 = b; break; }
    }
    // 머리줄 끝: 평균 밝기가 다시 240 이상으로 올라가는 첫 행
    var gridTop = 0, seenHead = false;
    for (y = 0; y < Math.min(H, 120); y++) {
      var av = rowAvg(img, y);
      if (av < 235) seenHead = true;
      else if (seenHead && av >= 240) { gridTop = y; break; }
    }
    var hy = findLines(img, false, 0.45).filter(function (v) { return v > gridTop + 5; });
    var diffs = []; for (var i = 1; i < hy.length; i++) { var df = hy[i] - hy[i - 1]; if (df >= 40) diffs.push(df); }
    diffs.sort(function (p, q) { return p - q; });
    var pitch = diffs.length ? diffs[Math.floor(diffs.length / 2)] : Math.round((x1 - x0) / 7 * 0.7);
    var ys = []; for (y = gridTop; y < H - pitch * 0.3; y += pitch) ys.push(y);
    ys.push(H);
    var xs = []; for (var k = 0; k <= 7; k++) xs.push(Math.round(x0 + (x1 - x0) * k / 7));
    return { xs: xs, ys: ys, gridTop: gridTop, pitch: pitch };
  }

  // 그레이스케일 + 쌍선형 확대 + 대비 늘리기(연한 배경/초록 삼각형 제거)
  function crop(img, x0, y0, x1, y1, scale, pad, invert) {
    pad = pad || 0; scale = scale || 1;
    x0 = Math.max(0, x0 + pad); y0 = Math.max(0, y0 + pad);
    x1 = Math.min(img.width, x1 - pad); y1 = Math.min(img.height, y1 - pad);
    var w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0), W = w * scale, H = h * scale;
    var out = new Uint8ClampedArray(W * H * 4), d = img.data, IW = img.width;
    function g(x, y) { x = Math.min(x1 - 1, Math.max(x0, x)); y = Math.min(y1 - 1, Math.max(y0, y)); return lum(d, (y * IW + x) * 4); }
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var fx = x0 + (x + 0.5) / scale - 0.5, fy = y0 + (y + 0.5) / scale - 0.5;
      var ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      var v = (g(ix, iy) * (1 - tx) + g(ix + 1, iy) * tx) * (1 - ty) + (g(ix, iy + 1) * (1 - tx) + g(ix + 1, iy + 1) * tx) * ty;
      if (invert) v = 255 - v;
      v = (v - 90) * 255 / (200 - 90); v = v < 0 ? 0 : v > 255 ? 255 : v;
      var oi = (y * W + x) * 4; out[oi] = out[oi + 1] = out[oi + 2] = v; out[oi + 3] = 255;
    }
    return { width: W, height: H, data: out };
  }

  // 셀 하나를 (날짜 숫자 영역, 이름 줄들)로 나눔. 이름이 없으면 lines=[]
  function cellParts(img, x0, y0, x1, y1) {
    var digits = crop(img, x0, y0, Math.min(x1, x0 + 40), Math.min(y1, y0 + 24), 4, 1);
    var nx0 = x0 + 3, nx1 = x1 - 3, ny0 = y0 + 17, ny1 = y1 - 2, W = img.width, d = img.data, rows = [];
    for (var y = ny0; y < ny1; y++) {
      var c = 0; for (var x = nx0; x < nx1; x++) if (lum(d, (y * W + x) * 4) < 120) c++;
      rows.push(c);
    }
    var lines = [], inRun = false, st = 0;
    for (var i = 0; i <= rows.length; i++) {
      var on = i < rows.length && rows[i] > 0;
      if (on && !inRun) { inRun = true; st = i; }
      if (!on && inRun) { inRun = false; if (i - st >= 7) lines.push([ny0 + st - 3, ny0 + i + 3]); }
    }
    return { digits: digits, lines: lines.map(function (l) { return crop(img, nx0, l[0], nx1, l[1], 4, 0); }) };
  }

  function cleanName(s) {
    s = (s || '').replace(/[^가-힣]/g, '');
    return s;
  }
  function lev(a, b) {
    var m = a.length, n = b.length, d = [], i, j;
    for (i = 0; i <= m; i++) { d[i] = [i]; }
    for (j = 1; j <= n; j++) d[0][j] = j;
    for (i = 1; i <= m; i++) for (j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }
  // 알려진 명단에 가장 가까운 이름으로 보정(거리 1 이하, 유일할 때만)
  function snap(name, known) {
    if (!known || !known.length || !name) return { name: name, snapped: false, exact: known && known.indexOf(name) >= 0 };
    if (known.indexOf(name) >= 0) return { name: name, snapped: false, exact: true };
    var best = null, bd = 9, tie = false;
    known.forEach(function (k) {
      if (Math.abs(k.length - name.length) > 1) return;
      var dd = lev(k, name);
      if (dd < bd) { bd = dd; best = k; tie = false; } else if (dd === bd) tie = true;
    });
    if (best && bd <= 1 && !tie) return { name: best, snapped: true, exact: false, raw: name };
    return { name: name, snapped: false, exact: false };
  }

  // cells[r][c] = {digits:'23', names:['김혜란','고진숙']}  (OCR 원문). 7열(월~일) 고정.
  function parseCells(cells, opt) {
    opt = opt || {};
    var known = opt.known || [];
    var votes = {}, parsed = [];
    cells.forEach(function (row, r) {
      row.forEach(function (cell, c) {
        var m = String(cell.digits || '').match(/\d{1,2}/), day = m ? parseInt(m[0], 10) : null;
        if (day && (day < 1 || day > 31)) day = null;
        var names = (cell.names || []).map(cleanName).filter(function (n) { return n.length >= 2 && n.length <= 5; });
        parsed.push({ r: r, c: c, day: day, names: names });
        if (day) { var off = day - (r * 7 + c); votes[off] = (votes[off] || 0) + 1; }
      });
    });
    var bestOff = null, bv = 0; Object.keys(votes).forEach(function (k) { if (votes[k] > bv) { bv = votes[k]; bestOff = +k; } });
    var out = {}, warnings = [];
    if (bestOff === null) return { duties: {}, warnings: ['날짜 숫자를 읽지 못했어요.'], offset: null };
    parsed.forEach(function (p) {
      var day = p.r * 7 + p.c + bestOff;
      if (day < 1 || day > 31 || !p.names.length) return;
      var ns = p.names.map(function (n) { return snap(n, known); });
      out[day] = ns.map(function (x) { return x.name; });
      if (ns.length !== 2) warnings.push(day + '일: 이름이 ' + ns.length + '명만 읽혔어요');
      ns.forEach(function (x) { if (known.length && !x.exact) warnings.push(day + '일: "' + x.name + '"' + (x.snapped ? ' (원문 "' + x.raw + '"에서 보정)' : ' 명단에 없는 이름')); });
    });
    return { duties: out, warnings: warnings, offset: bestOff };
  }

  // 제목에서 연/월 추출 ("2026년 12월 당번표")
  function parseTitle(text) {
    var m = String(text || '').match(/(\d{4})\s*년\s*(\d{1,2})\s*월/);
    return m ? { year: +m[1], month: +m[2] } : null;
  }

  // 해당 월 1일이 달력의 (행*7+열) 몇 번째 칸인지 → day = idx + offset 에서 offset = 1 - 1일의 요일(월=0)
  function expectedOffset(year, month) { var wd = (new Date(year, month - 1, 1).getDay() + 6) % 7; return 1 - wd; }

  // engine: { digits(img)->Promise<string>, text(img)->Promise<string> }. progress(done,total)
  function readImage(img, engine, opt) {
    opt = opt || {};
    var g = detectGrid(img), cells = [], title = null;
    var jobs = [], total = (g.ys.length - 1) * 7 + 1, done = 0;
    function tick() { done++; if (opt.progress) opt.progress(done, total); }
    var chain = Promise.resolve();
    chain = chain.then(function () {
      var th = Math.max(12, g.gridTop - 24);
      return engine.text(crop(img, g.xs[0], 2, g.xs[7], th, 3, 0, true));
    }).then(function (t) { title = parseTitle(t); tick(); });
    for (var r = 0; r < g.ys.length - 1; r++) {
      cells[r] = [];
      for (var c = 0; c < 7; c++) (function (r, c) {
        chain = chain.then(function () {
          var pt = cellParts(img, g.xs[c], g.ys[r], g.xs[c + 1], g.ys[r + 1]);
          var cell = { digits: '', names: [] }; cells[r][c] = cell;
          return engine.digits(pt.digits).then(function (t) { cell.digits = t; })
            .then(function () { var p = Promise.resolve(); pt.lines.forEach(function (l) { p = p.then(function () { return engine.text(l); }).then(function (t) { cell.names.push(t); }); }); return p; })
            .then(tick);
        });
      })(r, c);
    }
    return chain.then(function () {
      var res = parseCells(cells, { known: opt.known || [] });
      res.title = title; res.rows = g.ys.length - 1;
      return res;
    });
  }

  var api = { readImage: readImage, expectedOffset: expectedOffset, findLines: findLines, detectGrid: detectGrid, crop: crop, cellParts: cellParts, parseCells: parseCells, parseTitle: parseTitle, cleanName: cleanName, snap: snap, lev: lev };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CalOcr = api;
})(typeof window !== 'undefined' ? window : globalThis);
