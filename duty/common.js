import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getFirestore, collection, doc, onSnapshot, runTransaction, addDoc, updateDoc, query, orderBy, limit }
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
    createRequest: (r) => addDoc(col('requests'), Object.assign({}, r, { status: 'pending', at: Date.now() })),
    setRequestStatus: (id, status) => updateDoc(ref('requests', id), { status: status, resolvedAt: Date.now() }),

    acceptRequest: (id) => runTransaction(db, async (tx) => {
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
    }),

    swapSlots: (a, b, by) => runTransaction(db, async (tx) => {
      const rd = await readMonths(tx, [a.month, b.month]);
      const res = C.swapX(rd.dm, a, b);
      if (!res.ok) return { ok: false, reason: 'stale' };
      const now = Date.now();
      writeMonths(tx, rd, res.months, now);
      tx.set(doc(col('log')), logDoc(now, a, b, by || '총무'));
      return { ok: true };
    }),

    undoSwap: (logId) => runTransaction(db, async (tx) => {
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
    }),

    setDuty: (month, day, names) => runTransaction(db, async (tx) => {
      const mRef = ref('months', month);
      const ms = await tx.get(mRef);
      const duties = ms.exists() ? JSON.parse(JSON.stringify(ms.data().duties || {})) : {};
      if (names) duties[day] = names; else delete duties[day];
      tx.set(mRef, { duties: duties, updated: Date.now(), locked: !!(ms.exists() && ms.data().locked) });
      return { ok: true };
    }),

    setMonth: (month, duties) => runTransaction(db, async (tx) => {
      const mRef = ref('months', month);
      const ms = await tx.get(mRef);
      tx.set(mRef, { duties: duties, updated: Date.now(), locked: !!(ms.exists() && ms.data().locked) });
      return { ok: true };
    }),

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
    acceptOpen: (id, acc) => runTransaction(db, async (tx) => {
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
    })
  };
}
