'use server';

import { predictFailureRiskFactors } from '@/ai/flows/predict-failure-risk-factors';
import type { Supplier } from '@/lib/types';
import type { PredictFailureRiskFactorsOutput } from '@/ai/flows/predict-failure-risk-factors';

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
