import { z } from "zod";

export interface WeibullParams {
  beta: number; // shape parameter
  eta: number;  // scale parameter (characteristic life)
}

export interface Supplier extends WeibullParams {
  id: string;
  name: string;
  failureTimes: number[];
  color: string;
}

export interface ChartDataPoint {
  time: number;
  [supplierName: string]: number;
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
const SupplierWeibullParamsSchema = z.object({
  name: z.string().describe('The name of the supplier.'),
  beta: z.number().describe('The Weibull shape parameter (β).'),
  eta: z.number().describe('The Weibull scale parameter (η).'),
});

export const AnalyzeChartDataInputSchema = z.object({
  suppliers: z
    .array(SupplierWeibullParamsSchema)
    .describe('An array of suppliers with their Weibull parameters.'),
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
