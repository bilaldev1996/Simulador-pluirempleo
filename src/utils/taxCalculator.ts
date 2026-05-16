import { ContractType, JobInput, MonthPoint, ScenarioResult, SSBreakdown, TaxBreakdownResult, TaxMode } from '../types';

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

export function calculateTaxBase(annualGross: number, contractType: ContractType, familyMinimum = 0): TaxBreakdownResult {
  const ss = calculateSSBreakdown(annualGross, contractType);
  const baseIrpfGlobal = Math.max(annualGross - ss.total, 0);
  const workIncomeReduction = calculateWorkIncomeReduction(baseIrpfGlobal);
  const personalMinimum = PERSONAL_MINIMUM;
  const liquidBase = Math.max(baseIrpfGlobal - workIncomeReduction - personalMinimum - familyMinimum, 0);
  const quotaIntegra = calculateProgressiveIRPF(liquidBase);

  return {
    ss,
    workIncomeReduction,
    personalMinimum,
    familyMinimum,
    liquidBase,
    quotaIntegra,
    effectiveRate: baseIrpfGlobal > 0 ? round2((quotaIntegra / baseIrpfGlobal) * 100) : 0,
  };
}

export function calculateNetSalary(gross: number, ss: number, irpf: number): number {
  return round2(gross - ss - irpf);
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

function estimateIndividualWithholding(job: JobInput): { rate: number; withheld: number; ss: SSBreakdown; taxableBase: number; taxDetails: TaxBreakdownResult } {
  const annualGross = getAnnualGross(job);
  const ss = calculateSSBreakdown(annualGross, job.contractType);
  const taxableBase = Math.max(annualGross - ss.total, 0);
  const workIncomeReduction = calculateWorkIncomeReduction(taxableBase);
  const liquidBase = Math.max(taxableBase - workIncomeReduction - PERSONAL_MINIMUM, 0);
  const taxDetails: TaxBreakdownResult = {
    ss,
    workIncomeReduction,
    personalMinimum: PERSONAL_MINIMUM,
    familyMinimum: 0,
    liquidBase,
    quotaIntegra: calculateProgressiveIRPF(liquidBase),
    effectiveRate: taxableBase > 0 ? round2((calculateProgressiveIRPF(liquidBase) / taxableBase) * 100) : 0,
  };

  const theoreticalRate = annualGross > 0 ? taxDetails.quotaIntegra / annualGross : 0;
  const withholdingRate = annualGross < 12000 ? clamp(theoreticalRate, 0, 0.55) : clamp(Math.max(theoreticalRate, 0.03), 0.03, 0.55);
  const withheld = round2(liquidBase * withholdingRate);

  return {
    rate: round2(withholdingRate * 100),
    withheld,
    ss,
    taxableBase,
    taxDetails,
  };
}

export function calculateMonthlyOverlap(jobs: JobInput[]): MonthPoint[] {
  return MONTHS.map((month, index) => {
    const gross = jobs.reduce((sum, job) => sum + getMonthlyGrossInMonth(job, index), 0);
    const activeJobs = jobs.filter((job) => getMonthlyGrossInMonth(job, index) > 0).length;
    return { month, gross: round2(gross), net: 0, tax: 0, activeJobs };
  });
}

export function simulateMultiJobScenario(jobs: JobInput[], _mode: TaxMode = 'realista'): ScenarioResult {
  const grossAnnual = round2(jobs.reduce((sum, job) => sum + getAnnualGross(job), 0));
  const jobBreakdown = jobs.map((job) => ({ job, annualGross: getAnnualGross(job), activeMonths: getActiveMonths(job), withholding: estimateIndividualWithholding(job) }));

  const jobsResult = jobBreakdown.map((entry) => {
    const ss = entry.withholding.ss.total;
    const netAnnual = calculateNetSalary(entry.annualGross, ss, entry.withholding.withheld);

    return {
      id: entry.job.id,
      company: entry.job.company,
      contractType: entry.job.contractType,
      monthlyGross: entry.job.monthlyGross,
      annualGross: entry.annualGross,
      ss,
      ssBreakdown: entry.withholding.ss,
      taxableBase: entry.withholding.taxableBase,
      workIncomeReduction: entry.withholding.taxDetails.workIncomeReduction,
      personalMinimum: entry.withholding.taxDetails.personalMinimum,
      liquidBase: entry.withholding.taxDetails.liquidBase,
      irpfTheoreticalAnnual: entry.withholding.taxDetails.quotaIntegra,
      irpfWithheldAnnual: entry.withholding.withheld,
      withholdingRate: entry.withholding.rate,
      netAnnual,
      netMonthlyAverage: round2(netAnnual / Math.max(entry.activeMonths, 1)),
      activeMonths: entry.activeMonths,
    };
  });

  const ssBreakdownAnnual = jobsResult.reduce(
    (acc, job) => ({
      contingenciasComunes: round2(acc.contingenciasComunes + job.ssBreakdown.contingenciasComunes),
      desempleo: round2(acc.desempleo + job.ssBreakdown.desempleo),
      formacionProfesional: round2(acc.formacionProfesional + job.ssBreakdown.formacionProfesional),
      mei: round2(acc.mei + job.ssBreakdown.mei),
      total: round2(acc.total + job.ssBreakdown.total),
      rate: grossAnnual > 0 ? round2(((acc.total + job.ssBreakdown.total) / grossAnnual) * 100) : 0,
    }),
    { contingenciasComunes: 0, desempleo: 0, formacionProfesional: 0, mei: 0, total: 0, rate: 0 } as SSBreakdown,
  );

  const ssAnnual = ssBreakdownAnnual.total;
  const baseIrpfGlobal = Math.max(grossAnnual - ssAnnual, 0);
  const workIncomeReductionAnnual = calculateWorkIncomeReduction(baseIrpfGlobal);
  const personalMinimumAnnual = jobs.length > 0 ? PERSONAL_MINIMUM : 0;
  const liquidBaseAnnual = Math.max(baseIrpfGlobal - workIncomeReductionAnnual - personalMinimumAnnual, 0);
  const irpfRealAnnual = calculateProgressiveIRPF(liquidBaseAnnual);
  const irpfWithheldAnnual = round2(jobsResult.reduce((sum, job) => sum + job.irpfWithheldAnnual, 0));
  const netAnnual = round2(grossAnnual - ssAnnual - irpfWithheldAnnual);
  const netAfterSettlementAnnual = round2(netAnnual - (irpfRealAnnual - irpfWithheldAnnual));
  const surpriseTax = round2(irpfRealAnnual - irpfWithheldAnnual);
  const effectiveIrpfRate = baseIrpfGlobal > 0 ? round2((irpfRealAnnual / baseIrpfGlobal) * 100) : 0;
  const averageWithholdingRate = grossAnnual > 0 ? round2((irpfWithheldAnnual / grossAnnual) * 100) : 0;

  const monthlyTimeline = calculateMonthlyOverlap(jobs).map((point) => {
    const activeJobs = jobs.filter((job) => {
      const monthNumber = MONTHS.indexOf(point.month) + 1;
      return monthNumber >= clamp(Math.round(job.startMonth), 1, 12) && monthNumber <= clamp(Math.round(job.endMonth), 1, 12);
    });

    const gross = round2(activeJobs.reduce((sum, job) => sum + job.monthlyGross, 0));
    const ss = round2(activeJobs.reduce((sum, job) => sum + calculateSS(job.monthlyGross, job.contractType), 0));
    const tax = round2(activeJobs.reduce((sum, job) => {
      const annualGross = getAnnualGross(job);
      const withholding = estimateIndividualWithholding(job);
      return sum + (annualGross > 0 ? (withholding.withheld / annualGross) * job.monthlyGross : 0);
    }, 0));

    return {
      ...point,
      gross,
      tax,
      net: round2(gross - ss - tax),
    };
  });

  return {
    jobs: jobsResult,
    monthlyTimeline,
    grossAnnual,
    ssAnnual,
    ssBreakdownAnnual,
    taxableBaseAnnual: round2(baseIrpfGlobal),
    workIncomeReductionAnnual: round2(workIncomeReductionAnnual),
    personalMinimumAnnual: round2(personalMinimumAnnual),
    liquidBaseAnnual: round2(liquidBaseAnnual),
    irpfTheoreticalAnnual: round2(irpfRealAnnual),
    irpfWithheldAnnual,
    irpfAnnual: round2(irpfRealAnnual),
    netAnnual,
    netAfterSettlementAnnual,
    effectiveIrpfRate,
    surpriseTax,
    overlapMonths: monthlyTimeline.filter((m) => m.activeJobs > 1).length,
    secondPayerAnnual: round2(jobBreakdown.slice(1).reduce((sum, item) => sum + item.annualGross, 0)),
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
