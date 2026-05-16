import { ContractType, JobInput, MonthPoint, ScenarioResult, SSBreakdown, TaxBreakdownResult, TaxMode } from '../types';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const PERSONAL_MINIMUM = 5550;

const IRPF_BRACKETS = [
  { upTo: 12450, rate: 0.19 },
  { upTo: 20200, rate: 0.24 },
  { upTo: 35200, rate: 0.30 },
  { upTo: 60000, rate: 0.37 },
  { upTo: 300000, rate: 0.45 },
  { upTo: Number.POSITIVE_INFINITY, rate: 0.47 },
];

const SS_RATES: Record<ContractType, { unemployment: number; mei: number }> = {
  indefinido: { unemployment: 0.0155, mei: 0.0012 },
  temporal: { unemployment: 0.016, mei: 0.0012 },
  'fijo-discontinuo': { unemployment: 0.016, mei: 0.0012 },
};

const WORK_INCOME_REDUCTION_MAX = 6500;
const WORK_INCOME_REDUCTION_FLOOR = 14750;
const WORK_INCOME_REDUCTION_END = 18750;

export function calculateSSBreakdown(annualGross: number, contractType: ContractType): SSBreakdown {
  const unemploymentRate = SS_RATES[contractType].unemployment;
  const contingenciasComunes = round2(annualGross * 0.047);
  const desempleo = round2(annualGross * unemploymentRate);
  const formacionProfesional = round2(annualGross * 0.001);
  const mei = round2(annualGross * SS_RATES[contractType].mei);
  const total = round2(contingenciasComunes + desempleo + formacionProfesional + mei);

  return {
    contingenciasComunes,
    desempleo,
    formacionProfesional,
    mei,
    total,
    rate: annualGross > 0 ? round2((total / annualGross) * 100) : 0,
  };
}

export function calculateSS(baseSalary: number, contractType: ContractType = 'indefinido'): number {
  return calculateSSBreakdown(baseSalary, contractType).total;
}

export function calculateProgressiveIRPF(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;

  let remaining = taxableIncome;
  let lowerBound = 0;
  let total = 0;

  for (const bracket of IRPF_BRACKETS) {
    const segment = Math.min(remaining, bracket.upTo - lowerBound);
    if (segment > 0) {
      total += segment * bracket.rate;
      remaining -= segment;
    }
    lowerBound = bracket.upTo;
    if (remaining <= 0) break;
  }

  return round2(total);
}

export function calculateWorkIncomeReduction(taxableAfterSS: number): number {
  if (taxableAfterSS <= 0) return 0;
  if (taxableAfterSS <= WORK_INCOME_REDUCTION_FLOOR) return WORK_INCOME_REDUCTION_MAX;
  if (taxableAfterSS >= WORK_INCOME_REDUCTION_END) return 0;

  const slope = WORK_INCOME_REDUCTION_MAX / (WORK_INCOME_REDUCTION_END - WORK_INCOME_REDUCTION_FLOOR);
  return round2(Math.max(WORK_INCOME_REDUCTION_MAX - (taxableAfterSS - WORK_INCOME_REDUCTION_FLOOR) * slope, 0));
}

export function calculateTaxBase(annualGross: number, contractType: ContractType, familyMinimum = 0): TaxBreakdownResult {
  const ss = calculateSSBreakdown(annualGross, contractType);
  const taxableAfterSS = Math.max(annualGross - ss.total, 0);
  const workIncomeReduction = calculateWorkIncomeReduction(taxableAfterSS);
  const personalMinimum = PERSONAL_MINIMUM;
  const liquidBase = Math.max(taxableAfterSS - workIncomeReduction - personalMinimum - familyMinimum, 0);
  const quotaIntegra = calculateProgressiveIRPF(liquidBase);

  return {
    ss,
    workIncomeReduction,
    personalMinimum,
    familyMinimum,
    liquidBase,
    quotaIntegra,
    effectiveRate: taxableAfterSS > 0 ? round2((quotaIntegra / taxableAfterSS) * 100) : 0,
  };
}

export function calculateNetSalary(gross: number, ss: number, irpf: number): number {
  return round2(gross - ss - irpf);
}

function withholdingMultiplier(mode: TaxMode, numJobs: number): number {
  if (numJobs <= 1) return 0;
  const base = mode === 'conservador' ? 0.08 : mode === 'realista' ? 0.05 : 0.02;
  return clamp(base + Math.max(numJobs - 2, 0) * 0.015, 0.02, 0.08);
}

function getActiveMonths(job: JobInput): number {
  const start = clamp(Math.round(job.startMonth), 1, 12);
  const end = clamp(Math.round(job.endMonth), 1, 12);
  return start <= end ? end - start + 1 : 12;
}

function getAnnualGross(job: JobInput): number {
  const periods = job.payPeriods === 0 ? job.customPayPeriods ?? 12 : job.payPeriods;
  return round2(job.monthlyGross * periods);
}

function getMonthlyGrossInMonth(job: JobInput, monthIndex: number): number {
  const month = monthIndex + 1;
  const active = month >= clamp(Math.round(job.startMonth), 1, 12) && month <= clamp(Math.round(job.endMonth), 1, 12);
  if (!active) return 0;
  return job.monthlyGross;
}

export function calculateMonthlyOverlap(jobs: JobInput[]): MonthPoint[] {
  return MONTHS.map((month, index) => {
    const gross = jobs.reduce((sum, job) => sum + getMonthlyGrossInMonth(job, index), 0);
    const activeJobs = jobs.filter((job) => getMonthlyGrossInMonth(job, index) > 0).length;
    return { month, gross: round2(gross), net: 0, tax: 0, activeJobs };
  });
}

function estimateJobWithholding(job: JobInput, numJobs: number, mode: TaxMode): { theoretical: number; withheld: number; rate: number; taxBase: number; taxDetails: TaxBreakdownResult } {
  const annualGross = getAnnualGross(job);
  const taxDetails = calculateTaxBase(annualGross, job.contractType);
  const theoretical = taxDetails.quotaIntegra;
  const rate = annualGross > 0 ? theoretical / annualGross : 0;
  const configuredRate = clamp((job.irpfRate || 0) / 100, 0, 0.45);
  const uplift = withholdingMultiplier(mode, numJobs);
  const baseWithholdingRate = configuredRate > 0 ? configuredRate : rate;
  const withheldRate = clamp(baseWithholdingRate + uplift + (numJobs > 1 && annualGross > 30000 ? 0.015 : 0), 0, 0.55);
  const withheld = round2(taxDetails.liquidBase * withheldRate);

  return {
    theoretical,
    withheld,
    rate: round2(withheldRate * 100),
    taxBase: taxDetails.liquidBase,
    taxDetails,
  };
}

export function simulateMultiJobScenario(jobs: JobInput[], mode: TaxMode = 'realista'): ScenarioResult {
  const annualGross = jobs.reduce((sum, job) => sum + getAnnualGross(job), 0);
  const grossByJob = jobs.map((job) => ({ job, annualGross: getAnnualGross(job), activeMonths: getActiveMonths(job) }));
  const secondPayerAnnual = grossByJob.slice(1).reduce((sum, item) => sum + item.annualGross, 0);

  const jobsResult = grossByJob.map((entry) => {
    const estimate = estimateJobWithholding(entry.job, jobs.length, mode);
    const ss = estimate.taxDetails.ss.total;
    const netAnnual = calculateNetSalary(entry.annualGross, ss, estimate.withheld);

    return {
      id: entry.job.id,
      company: entry.job.company,
      contractType: entry.job.contractType,
      monthlyGross: entry.job.monthlyGross,
      annualGross: entry.annualGross,
      ss,
      ssBreakdown: estimate.taxDetails.ss,
      taxableBase: Math.max(entry.annualGross - ss, 0),
      workIncomeReduction: estimate.taxDetails.workIncomeReduction,
      personalMinimum: estimate.taxDetails.personalMinimum,
      liquidBase: estimate.taxDetails.liquidBase,
      irpfTheoreticalAnnual: estimate.theoretical,
      irpfWithheldAnnual: estimate.withheld,
      withholdingRate: estimate.rate,
      netAnnual,
      netMonthlyAverage: round2(netAnnual / Math.max(entry.activeMonths, 1)),
      activeMonths: entry.activeMonths,
    };
  });

  const ssAnnual = jobsResult.reduce((sum, job) => sum + job.ss, 0);
  const ssBreakdownAnnual = jobsResult.reduce(
    (acc, job) => ({
      contingenciasComunes: round2(acc.contingenciasComunes + job.ssBreakdown.contingenciasComunes),
      desempleo: round2(acc.desempleo + job.ssBreakdown.desempleo),
      formacionProfesional: round2(acc.formacionProfesional + job.ssBreakdown.formacionProfesional),
      mei: round2(acc.mei + job.ssBreakdown.mei),
      total: round2(acc.total + job.ssBreakdown.total),
      rate: annualGross > 0 ? round2((acc.total + job.ssBreakdown.total) / annualGross * 100) : 0,
    }),
    { contingenciasComunes: 0, desempleo: 0, formacionProfesional: 0, mei: 0, total: 0, rate: 0 } as SSBreakdown,
  );

  const taxableBaseAnnual = Math.max(annualGross - ssAnnual, 0);
  const workIncomeReductionAnnual = calculateWorkIncomeReduction(taxableBaseAnnual);
  const personalMinimumAnnual = jobs.length > 0 ? PERSONAL_MINIMUM : 0;
  const liquidBaseAnnual = Math.max(taxableBaseAnnual - workIncomeReductionAnnual - personalMinimumAnnual, 0);
  const irpfTheoreticalAnnual = calculateProgressiveIRPF(liquidBaseAnnual);
  const irpfWithheldAnnual = round2(jobsResult.reduce((sum, job) => sum + job.irpfWithheldAnnual, 0));
  const netAnnual = calculateNetSalary(annualGross, ssAnnual, irpfWithheldAnnual);
  const effectiveIrpfRate = taxableBaseAnnual > 0 ? round2((irpfTheoreticalAnnual / taxableBaseAnnual) * 100) : 0;
  const surpriseTax = round2(Math.max(irpfTheoreticalAnnual - irpfWithheldAnnual, 0));
  const averageWithholdingRate = annualGross > 0 ? round2((irpfWithheldAnnual / annualGross) * 100) : 0;

  const monthlyTimeline = calculateMonthlyOverlap(jobs).map((point) => {
    const activeJobs = jobs.filter((job) => {
      const monthNumber = MONTHS.indexOf(point.month) + 1;
      return monthNumber >= clamp(Math.round(job.startMonth), 1, 12) && monthNumber <= clamp(Math.round(job.endMonth), 1, 12);
    });
    const gross = activeJobs.reduce((sum, job) => sum + job.monthlyGross, 0);
    const monthlySs = calculateSS(gross, activeJobs[0]?.contractType ?? 'indefinido');
    const monthlyTaxable = Math.max(gross - monthlySs, 0);
    const monthlyTax = round2(monthlyTaxable * (averageWithholdingRate / 100));
    return {
      ...point,
      gross: round2(gross),
      tax: monthlyTax,
      net: round2(gross - monthlySs - monthlyTax),
    };
  });

  return {
    jobs: jobsResult,
    monthlyTimeline,
    grossAnnual: round2(annualGross),
    ssAnnual: round2(ssAnnual),
    ssBreakdownAnnual,
    taxableBaseAnnual: round2(taxableBaseAnnual),
    workIncomeReductionAnnual: round2(workIncomeReductionAnnual),
    personalMinimumAnnual: round2(personalMinimumAnnual),
    liquidBaseAnnual: round2(liquidBaseAnnual),
    irpfTheoreticalAnnual: round2(irpfTheoreticalAnnual),
    irpfWithheldAnnual: round2(irpfWithheldAnnual),
    irpfAnnual: round2(irpfWithheldAnnual),
    netAnnual: round2(netAnnual),
    effectiveIrpfRate,
    surpriseTax,
    overlapMonths: monthlyTimeline.filter((m) => m.activeJobs > 1).length,
    secondPayerAnnual: round2(secondPayerAnnual),
    averageWithholdingRate,
  };
}

export function defaultJob(id: string, index = 0): JobInput {
  return {
    id,
    company: index === 0 ? 'Empresa principal' : `Empresa ${index + 1}`,
    contractType: index === 1 ? 'temporal' : 'indefinido',
    monthlyGross: index === 0 ? 2200 : 800,
    payPeriods: 12,
    irpfRate: index === 0 ? 14 : 10,
    startMonth: 1,
    endMonth: 12,
    customPayPeriods: 12,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
