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
  type PredictFailureRiskFactorsOutput,
} from '@/lib/types';


export async function predictFailureRiskFactors(
  input: PredictFailureRiskFactorsInput
): Promise<PredictFailureRiskFactorsOutput> {
  return predictFailureRiskFactorsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'predictFailureRiskFactorsPrompt',
  input: { schema: PredictFailureRiskFactorsInputSchema },
  prompt: `You are an expert reliability engineer. Analyze the following historical failure data to identify the most significant risk factors contributing to failures.

Historical Data:
{{{historicalData}}}

Based on this data, provide a brief summary of your analysis and then list the top 3-5 risk factors ranked by importance. The importance should be a number between 0 and 1.

Provide the entire output in a single, valid JSON object with the following structure:
{
  "riskFactors": [ { "factor": "...", "importance": 0.0 } ],
  "summary": "..."
}
Do not include any text or formatting outside of this JSON object.`,
});

const predictFailureRiskFactorsFlow = ai.defineFlow(
  {
    name: 'predictFailureRiskFactorsFlow',
    inputSchema: PredictFailureRiskFactorsInputSchema,
  },
  async (input) => {
    const result = await prompt(input);
    const textResponse = result.text;

    // Clean the response to ensure it is valid JSON
    const cleanedText = textResponse.replace(/^```json\n?/, '').replace(/```$/, '');

    try {
      return JSON.parse(cleanedText);
    } catch (e) {
      console.error("Failed to parse AI response as JSON:", cleanedText);
      throw new Error("The AI returned an invalid risk factor format.");
    }
  }
);
