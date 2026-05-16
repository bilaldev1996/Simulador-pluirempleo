import { MonthPoint } from '../types';

type Props = {
  points: MonthPoint[];
};

export default function MonthlyTimelineChart({ points }: Props) {
  const max = Math.max(...points.map((point) => Math.max(point.gross, point.net)), 1);

  return (
    <section className="card">
      <div className="section-title">
        <div>
          <p className="eyebrow">Timeline mensual</p>
          <h2>Ingresos solapados por mes</h2>
        </div>
      </div>

      <div className="timeline-chart">
        {points.map((point) => (
          <div className="timeline-bar" key={point.month}>
            <div className="bars">
              <span className="bar gross" style={{ height: `${(point.gross / max) * 100}%` }} title={`Bruto ${point.month}`} />
              <span className="bar net" style={{ height: `${(point.net / max) * 100}%` }} title={`Neto ${point.month}`} />
            </div>
            <small>{point.month}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
