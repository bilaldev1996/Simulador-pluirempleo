import { JobResult } from '../types';

type Props = {
  job: JobResult;
};

export default function JobCard({ job }: Props) {
  return (
    <article className="card job-card">
      <div className="card-header compact">
        <div>
          <p className="eyebrow">{job.contractType}</p>
          <h3>{job.company}</h3>
        </div>
        <span className="pill">{job.withholdingRate.toFixed(1)}% retención</span>
      </div>

      <div className="job-metrics">
        <div><span>Bruto anual</span><strong>{money(job.annualGross)}</strong></div>
        <div><span>SS</span><strong>{money(job.ss)}</strong></div>
        <div><span>Base liquidable</span><strong>{money(job.liquidBase)}</strong></div>
        <div><span>IRPF teórico</span><strong>{money(job.irpfTheoreticalAnnual)}</strong></div>
        <div><span>IRPF retenido</span><strong>{money(job.irpfWithheldAnnual)}</strong></div>
        <div><span>Neto anual</span><strong>{money(job.netAnnual)}</strong></div>
        <div><span>Neto medio</span><strong>{money(job.netMonthlyAverage)}</strong></div>
        <div><span>Meses activos</span><strong>{job.activeMonths}</strong></div>
      </div>
    </article>
  );
}

function money(value: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}
