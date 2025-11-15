'use server';
/**
 * @fileOverview This file defines a Genkit flow for predicting failure risk factors based on historical data.
 *
 * - predictFailureRiskFactors - A function that takes historical failure data and returns the top risk factors.
 * - PredictFailureRiskFactorsInput - The input type for the predictFailureRiskFactors function.
 * - PredictFailureRiskFactorsOutput - The return type for the predictFailureRiskFactors function.
 */

import { ai } from '@/ai/genkit';
import {z} from 'genkit';

const PredictFailureRiskFactorsInputSchema = z.object({
  historicalData: z
    .string()
    .describe(
      'Historical failure data, including failure times, operating conditions, and component characteristics.'
    ),
});
export type PredictFailureRiskFactorsInput = z.infer<typeof PredictFailureRiskFactorsInputSchema>;

const PredictFailureRiskFactorsOutputSchema = z.object({
  riskFactors: z
    .array(z.object({factor: z.string(), importance: z.number()}))
    .describe(
      'An array of risk factors, ranked by importance, that contribute to failures.'
    ),
  summary: z.string().describe('A summary of the analysis and key findings.'),
});
export type PredictFailureRiskFactorsOutput = z.infer<typeof PredictFailureRiskFactorsOutputSchema>;

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

Historical Data: {{{historicalData}}}

Based on this data, identify and rank the top risk factors. Provide a summary of your analysis and key findings.

Format your response as a JSON object with the following structure:
{
  "riskFactors": [
    { "factor": "[Risk factor 1]", "importance": [Importance score 0-1] },
    { "factor": "[Risk factor 2]", "importance": [Importance score 0-1] },
    ...
  ],
  "summary": "[Summary of the analysis and key findings]"
}`,
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
