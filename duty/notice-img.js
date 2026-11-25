/* notice-img.js — 달력형 당번표를 이미지(canvas)로 그린다. 카톡 공지용 */
(function (root) {
  'use strict';
  var FONT = '"Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo","Noto Sans CJK KR",sans-serif';
  var DOW = ['월', '화', '수', '목', '금', '토', '일'];
  // opt: {year, month, duties:{day:[a,b]}, lines:[string], stamp:'11/25', changed:{day:true}, footer:'...'}
  function draw(canvas, opt) {
    var y = opt.year, m = opt.month, ds = opt.duties || {}, lines = opt.lines || [], changed = opt.changed || {};
    var W = 1080, cw = W / 7, ch = 112, titleH = 72, headH = 46;
    var dim = new Date(y, m, 0).getDate(), off = (new Date(y, m - 1, 1).getDay() + 6) % 7;
    var rows = Math.ceil((off + dim) / 7);
    var gridH = rows * ch, extra = 0;
    var shown = lines.slice(-10);
    if (shown.length) extra += 56 + shown.length * 34;
    var anyChanged = Object.keys(changed).length > 0;
    if (anyChanged) extra += 40;
    var footH = 52;
    var H = titleH + headH + gridH + extra + footH;
    canvas.width = W; canvas.height = H;
    var g = canvas.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
    // 제목
    g.fillStyle = '#1F4E79'; g.fillRect(0, 0, W, titleH);
    g.fillStyle = '#ffffff'; g.font = 'bold 34px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(y + '년 ' + m + '월 당번표' + (opt.stamp ? '  (최종 수정 ' + opt.stamp + ')' : ''), W / 2, titleH / 2 + 1);
    // 요일
    for (var c = 0; c < 7; c++) {
      var we = c >= 5;
      g.fillStyle = we ? '#C62828' : '#D9EAF7'; g.fillRect(c * cw, titleH, cw, headH);
      g.fillStyle = we ? '#ffffff' : '#1b2733'; g.font = 'bold 24px ' + FONT; g.textAlign = 'center';
      g.fillText(DOW[c], c * cw + cw / 2, titleH + headH / 2 + 1);
    }
    // 칸
    var top = titleH + headH;
    for (var r = 0; r < rows; r++) for (var cc = 0; cc < 7; cc++) {
      var day = r * 7 + cc - off + 1, x0 = cc * cw, y0 = top + r * ch;
      var inMonth = day >= 1 && day <= dim;
      g.fillStyle = !inMonth ? '#F1F4F7' : (inMonth && changed[day]) ? '#FFF1B8' : cc >= 5 ? '#F2F7FC' : '#ffffff';
      g.fillRect(x0, y0, cw, ch);
      g.strokeStyle = '#9fb0c0'; g.lineWidth = 1; g.strokeRect(x0 + 0.5, y0 + 0.5, cw, ch);
      if (!inMonth) continue;
      g.textAlign = 'left'; g.textBaseline = 'top';
      g.fillStyle = cc >= 5 ? '#C62828' : '#33475b'; g.font = '18px ' + FONT;
      g.fillText(String(day), x0 + 8, y0 + 6);
      var names = (ds[day] || []).filter(function (n) { return n && String(n).trim(); });
      g.fillStyle = '#111111';
      names.forEach(function (n, i) {
        var size = 27; g.font = 'bold ' + size + 'px ' + FONT;
        while (g.measureText(n).width > cw - 16 && size > 14) { size--; g.font = 'bold ' + size + 'px ' + FONT; }
        g.fillText(n, x0 + 10, y0 + 34 + i * 38);
      });
    }
    var y1 = top + gridH + 14;
    if (anyChanged) {
      g.fillStyle = '#FFF1B8'; g.fillRect(14, y1 + 4, 22, 22); g.strokeStyle = '#c9b458'; g.strokeRect(14.5, y1 + 4.5, 22, 22);
      g.fillStyle = '#5c4a00'; g.font = '20px ' + FONT; g.textAlign = 'left'; g.textBaseline = 'top';
      g.fillText('노란 칸은 교환으로 바뀐 날이에요', 46, y1 + 5); y1 += 40;
    }
    if (shown.length) {
      g.fillStyle = '#1F4E79'; g.font = 'bold 26px ' + FONT; g.textAlign = 'left'; g.textBaseline = 'top';
      g.fillText('변경 내역', 14, y1 + 6); y1 += 48;
      g.fillStyle = '#222'; g.font = '22px ' + FONT;
      shown.forEach(function (t, i) { g.fillText(t, 14, y1 + i * 34); });
      y1 += shown.length * 34 + 6;
    }
    g.fillStyle = '#5a6b7b'; g.font = '19px ' + FONT; g.textAlign = 'left'; g.textBaseline = 'top';
    g.fillText(opt.footer || '교환은 당번표 앱에서 요청하세요', 14, H - footH + 14);
    return canvas;
  }
  var api = { draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.NoticeImg = api;
})(typeof window !== 'undefined' ? window : globalThis);
