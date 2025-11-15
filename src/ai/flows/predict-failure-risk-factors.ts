'use server';
/**
 * @fileOverview This file defines a Genkit flow for predicting failure risk factors based on historical data.
 *
 * - predictFailureRiskFactors - A function that takes historical failure data and returns the top risk factors.
 */

import { ai } from '@/ai/genkit';
import { 
  PredictFailureRiskFactorsInputSchema,
  type PredictFailureRiskFactorsInput,
  PredictFailureRiskFactorsOutputSchema,
  type PredictFailureRiskFactorsOutput,
} from '@/lib/types';


export async function predictFailureRiskFactors(
  input: PredictFailureRiskFactorsInput
): Promise<PredictFailureRiskFactorsOutput> {
  return predictFailureRiskFactorsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'predictFailureRiskFactorsPrompt',
  input: {schema: PredictFailureRiskFactorsInputSchema},
  output: {schema: PredictFailureRiskFactorsOutputSchema},
  prompt: `You are an expert reliability engineer. Analyze the following historical failure data to identify the most significant risk factors contributing to failures.

Historical Data:
{{{historicalData}}}

Based on this data, provide a brief summary of your analysis and then list the top 3-5 risk factors ranked by importance. The importance should be a number between 0 and 1.`,
});

const predictFailureRiskFactorsFlow = ai.defineFlow(
  {
    name: 'predictFailureRiskFactorsFlow',
    inputSchema: PredictFailureRiskFactorsInputSchema,
    outputSchema: PredictFailureRiskFactorsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
