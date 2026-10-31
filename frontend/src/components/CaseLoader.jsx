import { useEffect, useState } from 'react';
import { useStore } from '../store.js';

let cache = null;

export function useTestcases() {
  const call = useStore((s) => s.call);
  const [cases, setCases] = useState(cache ?? []);
  useEffect(() => {
    if (cache) return;
    call('/testcases').then((c) => setCases((cache = c))).catch(() => {});
  }, [call]);
  return cases;
}

export default function CaseLoader({ onLoad }) {
  const cases = useTestcases();
  const caseId = useStore((s) => s.caseId);
  const loadCase = useStore((s) => s.loadCase);
  return (
    <label className="case-loader">
      <span>Load test case</span>
      <select
        value={caseId ?? ''}
        disabled={!cases.length}
        onChange={(e) => {
          const tc = cases.find((c) => c.id === e.target.value);
          if (!tc) return;
          loadCase(tc);
          onLoad?.(tc);
        }}
      >
        <option value="" disabled>
          {cases.length ? 'Your own setup' : 'Needs the server'}
        </option>
        {cases.map((c) => (
          <option key={c.id} value={c.id}>
            {c.id}: {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
