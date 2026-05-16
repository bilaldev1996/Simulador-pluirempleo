import { ScenarioResult } from '../types';

type Props = {
  result: ScenarioResult;
};

export default function GlobalSummary({ result }: Props) {
  const cards = [
    { label: 'Bruto anual', value: formatMoney(result.grossAnnual) },
    { label: 'SS anual', value: formatMoney(result.ssAnnual) },
    { label: 'IRPF teórico', value: formatMoney(result.irpfTheoreticalAnnual) },
    { label: 'IRPF retenido', value: formatMoney(result.irpfWithheldAnnual) },
    { label: 'Neto anual', value: formatMoney(result.netAnnual) },
    { label: 'IRPF efectivo', value: `${result.effectiveIrpfRate.toFixed(1)}%` },
    { label: 'Sorpresa fiscal', value: formatMoney(result.surpriseTax) },
  ];

  return (
    <section className="summary-shell card">
      <div className="summary-top">
        <div>
          <p className="eyebrow">Resumen global</p>
          <h2>Tu foto fiscal en pluriempleo</h2>
        </div>
        <div className="pill">{result.jobs.length} trabajos · {result.overlapMonths} meses solapados</div>
      </div>
      <div className="summary-grid">
        {cards.map((card) => (
          <article key={card.label} className="mini-stat">
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}
