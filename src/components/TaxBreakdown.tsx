import { ScenarioResult } from '../types';

type Props = {
  result: ScenarioResult;
  mode: string;
  onModeChange: (mode: string) => void;
  irpfBias: number;
  onBiasChange: (value: number) => void;
};

export default function TaxBreakdown({ result, mode, onModeChange, irpfBias, onBiasChange }: Props) {
  return (
    <section className="card">
      <div className="section-title">
        <div>
          <p className="eyebrow">Motor fiscal</p>
          <h2>Flujo real de nómina</h2>
        </div>
        <div className="inline-controls">
          <select value={mode} onChange={(e) => onModeChange(e.target.value)}>
            <option value="optimista">Optimista</option>
            <option value="realista">Realista</option>
            <option value="conservador">Conservador</option>
          </select>
          <label className="slider-label">
            Ajuste pluriempleo
            <input type="range" min="0" max="10" step="0.5" value={irpfBias} onChange={(e) => onBiasChange(Number(e.target.value))} />
          </label>
        </div>
      </div>

      <div className="tax-bars">
        <div className="tax-bar"><span>1. Bruto</span><strong>{money(result.grossAnnual)}</strong></div>
        <div className="tax-bar"><span>2. SS</span><strong>{money(result.ssAnnual)}</strong></div>
        <div className="tax-bar"><span>3. Base IRPF</span><strong>{money(result.taxableBaseAnnual)}</strong></div>
        <div className="tax-bar"><span>4. Base liquidable</span><strong>{money(result.liquidBaseAnnual)}</strong></div>
        <div className="tax-bar"><span>5. IRPF teórico</span><strong>{money(result.irpfTheoreticalAnnual)}</strong></div>
        <div className="tax-bar"><span>6. IRPF retenido</span><strong>{money(result.irpfWithheldAnnual)}</strong></div>
      </div>
      <p className="muted">Segundo pagador: {money(result.secondPayerAnnual)} · Ajuste configurado: +{irpfBias.toFixed(1)}% · Retención media: {result.averageWithholdingRate.toFixed(1)}% · Regularización estimada: {money(result.surpriseTax)}</p>
    </section>
  );
}

function money(value: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}
