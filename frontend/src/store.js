import { create } from 'zustand';
import tc1 from './tc1.json';

export class Offline extends Error {}

const DEFAULTS = { powerFactor: 0.8, efficiency: 0.85, surgeTolerance: 1.5, batteryV: 12, batteryType: 'tubular', health: 100 };
let nextId = 1000;

async function request(path, body) {
  let res;
  try {
    res = await fetch(`/api${path}`, body === undefined ? undefined : {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Offline();
  }
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Offline(); // the dev proxy answers with an empty body when the backend is down
  }
  if (!res.ok) throw new Error(data.error ?? 'Something went wrong.');
  return data;
}

export const useStore = create((set, get) => ({
  setup: { ...DEFAULTS, ...tc1.setup },
  appliances: tc1.appliances,
  on: {},
  plan: null,
  staged: null,
  error: null,
  algorithm: 'bb-lc',
  caseId: 'TC1',
  offline: false,

  // Every backend call goes through here so the offline banner stays accurate.
  call: async (path, body) => {
    try {
      const data = await request(path, body);
      if (get().offline) set({ offline: false });
      return data;
    } catch (err) {
      if (err instanceof Offline) set({ offline: true });
      throw err;
    }
  },

  // Any change to the inputs makes the last plan stale.
  setSetup: (patch) => set((s) => ({ setup: { ...s.setup, ...patch }, plan: null, staged: null, error: null })),
  setAlgorithm: (algorithm) => set({ algorithm }),
  loadCase: (tc) =>
    set({
      setup: { ...DEFAULTS, ...tc.setup },
      appliances: tc.appliances.map((a, i) => ({ ...a, id: `a${i + 1}` })),
      on: {},
      plan: null,
      staged: null,
      error: null,
      caseId: tc.id,
    }),
  addAppliance: (a) =>
    set((s) => ({ appliances: [...s.appliances, { importance: 5, quantity: 1, ...a, id: `n${nextId++}` }], plan: null, staged: null, caseId: null })),
  updateAppliance: (id, patch) =>
    set((s) => ({ appliances: s.appliances.map((a) => (a.id === id ? { ...a, ...patch } : a)), plan: null, staged: null, caseId: null })),
  removeAppliance: (id) =>
    set((s) => ({ appliances: s.appliances.filter((a) => a.id !== id), plan: null, staged: null, caseId: null })),
  toggle: (unitId) => set((s) => ({ on: { ...s.on, [unitId]: !s.on[unitId] } })),
  setOn: (on) => set({ on }),
  setPlan: (plan) => set({ plan, error: null }),
  setStaged: (staged) => set({ staged }),
  setError: (error) => set({ error, plan: null }),
}));

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
