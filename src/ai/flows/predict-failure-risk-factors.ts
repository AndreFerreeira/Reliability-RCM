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
  prompt: `You are an expert reliability engineer. Analyze the following historical failure data and identify the most significant risk factors contributing to failures.

Historical Data:
{{{historicalData}}}

Based on this data, identify and rank the top risk factors. Provide a summary of your analysis and key findings.

Format your response as a JSON object.`,
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
