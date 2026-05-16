import { useEffect, useMemo, useState } from 'react';
import GlobalSummary from './components/GlobalSummary';
import JobForm from './components/JobForm';
import JobList from './components/JobList';
import MonthlyTimelineChart from './components/MonthlyTimelineChart';
import ScenarioComparison from './components/ScenarioComparison';
import TaxBreakdown from './components/TaxBreakdown';
import { defaultJob, simulateMultiJobScenario } from './utils/taxCalculator';
import { JobInput } from './types';

const STORAGE_KEY = 'pluriempleo-irpf-scenarios';

export default function App() {
  const [jobs, setJobs] = useState<JobInput[]>(() => [defaultJob('job-1')]);
  const [saved, setSaved] = useState<string[]>([]);
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) setSaved(JSON.parse(raw));
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }, [saved]);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
  }, [darkMode]);

  const result = useMemo(() => simulateMultiJobScenario(jobs), [jobs]);
  const baseline = useMemo(() => simulateMultiJobScenario([jobs[0]]), [jobs]);

  const exportScenario = () => {
    const blob = new Blob([JSON.stringify({ jobs, result }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'simulacion-pluriempleo.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveScenario = () => {
    setSaved((current) => [`${new Date().toLocaleString('es-ES')} · ${jobs.length} trabajos · ${result.netAnnual.toFixed(0)}€ netos`, ...current].slice(0, 8));
  };

  const updateJob = (index: number, job: JobInput) => setJobs((current) => current.map((item, i) => (i === index ? job : item)));
  const removeJob = (index: number) => setJobs((current) => current.filter((_, i) => i !== index));
  const addJob = () => setJobs((current) => [...current, defaultJob(`job-${Date.now()}`, current.length)]);

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Simulador de Pluriempleo e IRPF España</p>
          <h1>Calcula tu nómina real: bruto, SS, base IRPF, tramos y retención final.</h1>
          <p className="hero-copy">Cada empresa estima su retención como si fuera única; Hacienda liquida sobre el total anual.</p>
        </div>
        <div className="hero-actions">
          <button className="primary-button" onClick={addJob} type="button">Añadir trabajo</button>
          <button className="ghost-button" onClick={saveScenario} type="button">Guardar escenario</button>
          <button className="ghost-button" onClick={exportScenario} type="button">Exportar JSON</button>
          <button className="ghost-button" onClick={() => setDarkMode((value) => !value)} type="button">
            {darkMode ? 'Modo claro' : 'Modo oscuro'}
          </button>
        </div>
      </header>

      <main className="layout">
        <section className="stack">
          <GlobalSummary result={result} />
          <TaxBreakdown result={result} />
          <MonthlyTimelineChart points={result.monthlyTimeline} />
          <ScenarioComparison baseline={baseline} current={result} />
        </section>

        <aside className="stack">
          <section className="section-title">
            <div>
              <p className="eyebrow">Trabajos</p>
              <h2>Configura tu pluriempleo</h2>
            </div>
          </section>

          {jobs.map((job, index) => (
            <JobForm
              key={job.id}
              job={job}
              onChange={(next) => updateJob(index, next)}
              onRemove={() => removeJob(index)}
              canRemove={jobs.length > 1}
            />
          ))}

          <JobList jobs={result.jobs} />

          <section className="card">
            <div className="section-title">
              <div>
                <p className="eyebrow">Escenarios guardados</p>
                <h2>Historial local</h2>
              </div>
            </div>
            <div className="saved-list">
              {saved.length ? saved.map((item) => <div key={item} className="saved-item">{item}</div>) : <p className="muted">No hay escenarios guardados aún.</p>}
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}
