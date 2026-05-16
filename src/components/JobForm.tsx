import { ChangeEvent } from 'react';
import { ContractType, JobInput } from '../types';

type Props = {
  job: JobInput;
  onChange: (job: JobInput) => void;
  onRemove: () => void;
  canRemove: boolean;
};

export default function JobForm({ job, onChange, onRemove, canRemove }: Props) {
  const setField = <K extends keyof JobInput>(key: K, value: JobInput[K]) => onChange({ ...job, [key]: value });

  const handleNumber = (key: keyof JobInput) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setField(key as keyof JobInput, Number(event.target.value) as JobInput[typeof key]);
  };

  return (
    <section className="card job-form">
      <div className="card-header">
        <div>
          <p className="eyebrow">Trabajo</p>
          <h3>{job.company || 'Nuevo trabajo'}</h3>
        </div>
        <button className="ghost-button" onClick={onRemove} disabled={!canRemove} type="button">
          Eliminar
        </button>
      </div>

      <div className="form-grid">
        <label>
          Retención automática AEAT
          <input
            type="checkbox"
            checked={job.withholdingMode === 'auto'}
            onChange={(e) => setField('withholdingMode', e.target.checked ? 'auto' : 'manual')}
          />
        </label>

        <label>
          Empresa
          <input value={job.company} onChange={(e) => setField('company', e.target.value)} placeholder="Nombre de la empresa" />
        </label>

        <label>
          Contrato
          <select value={job.contractType} onChange={(e) => setField('contractType', e.target.value as ContractType)}>
            <option value="indefinido">Indefinido</option>
            <option value="temporal">Temporal</option>
            <option value="fijo-discontinuo">Fijo discontinuo</option>
          </select>
        </label>

        <label>
          Bruto mensual (€)
          <input type="number" min="0" step="50" value={job.monthlyGross} onChange={handleNumber('monthlyGross')} />
        </label>

        <label>
          Pagas
          <select value={job.payPeriods} onChange={handleNumber('payPeriods')}>
            <option value={12}>12</option>
            <option value={14}>14</option>
            <option value={0}>Personalizada</option>
          </select>
        </label>

        <label>
          Retención manual (%)
          <input
            type="number"
            min="3"
            max="60"
            step="0.5"
            value={job.irpfRate}
            onChange={handleNumber('irpfRate')}
            disabled={job.withholdingMode === 'auto'}
          />
        </label>

        <label>
          Pagas personalizadas
          <input type="number" min="1" max="24" step="1" value={job.customPayPeriods ?? 12} onChange={handleNumber('customPayPeriods')} />
        </label>

        <label>
          Mes inicio
          <input type="number" min="1" max="12" step="1" value={job.startMonth} onChange={handleNumber('startMonth')} />
        </label>

        <label>
          Mes fin
          <input type="number" min="1" max="12" step="1" value={job.endMonth} onChange={handleNumber('endMonth')} />
        </label>
      </div>
      <p className="muted">{job.withholdingMode === 'auto' ? 'La empresa calcula una retención simplificada según el salario anualizado.' : 'La empresa aplica la retención manual indicada por el usuario.'}</p>
    </section>
  );
}
