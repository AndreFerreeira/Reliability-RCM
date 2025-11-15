'use server';

import { generateReliabilityReport } from '@/ai/flows/generate-reliability-report';
import { predictFailureRiskFactors } from '@/ai/flows/predict-failure-risk-factors';
import type { ReliabilityData, Supplier } from '@/lib/types';
import type { PredictFailureRiskFactorsOutput } from '@/ai/flows/predict-failure-risk-factors';

export async function getReliabilityReport(
  suppliers: Supplier[], 
  chartData: ReliabilityData
): Promise<string> {
  try {
    const input = {
      supplierNames: suppliers.map(s => s.name),
      rtData: JSON.stringify(chartData.Rt.slice(0, 50)), // Limit data for prompt size
      ftData: JSON.stringify(chartData.Ft.slice(0, 50)),
      ftDensityData: JSON.stringify(chartData.ft.slice(0, 50)),
      lambdaTData: JSON.stringify(chartData.lambda_t.slice(0, 50)),
    };
    const result = await generateReliabilityReport(input);
    return result.report;
  } catch (error) {
    console.error('Error generating reliability report:', error);
    return 'Failed to generate AI report. Please try again later.';
  }
}

export async function getRiskFactors(
  suppliers: Supplier[]
): Promise<PredictFailureRiskFactorsOutput | { error: string }> {
  try {
    const historicalData = suppliers
      .map(s => `Supplier ${s.name} failure times: ${s.failureTimes.join(', ')}`)
      .join('\n');
    
    if (!historicalData.trim()) {
      return {
        riskFactors: [],
        summary: 'No supplier data available to analyze risk factors.'
      };
    }
      
    const input = { historicalData };
    const result = await predictFailureRiskFactors(input);
    return result;
  } catch (error) {
    console.error('Error predicting risk factors:', error);
    return { error: 'Failed to predict risk factors. Please try again later.' };
  }
}
