export type ContractType = 'indefinido' | 'temporal' | 'fijo-discontinuo';
export type TaxMode = 'conservador' | 'realista' | 'optimista';

export interface SSBreakdown {
  contingenciasComunes: number;
  desempleo: number;
  formacionProfesional: number;
  mei: number;
  total: number;
  rate: number;
}

export interface TaxBreakdownResult {
  ss: SSBreakdown;
  workIncomeReduction: number;
  personalMinimum: number;
  familyMinimum: number;
  liquidBase: number;
  quotaIntegra: number;
  effectiveRate: number;
}

export interface JobInput {
  id: string;
  company: string;
  contractType: ContractType;
  monthlyGross: number;
  payPeriods: number;
  irpfRate: number;
  startMonth: number;
  endMonth: number;
  customPayPeriods?: number;
}

export interface MonthPoint {
  month: string;
  gross: number;
  net: number;
  tax: number;
  activeJobs: number;
}

export interface JobResult {
  id: string;
  company: string;
  contractType: ContractType;
  monthlyGross: number;
  annualGross: number;
  ss: number;
  ssBreakdown: SSBreakdown;
  taxableBase: number;
  workIncomeReduction: number;
  personalMinimum: number;
  liquidBase: number;
  irpfTheoreticalAnnual: number;
  irpfWithheldAnnual: number;
  withholdingRate: number;
  netAnnual: number;
  netMonthlyAverage: number;
  activeMonths: number;
}

export interface ScenarioResult {
  jobs: JobResult[];
  monthlyTimeline: MonthPoint[];
  grossAnnual: number;
  ssAnnual: number;
  ssBreakdownAnnual: SSBreakdown;
  taxableBaseAnnual: number;
  workIncomeReductionAnnual: number;
  personalMinimumAnnual: number;
  liquidBaseAnnual: number;
  irpfTheoreticalAnnual: number;
  irpfWithheldAnnual: number;
  irpfAnnual: number;
  netAnnual: number;
  netAfterSettlementAnnual: number;
  effectiveIrpfRate: number;
  surpriseTax: number;
  overlapMonths: number;
  secondPayerAnnual: number;
  averageWithholdingRate: number;
}
