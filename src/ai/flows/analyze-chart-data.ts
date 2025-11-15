'use server';
/**
 * @fileOverview Analyzes reliability chart data.
 *
 * - analyzeChartData - A function that generates a detailed analysis for reliability charts.
 */

import { ai } from '@/ai/genkit';
import {
  AnalyzeChartDataInputSchema,
  type AnalyzeChartDataInput,
  type AnalyzeChartDataOutput
} from '@/lib/types';

export async function analyzeChartData(
  input: AnalyzeChartDataInput
): Promise<AnalyzeChartDataOutput> {
  return analyzeChartDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeChartDataPrompt',
  input: { schema: AnalyzeChartDataInputSchema },
  prompt: `You are an expert reliability engineer. Your task is to provide a detailed, comparative analysis of the following suppliers based on their Weibull distribution parameters (Beta and Eta).

Suppliers Data:
{{#each suppliers}}
- Supplier: {{{name}}}, Beta (β): {{{beta}}}, Eta (η): {{{eta}}}
{{/each}}

Analyze the data and generate a detailed technical explanation for each of the following four reliability charts. For each chart, compare the suppliers and explain what their respective curves signify. Use markdown for formatting, including bolding key terms and using lists where appropriate.

1.  **Reliability Curve R(t):** The probability of a component functioning without failure up to time t.
2.  **Failure Probability F(t):** The probability of a component failing by time t. This is the cumulative distribution function (CDF).
3.  **Probability Density f(t):** The relative likelihood of failure at a specific time t. This is the probability density function (PDF).
4.  **Failure Rate λ(t) (Hazard Function):** The instantaneous rate of failure at time t, given that the component has survived up to t.

Provide the entire output in a single, valid JSON object with the following structure:
{
  "reliability": { "title": "Reliability Curve - R(t)", "analysis": "..." },
  "failureProbability": { "title": "Failure Probability - F(t)", "analysis": "..." },
  "probabilityDensity": { "title": "Probability Density - f(t)", "analysis": "..." },
  "failureRate": { "title": "Failure Rate - λ(t)", "analysis": "..." }
}
Do not include any text or formatting outside of this JSON object.`,
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_NONE',
      },
    ],
  }
});


const analyzeChartDataFlow = ai.defineFlow(
  {
    name: 'analyzeChartDataFlow',
    inputSchema: AnalyzeChartDataInputSchema,
  },
  async (input) => {
    if (input.suppliers.length === 0) {
      throw new Error("No supplier data provided for analysis.");
    }
    const result = await prompt(input);
    const textResponse = result.text;
    
    // Clean the response to ensure it is valid JSON
    const cleanedText = textResponse.replace(/^```json\n?/, '').replace(/```$/, '');
    
    try {
      return JSON.parse(cleanedText);
    } catch (e) {
      console.error("Failed to parse AI response as JSON:", cleanedText);
      throw new Error("The AI returned an invalid analysis format.");
    }
  }
);
