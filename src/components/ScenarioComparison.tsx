import { ScenarioResult } from '../types';

type Props = {
  baseline: ScenarioResult;
  current: ScenarioResult;
};

export default function ScenarioComparison({ baseline, current }: Props) {
  const delta = current.netAnnual - baseline.netAnnual;

  return (
    <section className="card">
      <div className="section-title">
        <div>
          <p className="eyebrow">Comparador</p>
          <h2>Con 1 trabajo vs escenario actual</h2>
        </div>
      </div>
      <div className="compare-grid">
        <article>
          <span>Base</span>
          <strong>{money(baseline.netAnnual)}</strong>
        </article>
        <article>
          <span>Actual</span>
          <strong>{money(current.netAnnual)}</strong>
        </article>
        <article>
          <span>Diferencia</span>
          <strong className={delta >= 0 ? 'good' : 'bad'}>{money(delta)}</strong>
        </article>
      </div>
    </section>
  );
}

function money(value: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}
