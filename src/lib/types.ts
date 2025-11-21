import { z } from "zod";

export type Distribution = 'Weibull' | 'Normal' | 'Lognormal' | 'Exponential' | 'Loglogistic' | 'Gumbel';
export type EstimationMethod = 'SRM' | 'MLE';

export interface WeibullParams {
  beta: number; // shape parameter
  eta: number;  // scale parameter (characteristic life)
  rho: number; // correlation coefficient (R-squared)
}

export interface NormalParams {
    mean: number; // mu
    stdDev: number; // sigma
    rho: number;
}

export interface LognormalParams {
    mean: number; // log-mean
    stdDev: number; // log-stdDev
    rho: number;
}

export interface ExponentialParams {
    lambda: number; // rate parameter
    rho: number;
}

export interface LoglogisticParams {
    beta: number; // shape
    alpha: number; // scale (median)
    rho: number;
}

export interface GumbelParams {
    mu: number; // location
    sigma: number; // scale
    rho: number;
}


export type Parameters = Partial<WeibullParams & NormalParams & LognormalParams & ExponentialParams & LoglogisticParams & GumbelParams>;

export interface DataTypeOptions {
  hasSuspensions: boolean; // right-censored data
  hasIntervals: boolean;   // interval and left-censored data
  isGrouped: boolean;
}

export type PlotData = {
    points: { x: number; y: number; time: number; prob: number }[];
    line: { x: number; y: number }[];
    rSquared: number;
    angle?: number;
};

export interface EstimateParams {
  dist: Distribution;
  failureTimes: number[];
  suspensionTimes?: number[];
  method?: EstimationMethod;
}

export interface Supplier {
  id: string;
  name: string;
  failureTimes: number[];
  suspensionTimes: number[];
  color: string;
  distribution: Distribution;
  params: Parameters;
  units: string;
  dataType: DataTypeOptions;
  plotData?: PlotData;
}

export interface ChartDataPoint {
  time: number;
  [supplierName: string]: number | null;
}

export interface ReliabilityData {
  Rt: ChartDataPoint[];
  Ft: ChartDataPoint[];
  ft: ChartDataPoint[];
  lambda_t: ChartDataPoint[];
}

// AI Flow Schemas and Types

// PredictFailureRiskFactors
export const PredictFailureRiskFactorsInputSchema = z.object({
  historicalData: z
    .string()
    .describe(
      'Historical failure data, including failure times, operating conditions, and component characteristics.'
    ),
});
export type PredictFailureRiskFactorsInput = z.infer<typeof PredictFailureRiskFactorsInputSchema>;

export const PredictFailureRiskFactorsOutputSchema = z.object({
  riskFactors: z
    .array(z.object({factor: z.string(), importance: z.number()}))
    .describe(
      'An array of risk factors, ranked by importance, that contribute to failures.'
    ),
  summary: z.string().describe('A summary of the analysis and key findings.'),
});
export type PredictFailureRiskFactorsOutput = z.infer<typeof PredictFailureRiskFactorsOutputSchema>;


// AnalyzeChartData
const SupplierAnalysisParamsSchema = z.object({
  name: z.string().describe('The name of the supplier.'),
  distribution: z.string().describe('The probability distribution used (e.g., "Weibull", "Normal").'),
  params: z.any().describe('An object containing the parameters for the distribution (e.g., { beta: 2.1, eta: 350 }).'),
});

export const AnalyzeChartDataInputSchema = z.object({
  suppliers: z
    .array(SupplierAnalysisParamsSchema)
    .describe('An array of suppliers with their distribution parameters.'),
});
export type AnalyzeChartDataInput = z.infer<typeof AnalyzeChartDataInputSchema>;

const ChartAnalysisSchema = z.object({
  title: z.string().describe('The title of the chart being analyzed (e.g., "Reliability Curve - R(t)").'),
  analysis: z.string().describe('A detailed technical analysis of the chart, comparing the suppliers based on their curves. Explain the meaning of the chart and what the supplier curves indicate.'),
});

export const AnalyzeChartDataOutputSchema = z.object({
  reliability: ChartAnalysisSchema,
  failureProbability: ChartAnalysisSchema,
  probabilityDensity: ChartAnalysisSchema,
  failureRate: ChartAnalysisSchema,
});
export type AnalyzeChartDataOutput = z.infer<typeof AnalyzeChartDataOutputSchema>;
