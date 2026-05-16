import { ScenarioResult } from '../types';

type Props = {
  result: ScenarioResult;
};

export default function TaxBreakdown({ result }: Props) {
  return (
    <section className="card">
      <div className="section-title">
        <div>
          <p className="eyebrow">Motor fiscal</p>
          <h2>Flujo fiscal global</h2>
        </div>
      </div>

      <div className="tax-bars">
        <div className="tax-bar"><span>1. Bruto total anual</span><strong>{money(result.grossAnnual)}</strong></div>
        <div className="tax-bar"><span>2. SS total</span><strong>{money(result.ssAnnual)}</strong></div>
        <div className="tax-bar"><span>3. Base IRPF global</span><strong>{money(result.baseIrpfGlobalAnnual)}</strong></div>
        <div className="tax-bar"><span>4. Mínimo personal</span><strong>{money(result.personalMinimumAnnual)}</strong></div>
        <div className="tax-bar"><span>5. Base liquidable global</span><strong>{money(result.liquidBaseAnnual)}</strong></div>
        <div className="tax-bar"><span>6. IRPF real</span><strong>{money(result.irpfRealAnnual)}</strong></div>
      </div>
      <p className="muted">Segundo pagador: {money(result.secondPayerAnnual)} · IRPF retenido total: {money(result.irpfWithheldAnnual)} · Regularización estimada: {money(result.regularizationEstimated)}</p>
    </section>
  );
}

function money(value: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}
