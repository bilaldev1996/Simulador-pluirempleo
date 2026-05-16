export type ContractType = 'indefinido' | 'temporal' | 'fijo-discontinuo';
export type WithholdingMode = 'auto' | 'manual';

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
  withholdingMode: WithholdingMode;
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
  withholdingMode: WithholdingMode;
  monthlyGross: number;
  annualGross: number;
  ss: number;
  ssBreakdown: SSBreakdown;
  taxableBase: number;
  irpfWithheldAnnual: number;
  withholdingRate: number;
  netPaidAnnual: number;
  netMonthlyAverage: number;
  activeMonths: number;
  payPeriods: number;
}

export interface ScenarioResult {
  jobs: JobResult[];
  monthlyTimeline: MonthPoint[];
  grossAnnual: number;
  ssAnnual: number;
  ssBreakdownAnnual: SSBreakdown;
  personalMinimumAnnual: number;
  baseIrpfGlobalAnnual: number;
  workIncomeReductionAnnual: number;
  liquidBaseAnnual: number;
  irpfRealAnnual: number;
  irpfWithheldAnnual: number;
  netAfterSettlementAnnual: number;
  netPaidAnnual: number;
  regularizationEstimated: number;
  overlapMonths: number;
  secondPayerAnnual: number;
  companiesActiveByMonth: number[];
}
