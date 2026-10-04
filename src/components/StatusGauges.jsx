import Gauge from './Gauge.jsx';
import { G, foodSols, WORLDS } from '../engine/engine.js';

// The full dashboard: 4 supplies + 3 crew meters (+ base status chips).
export default function StatusGauges({ s, before }) {
  const t = WORLDS[s.worldId].turnLabel.toLowerCase();
  const d = (k) => (before ? s[k] - before[k] : undefined);
  return (
    <>
      <h3 className="section-title">Supplies</h3>
      <div className="gauges">
        <Gauge icon="🫁" label="Oxygen" value={s.o2} max={G.o2TankKg} text={`${s.o2.toFixed(1)} kg`} delta={d('o2')} />
        <Gauge icon="💧" label="Water" value={s.water} max={G.waterTankKg} text={`${Math.round(s.water)} kg`} delta={d('water')} warnAt={0.25} />
        <Gauge icon="🍲" label="Food" value={foodSols(s.food)} max={15} text={`${foodSols(s.food).toFixed(1)} ${t}s`} delta={before ? foodSols(s.food) - foodSols(before.food) : undefined} warnAt={0.3} badAt={0.2} />
        <Gauge icon="🔋" label="Battery" value={s.battery} max={G.batteryCapacityKwh} text={`${Math.round(s.battery)} / ${G.batteryCapacityKwh} kWh`} delta={d('battery')} />
      </div>
      <h3 className="section-title">Crew</h3>
      <div className="gauges">
        <Gauge icon="❤" label="Health" value={s.health} max={100} text={`${Math.round(s.health)}%`} delta={d('health')} warnAt={0.5} badAt={0.25} />
        <Gauge icon="☢" label="Radiation dose" value={s.dose} max={G.doseLimitMsv} good="low" text={`${s.dose.toFixed(1)} / ${G.doseLimitMsv} mSv`} delta={d('dose')} warnAt={0.3} badAt={0.12} />
        <Gauge icon="😊" label="Morale" value={s.morale} max={100} text={`${Math.round(s.morale)}%`} delta={d('morale')} warnAt={0.4} badAt={0.25} />
      </div>
      <div className="chips">
        <span className="chip">🛡 Shielding {Math.round(s.shield)}%</span>
        <span className="chip">🌱 Greenhouse {Math.round(s.maturity * 100)}% grown</span>
        <span className="chip">🔩 Spare parts {s.spares}</span>
        <span className="chip">🔬 Science {Math.round(s.science)}</span>
        {s.broken && <span className="chip chip-bad">🔧 Life support broken</span>}
        {s.leak && <span className="chip chip-bad">☄ Air leak</span>}
      </div>
    </>
  );
}
