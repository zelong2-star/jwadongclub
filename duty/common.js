import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getFirestore, collection, doc, onSnapshot, runTransaction, addDoc, setDoc, updateDoc, query, orderBy, limit, where, getDocs }
  from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyBPHoNYfDggb2G_HtwrcxnH7CrA0s2Z0QQ",
  authDomain: "jwadong-duty.firebaseapp.com",
  projectId: "jwadong-duty",
  storageBucket: "jwadong-duty.firebasestorage.app",
  messagingSenderId: "59680339687",
  appId: "1:59680339687:web:49b8826fb49329820e5442",
  measurementId: "G-BFPFWL8JC9"
};

export function makeApi() {
  const C = window.DutyCore;
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  let h = null;
  const col = (n) => collection(db, 'c', h, n);
  const ref = (n, id) => doc(db, 'c', h, n, id);
  const slot = (d, j, name) => ({ day: Number(d), j: j, name: name });

  function logDoc(now, a, b, by) {
    return {
      at: now, month: a.month, month2: b.month !== a.month ? b.month : null, kind: 'swap', by: by, undone: false, a: a, b: b,
      text: C.md(now) + ' ' + C.label(a.month, a.day) + ' ' + a.name + ' ⇄ ' + C.label(b.month, b.day) + ' ' + b.name
    };
  }
  // 트랜잭션 안에서 여러 달 문서를 먼저 모두 읽기
  async function readMonths(tx, keys) {
    const dm = {}, locked = {}, refs = {};
    for (const k of Array.from(new Set(keys))) {
      refs[k] = ref('months', k);
      const s = await tx.get(refs[k]);
      dm[k] = s.exists() ? (s.data().duties || {}) : {};
      locked[k] = !!(s.exists() && s.data().locked);
    }
    return { dm, locked, refs };
  }
  function writeMonths(tx, rd, months, now) {
    Object.keys(months).forEach((k) => tx.set(rd.refs[k], { duties: months[k], updated: now, locked: rd.locked[k] }));
  }

  // 당번표가 바뀐 뒤, 더는 성립하지 않는 '대기 중' 요청을 '당번이 바뀌어 처리되지 않음(stale)'으로 정리한다.
  // 정리에 실패해도 화면은 성립하는 요청만 보여 주므로 안전하다(기록을 깨끗이 남기기 위한 작업).
  async function sweep() {
    try {
      const ms = await getDocs(col('months'));
      const dm = {}; ms.forEach((d) => { dm[d.id] = (d.data() || {}).duties || {}; });
      const ps = await getDocs(query(col('requests'), where('status', '==', 'pending')));
      const now = Date.now(), jobs = [];
      ps.forEach((d) => {
        const r = d.data();
        let ok;
        if (r.type === 'open') {
          const f = (dm[r.month] || {})[r.fromDay];
          ok = !!f && f[r.fromJ] === r.fromName;
        } else {
          const tm = r.toMonth || r.month;
          ok = C.swapX(dm, { month: r.month, day: r.fromDay, j: r.fromJ, name: r.fromName }, { month: tm, day: r.toDay, j: r.toJ, name: r.toName }).ok;
        }
        if (!ok) jobs.push(updateDoc(d.ref, { status: 'stale', resolvedAt: now }));
      });
      await Promise.all(jobs);
    } catch (e) { /* 정리 실패는 무시 */ }
  }
  const after = (p) => p.then((res) => { return sweep().then(() => res, () => res); });

  return {
    setPin: async (pin) => { h = await C.hashPin(pin); },
    subscribeMonths: (cb, err) => onSnapshot(col('months'), (s) => {
      const o = {}; s.forEach((d) => { o[d.id] = d.data(); }); cb(o);
    }, err),
    subscribeRequests: (cb, err) => onSnapshot(query(col('requests'), orderBy('at', 'desc'), limit(300)), (s) => {
      const o = []; s.forEach((d) => { const v = d.data(); v.id = d.id; o.push(v); }); cb(o);
    }, err),
    subscribeLog: (cb, err) => onSnapshot(query(col('log'), orderBy('at', 'desc'), limit(200)), (s) => {
      const o = []; s.forEach((d) => { const v = d.data(); v.id = d.id; o.push(v); }); cb(o);
    }, err),
    // 당번 확인 기록 (새 컬렉션 acks, 기존 데이터는 건드리지 않음)
    setAck: (month, day, name) => setDoc(ref('acks', month + '_' + day + '_' + name), { month: month, day: Number(day), name: name, at: Date.now() }),
    subscribeAcks: (cb, err) => onSnapshot(query(col('acks'), orderBy('at', 'desc'), limit(400)), (s) => {
      const o = []; s.forEach((d) => { const v = d.data(); v.id = d.id; o.push(v); }); cb(o);
    }, err),
    // 회원 명단 (문서 하나: meta/roster). 없으면 앱이 당번표 이름으로 대신함
    subscribeRoster: (cb, err) => onSnapshot(ref('meta', 'roster'), (s) => { cb(s.exists() ? s.data() : null); }, err),
    setRoster: (names, paused) => setDoc(ref('meta', 'roster'), { names: names, paused: paused, updated: Date.now() }),
    // 클럽 공지 (삭제 없이 '내리기'로 숨김)
    subscribeNotices: (cb, err) => onSnapshot(query(col('notices'), orderBy('at', 'desc'), limit(60)), (s) => {
      const o = []; s.forEach((d) => { const v = d.data(); v.id = d.id; o.push(v); }); cb(o);
    }, err),
    addNotice: (n) => addDoc(col('notices'), { title: n.title || '', body: n.body, pinned: !!n.pinned, hidden: false, at: Date.now() }),
    updateNotice: (id, patch) => updateDoc(ref('notices', id), patch),
    createRequest: (r) => addDoc(col('requests'), Object.assign({}, r, { status: 'pending', at: Date.now() })),
    setRequestStatus: (id, status) => updateDoc(ref('requests', id), { status: status, resolvedAt: Date.now() }),

    acceptRequest: (id) => after(runTransaction(db, async (tx) => {
      const rRef = ref('requests', id);
      const rs = await tx.get(rRef);
      if (!rs.exists()) return { ok: false, reason: 'gone' };
      const r = rs.data();
      if (r.status !== 'pending') return { ok: false, reason: 'done' };
      const tm = r.toMonth || r.month;
      const rd = await readMonths(tx, [r.month, tm]);
      if (rd.locked[r.month] || rd.locked[tm]) return { ok: false, reason: 'locked' };
      const a = slot(r.fromDay, r.fromJ, r.fromName), b = slot(r.toDay, r.toJ, r.toName);
      a.month = r.month; b.month = tm;
      const res = C.swapX(rd.dm, a, b);
      const now = Date.now();
      if (!res.ok) { tx.update(rRef, { status: 'stale', resolvedAt: now }); return { ok: false, reason: 'stale' }; }
      writeMonths(tx, rd, res.months, now);
      tx.update(rRef, { status: 'accepted', resolvedAt: now });
      tx.set(doc(col('log')), logDoc(now, a, b, r.toName + ' 수락'));
      return { ok: true };
    })),

    swapSlots: (a, b, by) => after(runTransaction(db, async (tx) => {
      const rd = await readMonths(tx, [a.month, b.month]);
      const res = C.swapX(rd.dm, a, b);
      if (!res.ok) return { ok: false, reason: 'stale' };
      const now = Date.now();
      writeMonths(tx, rd, res.months, now);
      tx.set(doc(col('log')), logDoc(now, a, b, by || '총무'));
      return { ok: true };
    })),

    undoSwap: (logId) => after(runTransaction(db, async (tx) => {
      const lRef = ref('log', logId);
      const ls = await tx.get(lRef);
      if (!ls.exists()) return { ok: false, reason: 'gone' };
      const l = ls.data();
      if (l.undone || l.kind !== 'swap') return { ok: false, reason: 'done' };
      const am = l.a.month || l.month, bm = l.b.month || l.month2 || l.month;
      const rd = await readMonths(tx, [am, bm]);
      const res = C.swapX(rd.dm, { month: am, day: l.a.day, j: l.a.j, name: l.b.name }, { month: bm, day: l.b.day, j: l.b.j, name: l.a.name });
      if (!res.ok) return { ok: false, reason: 'stale' };
      const now = Date.now();
      writeMonths(tx, rd, res.months, now);
      tx.update(lRef, { undone: true });
      tx.set(doc(col('log')), {
        at: now, month: am, month2: bm !== am ? bm : null, kind: 'undo', by: '총무', undone: true, a: l.a, b: l.b,
        text: C.md(now) + ' (되돌림) ' + C.label(am, l.a.day) + ' ' + l.a.name + ' ⇄ ' + C.label(bm, l.b.day) + ' ' + l.b.name
      });
      return { ok: true };
    })),

    setDuty: (month, day, names) => after(runTransaction(db, async (tx) => {
      const mRef = ref('months', month);
      const ms = await tx.get(mRef);
      const duties = ms.exists() ? JSON.parse(JSON.stringify(ms.data().duties || {})) : {};
      if (names) duties[day] = names; else delete duties[day];
      tx.set(mRef, { duties: duties, updated: Date.now(), locked: !!(ms.exists() && ms.data().locked) });
      return { ok: true };
    })),

    setMonth: (month, duties) => after(runTransaction(db, async (tx) => {
      const mRef = ref('months', month);
      const ms = await tx.get(mRef);
      tx.set(mRef, { duties: duties, updated: Date.now(), locked: !!(ms.exists() && ms.data().locked) });
      return { ok: true };
    })),

    // 달별 교환 마감(회원 수락만 막음. 총무 직접 교환·입력은 그대로 가능)
    setLock: (month, locked) => runTransaction(db, async (tx) => {
      const mRef = ref('months', month);
      const ms = await tx.get(mRef);
      if (!ms.exists()) return { ok: false };
      tx.set(mRef, { duties: ms.data().duties || {}, updated: ms.data().updated || Date.now(), locked: !!locked });
      return { ok: true };
    }),

    // 공개 요청: 내 당번 하나를 내놓고 조건을 건다
    createOpenRequest: (r) => addDoc(col('requests'), Object.assign({}, r, { type: 'open', status: 'pending', at: Date.now() })),
    acceptOpen: (id, acc) => after(runTransaction(db, async (tx) => {
      const rRef = ref('requests', id);
      const rs = await tx.get(rRef);
      if (!rs.exists()) return { ok: false, reason: 'gone' };
      const r = rs.data();
      if (r.status !== 'pending' || r.type !== 'open') return { ok: false, reason: 'done' };
      const am = acc.month || r.month;
      const rd = await readMonths(tx, [r.month, am]);
      const res = C.canAcceptOpen(rd.dm, r, acc, (k) => !!rd.locked[k]);
      if (!res.ok) return { ok: false, reason: res.reason || 'stale' };
      const now = Date.now();
      const a = slot(r.fromDay, r.fromJ, r.fromName), b = slot(acc.day, acc.j, acc.name);
      a.month = r.month; b.month = am;
      writeMonths(tx, rd, res.months, now);
      tx.update(rRef, { status: 'accepted', resolvedAt: now, toName: acc.name, toDay: acc.day, toJ: acc.j, toMonth: am });
      tx.set(doc(col('log')), logDoc(now, a, b, acc.name + ' 수락(공개 요청)'));
      return { ok: true };
    }))
  };
}
