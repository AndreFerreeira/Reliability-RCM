'use server';

import { predictFailureRiskFactors } from '@/ai/flows/predict-failure-risk-factors';
import { analyzeChartData } from '@/ai/flows/analyze-chart-data';
import type { 
  Supplier, 
  PredictFailureRiskFactorsOutput, 
  AnalyzeChartDataOutput,
  AnalyzeChartDataInput
} from '@/lib/types';


export async function getRiskFactors(
  suppliers: Supplier[]
): Promise<PredictFailureRiskFactorsOutput | { error: string }> {
  try {
    if (suppliers.length === 0) {
      return {
        riskFactors: [],
        summary: 'No supplier data available to analyze risk factors.'
      };
    }
    const historicalData = suppliers
      .map(s => `Supplier ${s.name} failure times: ${s.failureTimes.join(', ')}`)
      .join('\n');
    
      
    const input = { historicalData };
    const result = await predictFailureRiskFactors(input);
    return result;
  } catch (error) {
    console.error('Error predicting risk factors:', error);
    return { error: 'Failed to predict risk factors. Please try again later.' };
  }
}

export async function getChartAnalysis(
  input: AnalyzeChartDataInput
): Promise<AnalyzeChartDataOutput | { error: string }> {
  try {
    if (input.suppliers.length === 0) {
      return { error: "No supplier data to analyze." };
    }
    const result = await analyzeChartData(input);
    return result;
  } catch (error) {
    console.error('Error generating chart analysis:', error);
    return { error: 'Failed to generate chart analysis. Please try again later.' };
  }
}
