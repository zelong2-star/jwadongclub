/* notice-img.js — 달력형 당번표를 이미지(canvas)로 그린다. 카톡 공지용 (토스 스타일) */
(function (root) {
  'use strict';
  var FONT = '"Pretendard","Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic","Noto Sans CJK KR",sans-serif';
  var DOW = ['월', '화', '수', '목', '금', '토', '일'];
  var INK = '#191F28', SUB = '#6B7684', GRAY = '#F2F4F6', BLUE = '#3182F6', RED = '#F04452', YEL = '#FFE08A', YTX = '#5C4300';
  function rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  // opt: {year, month, duties:{day:[a,b]}, stamp:'11/25 16시20분', changed:{day:[이름,...]}}
  function draw(canvas, opt) {
    var y = opt.year, m = opt.month, ds = opt.duties || {}, changed = opt.changed || {};
    var W = 1080, pad = 28, gap = 8, cw = (W - pad * 2 - gap * 6) / 7, ch = 150;
    var titleH = 120, headH = 56;
    var dim = new Date(y, m, 0).getDate(), off = (new Date(y, m - 1, 1).getDay() + 6) % 7;
    var rows = Math.ceil((off + dim) / 7);
    var gridH = rows * (ch + gap);
    var anyChanged = false;
    Object.keys(changed).forEach(function (d) { var v = changed[d]; if (v === true || (v && v.length)) anyChanged = true; });
    var legendH = anyChanged ? 64 : 24;
    var H = titleH + headH + gridH + legendH;
    canvas.width = W; canvas.height = H;
    var g = canvas.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
    // 제목 (왼쪽) + 수정 시각 (오른쪽)
    g.textBaseline = 'alphabetic'; g.textAlign = 'left'; g.fillStyle = INK; g.font = '800 54px ' + FONT;
    g.fillText(m + '월 당번표', pad + 6, 84);
    if (opt.stamp) { g.textAlign = 'right'; g.fillStyle = SUB; g.font = '500 27px ' + FONT; g.fillText(opt.stamp + ' 기준', W - pad - 6, 84); }
    // 요일
    g.textBaseline = 'middle'; g.textAlign = 'center';
    for (var c = 0; c < 7; c++) {
      g.fillStyle = c === 5 ? BLUE : c === 6 ? RED : SUB; g.font = '700 27px ' + FONT;
      g.fillText(DOW[c], pad + c * (cw + gap) + cw / 2, titleH + headH / 2);
    }
    // 칸
    var top = titleH + headH;
    for (var r = 0; r < rows; r++) for (var cc = 0; cc < 7; cc++) {
      var day = r * 7 + cc - off + 1;
      if (day < 1 || day > dim) continue;
      var x0 = pad + cc * (cw + gap), y0 = top + r * (ch + gap);
      g.fillStyle = GRAY; rr(g, x0, y0, cw, ch, 20); g.fill();
      g.textAlign = 'left'; g.textBaseline = 'top';
      g.fillStyle = cc === 5 ? BLUE : cc === 6 ? RED : INK; g.font = '700 24px ' + FONT;
      g.fillText(String(day), x0 + 12, y0 + 10);
      var names = (ds[day] || []).filter(function (n) { return n && String(n).trim(); });
      var ch0 = changed[day];
      names.forEach(function (n, i) {
        var hit = ch0 === true || (ch0 && ch0.indexOf(n) >= 0);
        var size = 31; g.font = (hit ? '800 ' : '600 ') + size + 'px ' + FONT;
        while (g.measureText(n).width > cw - 20 && size > 16) { size--; g.font = (hit ? '800 ' : '600 ') + size + 'px ' + FONT; }
        var tw = g.measureText(n).width, cy = y0 + 62 + i * 44;
        if (hit) { g.fillStyle = YEL; rr(g, x0 + cw / 2 - tw / 2 - 8, cy - 4, tw + 16, size + 12, 10); g.fill(); }
        g.fillStyle = hit ? YTX : INK; g.textAlign = 'center'; g.fillText(n, x0 + cw / 2, cy + 2); g.textAlign = 'left';
      });
    }
    var y1 = top + gridH + 14;
    if (anyChanged) {
      g.fillStyle = YEL; rr(g, pad + 6, y1 + 8, 30, 22, 8); g.fill();
      g.fillStyle = INK; g.font = '500 24px ' + FONT; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillText('노란 이름은 교환으로 바뀐 당번이에요', pad + 48, y1 + 20);
    }
    if (opt.footer) { g.fillStyle = SUB; g.font = '500 22px ' + FONT; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText(opt.footer, pad + 6, H - 10); }
    return canvas;
  }
  var api = { draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.NoticeImg = api;
})(typeof window !== 'undefined' ? window : globalThis);
