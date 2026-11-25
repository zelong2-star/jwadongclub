(function (g) {
  'use strict';
  var DOW = ['월', '화', '수', '목', '금', '토', '일'];
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function parseKey(k) { var p = k.split('-'); return [parseInt(p[0], 10), parseInt(p[1], 10)]; }
  function dowOf(y, m, d) { return DOW[(new Date(y, m - 1, d).getDay() + 6) % 7]; }
  function label(k, d) { var p = parseKey(k); return p[1] + '/' + d + '(' + dowOf(p[0], p[1], d) + ')'; }
  function md(at) { var n = new Date(at); return (n.getMonth() + 1) + '/' + n.getDate(); }
  function isPast(k, d) {
    var p = parseKey(k), n = new Date();
    return new Date(p[0], p[1] - 1, d) < new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }
  // a, b: {day, j, name}. 두 자리의 이름이 지금도 그대로일 때만 맞바꾼다.
  function swapDuties(duties, a, b) {
    var da = duties[a.day], db = duties[b.day];
    if (!da || !db || String(a.day) === String(b.day)) return { ok: false };
    if (da[a.j] !== a.name || db[b.j] !== b.name) return { ok: false };
    var out = JSON.parse(JSON.stringify(duties));
    out[a.day][a.j] = b.name;
    out[b.day][b.j] = a.name;
    return { ok: true, duties: out };
  }
  function noticeText(k, duties, lines, stamp) {
    var p = parseKey(k);
    var days = Object.keys(duties).map(Number).sort(function (a, b) { return a - b; });
    var rows = [];
    days.forEach(function (d) {
      var a = duties[d] || [];
      var names = [a[0], a[1]].filter(function (x) { return x && String(x).trim(); });
      if (names.length) rows.push(label(k, d) + ' ' + names.join('·'));
    });
    var out = '📌 ' + p[1] + '월 당번표 (최종 수정: ' + stamp + ')\n※ 교환은 당번표 앱에서 요청하고, 상대가 수락하면 바로 반영됩니다.\n\n';
    out += rows.length ? rows.join('\n') : '(아직 입력된 당번이 없어요)';
    out += '\n\n🔄 변경 내역\n' + (lines.length ? lines.join('\n') : '(없음)');
    return out;
  }
  function parseNotice(t, defYear) {
    var idx = t.indexOf('변경 내역');
    var head = idx >= 0 ? t.slice(0, idx) : t;
    var re = /^\D*?(\d{1,2})\/(\d{1,2})\s*\(\s*[월화수목금토일]\s*\)\s*(.+)$/;
    var duties = {}, m0 = 0, found = 0;
    head.split(/\r?\n/).forEach(function (line) {
      var m = re.exec(line.trim());
      if (!m) return;
      var mm = parseInt(m[1], 10), dd = parseInt(m[2], 10);
      if (!m0) m0 = mm;
      if (mm !== m0) return;
      var names = m[3].split(/[·,，、\/\s]+/).filter(function (x) { return x; });
      if (!names.length) return;
      duties[dd] = [names[0], names[1] || ''];
      found++;
    });
    var yr = /(\d{4})\s*년/.exec(head);
    return { m: m0, y: yr ? parseInt(yr[1], 10) : defYear, duties: duties, found: found };
  }
  function hashPin(pin) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode('jwadong-duty:' + String(pin).trim())).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('').slice(0, 40);
    });
  }
  // ---- 공개 교환 요청 ----
  // 당번일 "하루 전까지"만 유효: 당번 당일부터는 만료
  function expired(k, d) {
    var p = parseKey(k), n = new Date();
    return new Date(p[0], p[1] - 1, d) <= new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }
  function dkey(k, d) { var p = parseKey(k); return p[0] + '-' + pad(p[1]) + '-' + pad(d); }
  // cond: {mode:'dow'|'dates'|'except', dows:[0..6(월=0)], dates:['YYYY-MM-DD']}
  function condOk(cond, k, d) {
    if (!cond) return false;
    var p = parseKey(k), idx = (new Date(p[0], p[1] - 1, d).getDay() + 6) % 7, key = dkey(k, d);
    if (cond.mode === 'dow') return (cond.dows || []).indexOf(idx) >= 0;
    if (cond.mode === 'dates') return (cond.dates || []).indexOf(key) >= 0;
    if (cond.mode === 'except') return (cond.dates || []).indexOf(key) < 0;
    return false;
  }
  function condText(cond) {
    if (!cond) return '';
    function dl(arr) { return arr.slice().sort().map(function (s) { var q = s.split('-'); return parseInt(q[1], 10) + '/' + parseInt(q[2], 10); }).join(', '); }
    if (cond.mode === 'dow') return (cond.dows || []).slice().sort(function (a, b) { return a - b; }).map(function (i) { return DOW[i]; }).join('·') + '요일 가능';
    if (cond.mode === 'dates') return dl(cond.dates || []) + ' 가능';
    if (cond.mode === 'except') return (cond.dates && cond.dates.length) ? dl(cond.dates) + ' 빼고 언제든' : '언제든';
    return '';
  }
  // 수락 가능 여부. acc: {day,j,name}. 순수 함수(저장소 트랜잭션과 화면에서 같이 사용)
  function canAcceptOpen(duties, r, acc, locked) {
    if (locked) return { ok: false, reason: 'locked' };
    if (expired(r.month, r.fromDay)) return { ok: false, reason: 'expired' };
    if (expired(r.month, acc.day)) return { ok: false, reason: 'past' };
    if (acc.name === r.fromName) return { ok: false, reason: 'self' };
    if (!condOk(r.cond, r.month, acc.day)) return { ok: false, reason: 'cond' };
    var df = duties[r.fromDay] || [], da = duties[acc.day] || [];
    if (df[r.fromJ] !== r.fromName || da[acc.j] !== acc.name) return { ok: false, reason: 'stale' };
    if (df.indexOf(acc.name) >= 0 || da.indexOf(r.fromName) >= 0) return { ok: false, reason: 'dup' };
    return swapDuties(duties, { day: r.fromDay, j: r.fromJ, name: r.fromName }, acc);
  }
  // 내가 이 요청을 수락할 수 있는 내 당번일 목록
  function myOptions(duties, r, me, locked) {
    var out = [];
    Object.keys(duties).map(Number).sort(function (a, b) { return a - b; }).forEach(function (d) {
      var a = duties[d] || [];
      a.forEach(function (n, j) { if (n === me && canAcceptOpen(duties, r, { day: d, j: j, name: me }, locked).ok) out.push({ day: d, j: j, name: me }); });
    });
    return out;
  }
  g.DutyCore = { DOW: DOW, pad: pad, parseKey: parseKey, dowOf: dowOf, label: label, md: md, isPast: isPast,
    swapDuties: swapDuties, noticeText: noticeText, parseNotice: parseNotice, hashPin: hashPin,
    expired: expired, dkey: dkey, condOk: condOk, condText: condText, canAcceptOpen: canAcceptOpen, myOptions: myOptions };
})(window);
