import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import tc1 from '../tc1.json';
import { capacities, units, totals } from '../power.js';
import { useStore, reducedMotion } from '../store.js';
import House from '../components/House.jsx';
import InverterPanel from '../components/InverterPanel.jsx';

gsap.registerPlugin(ScrollTrigger);

const COPY = [
  { h: "It's 8 pm. Everything's on.", p: 'Fans turning, the TV on in the hall, the fridge humming in the kitchen.' },
  { h: 'The power just went out.', p: 'Your inverter can carry some of this, not all of it.' },
  { h: 'Two ways it goes wrong.', p: 'Switch on too much and it trips. Switch on the wrong things and the battery dies before the power comes back.' },
  { h: 'Ujala decides.', p: "Tell us what you have. Ujala works out what to keep on, and for how long." },
];

function Battery() {
  return (
    <svg viewBox="0 0 120 200" className="battery" aria-hidden="true">
      <rect x="40" y="4" width="40" height="12" rx="3" className="cap" />
      <rect x="8" y="16" width="104" height="178" rx="10" className="shell" />
      <rect x="18" y="26" width="84" height="158" rx="5" className="charge" />
    </svg>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const stage = useRef(null);
  const [scene, setScene] = useState(0);
  const [reveal, setReveal] = useState(0);
  const prevScene = useRef(0);

  const list = useMemo(() => units(tc1.appliances, tc1.setup.outageHours), []);
  const caps = useMemo(() => capacities(tc1.setup), []);
  const allOn = useMemo(() => Object.fromEntries(list.map((u) => [u.id, true])), [list]);
  // Plan units in room order so the house comes back one room at a time.
  const planOrder = useMemo(() => list.filter((u) => tc1.selectedIds.includes(u.id)), [list]);

  useLayoutEffect(() => {
    const st = ScrollTrigger.create({
      trigger: '.story',
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        const p = self.progress;
        setScene(Math.min(3, Math.floor(p * 4)));
        setReveal(Math.max(0, Math.min(1, (p - 0.78) / 0.16)));
      },
    });
    return () => st.kill();
  }, []);

  // The one orchestrated moment: lights stutter, then the whole page drops into night.
  useEffect(() => {
    const el = stage.current;
    const from = prevScene.current;
    prevScene.current = scene;
    if (scene >= 1 && from === 0) {
      if (reducedMotion()) {
        gsap.set(el, { '--lamp': 0, '--sky': 0 });
        return;
      }
      gsap
        .timeline()
        .to(el, { '--lamp': 0.15, duration: 0.05 })
        .to(el, { '--lamp': 0.9, duration: 0.05 })
        .to(el, { '--lamp': 0.3, duration: 0.08, delay: 0.12 })
        .to(el, { '--lamp': 0.7, duration: 0.04 })
        .to(el, { '--lamp': 0, duration: 0.06, delay: 0.05 })
        .to(el, { '--sky': 0, duration: 0.6, ease: 'power2.in' }, '<');
    } else if (scene === 0 && from >= 1) {
      gsap.to(el, { '--lamp': 1, '--sky': 1, duration: reducedMotion() ? 0 : 0.5 });
    }
  }, [scene]);

  const shown = Math.round(reveal * planOrder.length);
  const planOn = Object.fromEntries(planOrder.slice(0, shown).map((u) => [u.id, true]));
  const houseOn = scene <= 1 ? allOn : planOn;
  const panelT = totals(list, scene === 3 ? planOn : scene === 0 ? allOn : {}, caps, tc1.setup.outageHours);

  const startPlanning = () => {
    useStore.getState().loadCase(tc1);
    navigate('/planner');
  };

  return (
    <main className="landing">
      <section className="story">
        <div className={`stage scene-${scene}`} ref={stage} style={{ '--lamp': 1, '--sky': 1 }}>
          <div className="copy" key={scene}>
            <h1>{COPY[scene].h}</h1>
            <p>{COPY[scene].p}</p>
            {scene === 3 && (
              <div className="cta">
                <button className="btn primary" onClick={startPlanning}>Plan my backup</button>
                <Link className="btn ghost" to="/lab">See how it decides</Link>
              </div>
            )}
            {scene === 0 && <p className="scroll-hint">Scroll</p>}
          </div>

          <div className="visual">
            {scene === 2 ? (
              <div className="wrongs">
                <figure className="wrong">
                  <div className="mini-house">
                    <House units={list} on={allOn} tripped />
                  </div>
                  <figcaption>
                    <b>Overload.</b> Everything on at once is {Math.round(totals(list, allOn, caps, 4).load)} W on a {caps.maxW} W inverter. It trips and the
                    house goes black.
                  </figcaption>
                </figure>
                <figure className="wrong">
                  <div className="drain">
                    <Battery />
                    <ul>
                      <li className="on">TV, on</li>
                      <li className="on">Fan (study), on</li>
                      <li className="on">Fan (hall), on</li>
                      <li>Fridge, off</li>
                    </ul>
                  </div>
                  <figcaption>
                    <b>Early drain.</b> The battery goes to the TV and spare fans while the fridge sits off, and it is empty long before the power returns.
                  </figcaption>
                </figure>
              </div>
            ) : (
              <div className={`main-house ${scene === 1 ? 'blackout' : ''}`}>
                <House units={list} on={houseOn} />
              </div>
            )}
            {scene >= 1 && scene !== 2 && (
              <div className="landing-panel">
                <InverterPanel t={panelT} caps={caps} compact />
              </div>
            )}
          </div>
        </div>
      </section>
      <footer className="landing-foot">
        <p>Ujala plans with greedy, dynamic programming and branch and bound. A DSA mini project.</p>
        <Link to="/lab">Open the algorithm lab</Link>
      </footer>
    </main>
  );
}
