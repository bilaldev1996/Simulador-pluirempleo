import { JobResult } from '../types';
import JobCard from './JobCard';

type Props = {
  jobs: JobResult[];
};

export default function JobList({ jobs }: Props) {
  return (
    <section className="stack">
      <div className="section-title">
        <div>
          <p className="eyebrow">Detalle por empresa</p>
          <h2>Resultados individuales</h2>
        </div>
      </div>
      <div className="job-grid">
        {jobs.map((job) => <JobCard key={job.id} job={job} />)}
      </div>
    </section>
  );
}
