import { ContractType, JobInput, MonthPoint, ScenarioResult, SSBreakdown, WithholdingMode } from '../types';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const PERSONAL_MINIMUM = 5550;

const IRPF_BRACKETS = [
  { upTo: 12450, rate: 0.19 },
  { upTo: 20200, rate: 0.24 },
  { upTo: 35200, rate: 0.3 },
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
  const contingenciasComunes = round2(annualGross * 0.047);
  const desempleo = round2(annualGross * SS_RATES[contractType].unemployment);
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

export function calculateGlobalTax(grossAnnual: number, ssAnnual: number): {
  baseIrpfGlobalAnnual: number;
  workIncomeReductionAnnual: number;
  personalMinimumAnnual: number;
  liquidBaseAnnual: number;
  irpfRealAnnual: number;
} {
  const baseIrpfGlobalAnnual = Math.max(grossAnnual - ssAnnual, 0);
  const workIncomeReductionAnnual = calculateWorkIncomeReduction(baseIrpfGlobalAnnual);
  const personalMinimumAnnual = PERSONAL_MINIMUM;
  const liquidBaseAnnual = Math.max(baseIrpfGlobalAnnual - workIncomeReductionAnnual - personalMinimumAnnual, 0);
  const irpfRealAnnual = calculateProgressiveIRPF(liquidBaseAnnual);

  return {
    baseIrpfGlobalAnnual,
    workIncomeReductionAnnual,
    personalMinimumAnnual,
    liquidBaseAnnual,
    irpfRealAnnual,
  };
}

export function calculateNetSalary(gross: number, ss: number, tax: number): number {
  return round2(gross - ss - tax);
}

function getAnnualGross(job: JobInput): number {
  const periods = job.payPeriods === 0 ? job.customPayPeriods ?? 12 : job.payPeriods;
  return round2(job.monthlyGross * periods);
}

function getActiveMonths(job: JobInput): number {
  const start = clamp(Math.round(job.startMonth), 1, 12);
  const end = clamp(Math.round(job.endMonth), 1, 12);
  return start <= end ? end - start + 1 : 12;
}

function getMonthlyGrossInMonth(job: JobInput, monthIndex: number): number {
  const month = monthIndex + 1;
  const active = month >= clamp(Math.round(job.startMonth), 1, 12) && month <= clamp(Math.round(job.endMonth), 1, 12);
  return active ? job.monthlyGross : 0;
}

function estimateAutomaticWithholdingRate(job: JobInput, annualGross: number): number {
  const ss = calculateSSBreakdown(annualGross, job.contractType).total;
  const taxableProxy = Math.max(annualGross - ss - PERSONAL_MINIMUM, 0);
  const monthlyEquivalent = annualGross / Math.max(getActiveMonths(job), 1);
  const annualizedMonthly = monthlyEquivalent * 12;
  const baseIncome = Math.max(taxableProxy, annualizedMonthly - PERSONAL_MINIMUM);

  if (baseIncome <= 12000) return 0.035;
  if (baseIncome <= 18000) return lerp(0.055, 0.085, (baseIncome - 12000) / 6000);
  if (baseIncome <= 22000) return lerp(0.085, 0.12, (baseIncome - 18000) / 4000);
  if (baseIncome <= 30000) return lerp(0.12, 0.17, (baseIncome - 22000) / 8000);
  if (baseIncome <= 40000) return lerp(0.15, 0.2, (baseIncome - 30000) / 10000);
  return clamp(0.2 + (baseIncome - 40000) / 120000, 0.2, 0.32);
}

function estimateWithholdingRate(job: JobInput, annualGross: number): number {
  if (job.withholdingMode === 'manual') return clamp((job.irpfRate || 0) / 100, 0.03, 0.55);
  const rate = estimateAutomaticWithholdingRate(job, annualGross);
  return clamp(rate, 0.03, 0.55);
}

function calculateJobRetainedTax(job: JobInput): {
  ss: SSBreakdown;
  annualGross: number;
  withholdingRate: number;
  irpfWithheldAnnual: number;
} {
  const annualGross = getAnnualGross(job);
  const ss = calculateSSBreakdown(annualGross, job.contractType);
  const withholdingRate = estimateWithholdingRate(job, annualGross);
  const irpfWithheldAnnual = round2(Math.max(annualGross - ss.total, 0) * withholdingRate);

  return {
    ss,
    annualGross,
    withholdingRate: round2(withholdingRate * 100),
    irpfWithheldAnnual,
  };
}

export function calculateMonthlyOverlap(jobs: JobInput[], jobsResult?: JobResultLike[]): MonthPoint[] {
  return MONTHS.map((month, index) => {
    const activeJobs = jobs.filter((job) => getMonthlyGrossInMonth(job, index) > 0);
    const gross = round2(activeJobs.reduce((sum, job) => sum + getMonthlyGrossInMonth(job, index), 0));
    const ss = round2(activeJobs.reduce((sum, job) => sum + calculateSS(getMonthlyGrossInMonth(job, index), job.contractType), 0));

    const monthlyTax = round2(
      activeJobs.reduce((sum, job) => {
        const jobResult = jobsResult?.find((item) => item.job.id === job.id);
        if (jobResult) {
          return sum + jobResult.irpfWithheldAnnual / Math.max(jobResult.activeMonths, 1);
        }
        const annualGross = getAnnualGross(job);
        const withholdingRate = estimateWithholdingRate(job, annualGross);
        const monthlyBase = Math.max(getMonthlyGrossInMonth(job, index) - calculateSS(getMonthlyGrossInMonth(job, index), job.contractType), 0);
        return sum + monthlyBase * withholdingRate;
      }, 0),
    );

    return {
      month,
      gross,
      net: round2(gross - ss - monthlyTax),
      tax: monthlyTax,
      activeJobs: activeJobs.length,
    };
  });
}

type JobResultLike = {
  job: JobInput;
  irpfWithheldAnnual: number;
  activeMonths: number;
};

export function simulateMultiJobScenario(jobs: JobInput[]): ScenarioResult {
  const jobTaxData = jobs.map((job) => {
    const annualGross = getAnnualGross(job);
    const ss = calculateSSBreakdown(annualGross, job.contractType);
    const withholdingRate = estimateWithholdingRate(job, annualGross);
    const irpfWithheldAnnual = round2(Math.max(annualGross - ss.total, 0) * withholdingRate);
    const netPaidAnnual = calculateNetSalary(annualGross, ss.total, irpfWithheldAnnual);

    return {
      job,
      annualGross,
      ss,
      withholdingRate,
      irpfWithheldAnnual,
      netPaidAnnual,
      activeMonths: getActiveMonths(job),
      payPeriods: job.payPeriods === 0 ? job.customPayPeriods ?? 12 : job.payPeriods,
    };
  });

  const grossAnnual = round2(jobTaxData.reduce((sum, item) => sum + item.annualGross, 0));
  const ssAnnual = round2(jobTaxData.reduce((sum, item) => sum + item.ss.total, 0));
  const ssBreakdownAnnual = jobTaxData.reduce(
    (acc, item) => ({
      contingenciasComunes: round2(acc.contingenciasComunes + item.ss.contingenciasComunes),
      desempleo: round2(acc.desempleo + item.ss.desempleo),
      formacionProfesional: round2(acc.formacionProfesional + item.ss.formacionProfesional),
      mei: round2(acc.mei + item.ss.mei),
      total: round2(acc.total + item.ss.total),
      rate: grossAnnual > 0 ? round2(((acc.total + item.ss.total) / grossAnnual) * 100) : 0,
    }),
    { contingenciasComunes: 0, desempleo: 0, formacionProfesional: 0, mei: 0, total: 0, rate: 0 } as SSBreakdown,
  );

  const globalTax = calculateGlobalTax(grossAnnual, ssAnnual);
  const irpfWithheldAnnual = round2(jobTaxData.reduce((sum, item) => sum + item.irpfWithheldAnnual, 0));
  const regularizationEstimated = round2(globalTax.irpfRealAnnual - irpfWithheldAnnual);
  const netPaidAnnual = round2(grossAnnual - ssAnnual - irpfWithheldAnnual);
  const netAfterSettlementAnnual = round2(netPaidAnnual - regularizationEstimated);
  const companiesActiveByMonth = calculateMonthlyOverlap(jobs).map((month) => month.activeJobs);

  const monthlyTimeline = calculateMonthlyOverlap(jobs, jobTaxData).map((point) => {
    const activeJobs = jobs.filter((job) => {
      const monthNumber = MONTHS.indexOf(point.month) + 1;
      return monthNumber >= clamp(Math.round(job.startMonth), 1, 12) && monthNumber <= clamp(Math.round(job.endMonth), 1, 12);
    });

    const gross = round2(activeJobs.reduce((sum, job) => sum + getMonthlyGrossInMonth(job, MONTHS.indexOf(point.month)), 0));
    const ss = round2(activeJobs.reduce((sum, job) => sum + calculateSS(getMonthlyGrossInMonth(job, MONTHS.indexOf(point.month)), job.contractType), 0));
    const monthWithholding = round2(
      activeJobs.reduce((sum, job) => {
        const jobResult = jobTaxData.find((item) => item.job.id === job.id);
        if (!jobResult) return sum;
        return sum + jobResult.irpfWithheldAnnual / Math.max(jobResult.activeMonths, 1);
      }, 0),
    );

    return {
      ...point,
      gross,
      tax: monthWithholding,
      net: round2(gross - ss - monthWithholding),
    };
  });

  const jobsResult = jobTaxData.map((item) => ({
    id: item.job.id,
    company: item.job.company,
    contractType: item.job.contractType,
    withholdingMode: item.job.withholdingMode,
    monthlyGross: item.job.monthlyGross,
    annualGross: item.annualGross,
    ss: item.ss.total,
    ssBreakdown: item.ss,
    taxableBase: Math.max(item.annualGross - item.ss.total, 0),
    irpfWithheldAnnual: item.irpfWithheldAnnual,
    withholdingRate: item.withholdingRate,
    netPaidAnnual: item.netPaidAnnual,
    netMonthlyAverage: round2(item.netPaidAnnual / Math.max(item.activeMonths, 1)),
    activeMonths: item.activeMonths,
    payPeriods: item.payPeriods,
  }));

  return {
    jobs: jobsResult,
    monthlyTimeline,
    grossAnnual,
    ssAnnual,
    ssBreakdownAnnual,
    personalMinimumAnnual: globalTax.personalMinimumAnnual,
    baseIrpfGlobalAnnual: globalTax.baseIrpfGlobalAnnual,
    workIncomeReductionAnnual: globalTax.workIncomeReductionAnnual,
    liquidBaseAnnual: globalTax.liquidBaseAnnual,
    irpfRealAnnual: globalTax.irpfRealAnnual,
    irpfWithheldAnnual,
    netPaidAnnual,
    netAfterSettlementAnnual,
    regularizationEstimated,
    overlapMonths: monthlyTimeline.filter((m) => m.activeJobs > 1).length,
    secondPayerAnnual: round2(jobTaxData.slice(1).reduce((sum, item) => sum + item.annualGross, 0)),
    companiesActiveByMonth,
  };
}

export function defaultJob(id: string, index = 0): JobInput {
  return {
    id,
    company: index === 0 ? 'Empresa principal' : `Empresa ${index + 1}`,
    contractType: index === 1 ? 'temporal' : 'indefinido',
    monthlyGross: index === 0 ? 2200 : 800,
    payPeriods: 12,
    irpfRate: index === 0 ? 12 : 8,
    withholdingMode: 'auto',
    startMonth: 1,
    endMonth: 12,
    customPayPeriods: 12,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
