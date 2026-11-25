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

  function logDoc(now, month, a, b, by) {
    return {
      at: now, month: month, kind: 'swap', by: by, undone: false, a: a, b: b,
      text: C.md(now) + ' ' + C.label(month, a.day) + ' ' + a.name + ' ⇄ ' + C.label(month, b.day) + ' ' + b.name
    };
  }

  return {
    setPin: async (pin) => { h = await C.hashPin(pin); },
    subscribeMonths: (cb, err) => onSnapshot(col('months'), (s) => {
      const o = {}; s.forEach((d) => { o[d.id] = d.data(); }); cb(o);
    }, err),
    subscribeRequests: (cb, err) => onSnapshot(query(col('requests'), orderBy('at', 'desc'), limit(80)), (s) => {
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
      const mRef = ref('months', r.month);
      const ms = await tx.get(mRef);
      const duties = ms.exists() ? (ms.data().duties || {}) : {};
      const a = slot(r.fromDay, r.fromJ, r.fromName), b = slot(r.toDay, r.toJ, r.toName);
      const res = C.swapDuties(duties, a, b);
      const now = Date.now();
      if (!res.ok) { tx.update(rRef, { status: 'stale', resolvedAt: now }); return { ok: false, reason: 'stale' }; }
      tx.set(mRef, { duties: res.duties, updated: now });
      tx.update(rRef, { status: 'accepted', resolvedAt: now });
      tx.set(doc(col('log')), logDoc(now, r.month, a, b, r.toName + ' 수락'));
      return { ok: true };
    }),

    swapSlots: (month, a, b, by) => runTransaction(db, async (tx) => {
      const mRef = ref('months', month);
      const ms = await tx.get(mRef);
      const duties = ms.exists() ? (ms.data().duties || {}) : {};
      const res = C.swapDuties(duties, a, b);
      if (!res.ok) return { ok: false, reason: 'stale' };
      const now = Date.now();
      tx.set(mRef, { duties: res.duties, updated: now });
      tx.set(doc(col('log')), logDoc(now, month, a, b, by || '총무'));
      return { ok: true };
    }),

    undoSwap: (logId) => runTransaction(db, async (tx) => {
      const lRef = ref('log', logId);
      const ls = await tx.get(lRef);
      if (!ls.exists()) return { ok: false, reason: 'gone' };
      const l = ls.data();
      if (l.undone || l.kind !== 'swap') return { ok: false, reason: 'done' };
      const mRef = ref('months', l.month);
      const ms = await tx.get(mRef);
      const duties = ms.exists() ? (ms.data().duties || {}) : {};
      const res = C.swapDuties(duties, slot(l.a.day, l.a.j, l.b.name), slot(l.b.day, l.b.j, l.a.name));
      if (!res.ok) return { ok: false, reason: 'stale' };
      const now = Date.now();
      tx.set(mRef, { duties: res.duties, updated: now });
      tx.update(lRef, { undone: true });
      tx.set(doc(col('log')), {
        at: now, month: l.month, kind: 'undo', by: '총무', undone: true, a: l.a, b: l.b,
        text: C.md(now) + ' (되돌림) ' + C.label(l.month, l.a.day) + ' ' + l.a.name + ' ⇄ ' + C.label(l.month, l.b.day) + ' ' + l.b.name
      });
      return { ok: true };
    }),

    setDuty: (month, day, names) => runTransaction(db, async (tx) => {
      const mRef = ref('months', month);
      const ms = await tx.get(mRef);
      const duties = ms.exists() ? JSON.parse(JSON.stringify(ms.data().duties || {})) : {};
      if (names) duties[day] = names; else delete duties[day];
      tx.set(mRef, { duties: duties, updated: Date.now() });
      return { ok: true };
    }),

    setMonth: (month, duties) => runTransaction(db, async (tx) => {
      tx.set(ref('months', month), { duties: duties, updated: Date.now() });
      return { ok: true };
    })
  };
}
