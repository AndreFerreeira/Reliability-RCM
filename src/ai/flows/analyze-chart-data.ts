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
  AnalyzeChartDataOutputSchema,
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
  output: { schema: AnalyzeChartDataOutputSchema },
  prompt: `You are an expert reliability engineer. Your task is to provide a detailed, comparative analysis of the following suppliers based on their Weibull distribution parameters (Beta and Eta).

Suppliers Data:
{{#each suppliers}}
- Supplier: {{name}}, Beta (β): {{beta}}, Eta (η): {{eta}}
{{/each}}

Analyze the data and generate a detailed technical explanation for each of the following four reliability charts. For each chart, compare the suppliers and explain what their respective curves signify. Use markdown for formatting, including bolding key terms and using lists where appropriate.

1.  **Reliability Curve R(t):** The probability of a component functioning without failure up to time t.
2.  **Failure Probability F(t):** The probability of a component failing by time t. This is the cumulative distribution function (CDF).
3.  **Probability Density f(t):** The relative likelihood of failure at a specific time t. This is the probability density function (PDF).
4.  **Failure Rate λ(t) (Hazard Function):** The instantaneous rate of failure at time t, given that the component has survived up to t.

Provide the output in a structured JSON format.`,
});


const analyzeChartDataFlow = ai.defineFlow(
  {
    name: 'analyzeChartDataFlow',
    inputSchema: AnalyzeChartDataInputSchema,
    outputSchema: AnalyzeChartDataOutputSchema,
  },
  async (input) => {
    if (input.suppliers.length === 0) {
      throw new Error("No supplier data provided for analysis.");
    }
    const { output } = await prompt(input);
    return output!;
  }
);
