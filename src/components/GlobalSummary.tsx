import { ScenarioResult } from '../types';

type Props = {
  result: ScenarioResult;
};

export default function GlobalSummary({ result }: Props) {
  const cards = [
    { label: 'Bruto total anual', value: formatMoney(result.grossAnnual) },
    { label: 'SS total', value: formatMoney(result.ssAnnual) },
    { label: 'Base IRPF global', value: formatMoney(result.baseIrpfGlobalAnnual) },
    { label: 'Mínimo personal', value: formatMoney(result.personalMinimumAnnual) },
    { label: 'Base liquidable global', value: formatMoney(result.liquidBaseAnnual) },
    { label: 'IRPF real', value: formatMoney(result.irpfRealAnnual) },
    { label: 'IRPF retenido total', value: formatMoney(result.irpfWithheldAnnual) },
    { label: 'Neto cobrado', value: formatMoney(result.netPaidAnnual) },
    { label: 'Neto real tras declaración', value: formatMoney(result.netAfterSettlementAnnual) },
    { label: 'Regularización estimada', value: formatMoney(result.regularizationEstimated) },
  ];

  return (
    <section className="summary-shell card">
      <div className="summary-top">
        <div>
          <p className="eyebrow">Resumen global</p>
          <h2>Tu foto fiscal en pluriempleo</h2>
          <p className="muted">Las empresas calculan retenciones de forma independiente. Hacienda recalcula el IRPF sobre el total anual combinado.</p>
          <p className="muted">La diferencia entre IRPF retenido e IRPF real puede generar pago o devolución en la declaración.</p>
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
