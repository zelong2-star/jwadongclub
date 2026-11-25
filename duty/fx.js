/* fx.js — 터치 효과음 + 진동(햅틱). 설정은 이 폰에만 저장돼요. 소리는 아주 작게, 끌 수 있어요. */
(function (root) {
  'use strict';
  var KEY = 'jwadong-fx-v1', st = { sound: true, haptic: true }, ctx = null, last = 0;
  try { var s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) { st.sound = s.sound !== false; st.haptic = s.haptic !== false; } } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }
  function audio() {
    if (ctx) return ctx;
    try { var A = root.AudioContext || root.webkitAudioContext; if (A) ctx = new A(); } catch (e) { ctx = null; }
    return ctx;
  }
  // 음 목록 [주파수, 시작(초), 길이(초), 볼륨]
  var SND = {
    tap: [[880, 0, .035, .05]],
    ok: [[660, 0, .07, .07], [990, .08, .12, .07]],
    warn: [[330, 0, .09, .08], [262, .1, .14, .08]]
  };
  var VIB = { tap: 8, ok: [14, 50, 22], warn: [40, 60, 40] };
  function play(kind) {
    var c = audio(); if (!c) return;
    try {
      if (c.state === 'suspended') c.resume();
      var t0 = c.currentTime;
      SND[kind].forEach(function (n) {
        var o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.value = n[0];
        g.gain.setValueAtTime(0.0001, t0 + n[1]); g.gain.exponentialRampToValueAtTime(n[3], t0 + n[1] + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + n[1] + n[2]);
        o.connect(g); g.connect(c.destination); o.start(t0 + n[1]); o.stop(t0 + n[1] + n[2] + 0.02);
      });
    } catch (e) {}
  }
  function fire(kind) {
    var now = Date.now(); if (kind === 'tap' && now - last < 40) return; last = now;
    if (st.sound) play(kind);
    if (st.haptic) { try { if (root.navigator && navigator.vibrate) navigator.vibrate(VIB[kind]); } catch (e) {} }
  }
  var api = {
    tap: function () { fire('tap'); }, ok: function () { fire('ok'); }, warn: function () { fire('warn'); },
    get: function () { return { sound: st.sound, haptic: st.haptic }; },
    set: function (o) { if (o && 'sound' in o) st.sound = !!o.sound; if (o && 'haptic' in o) st.haptic = !!o.haptic; save(); },
    canVibrate: function () { return !!(root.navigator && navigator.vibrate); }
  };
  // 버튼·칸·탭을 누를 때 가볍게 (비활성 버튼은 제외)
  var SEL = 'button,[role=button],a[href],summary,.c,.chip,.opt,.tog,.stat,label.tgl,input[type=checkbox]';
  if (root.document) document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest && e.target.closest(SEL);
    if (!t || t.disabled || t.getAttribute('aria-disabled') === 'true' || t.hasAttribute('data-nofx')) return;
    api.tap();
  }, true);
  root.DutyFx = api;
})(typeof window !== 'undefined' ? window : globalThis);
