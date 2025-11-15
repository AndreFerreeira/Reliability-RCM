'use server';

/**
 * @fileOverview Analyzes reliability chart data for multiple suppliers.
 *
 * - analyzeChartData - A function that generates a detailed analysis for each reliability metric.
 * - AnalyzeChartDataInput - The input type for the analyzeChartData function.
 * - AnalyzeChartDataOutput - The return type for the analyzeChartData function.
 */

import { ai } from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeChartDataInputSchema = z.object({
  supplierData: z.array(z.object({
    name: z.string(),
    beta: z.number().describe('The Weibull shape parameter (β).'),
    eta: z.number().describe('The Weibull scale parameter (η).'),
  })).describe('An array of supplier reliability data based on Weibull parameters.'),
});
export type AnalyzeChartDataInput = z.infer<typeof AnalyzeChartDataInputSchema>;

const AnalyzeChartDataOutputSchema = z.object({
  reliability: z.string().describe('Detailed analysis of the Reliability Curve R(t).'),
  failureProbability: z.string().describe('Detailed analysis of the Failure Probability Curve F(t).'),
  probabilityDensity: z.string().describe('Detailed analysis of the Probability Density Function f(t).'),
  failureRate: z.string().describe('Detailed analysis of the Failure Rate Curve λ(t).'),
});
export type AnalyzeChartDataOutput = z.infer<typeof AnalyzeChartDataOutputSchema>;

export async function analyzeChartData(input: AnalyzeChartDataInput): Promise<AnalyzeChartDataOutput> {
  return analyzeChartDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeChartDataPrompt',
  input: {schema: AnalyzeChartDataInputSchema},
  output: {schema: AnalyzeChartDataOutputSchema},
  prompt: `You are an expert reliability engineer. You are provided with Weibull parameters (beta for shape, eta for scale) for several suppliers.

The supplier data is:
{{#each supplierData}}
- Supplier: {{name}}
  - Beta (β - Shape Parameter): {{beta}}
  - Eta (η - Scale Parameter/Characteristic Life): {{eta}}
{{/each}}

Generate a detailed, comparative analysis for each of the following reliability metrics. For each metric, explain what the chart represents and then compare the suppliers based on their curves, referencing their specific beta and eta values to support your analysis.

1.  **Reliability Curve R(t) - Probability of Survival:**
    - Explain that this chart shows the probability that a component will still be functioning at time 't'. A higher curve is better.
    - Compare how quickly each supplier's reliability drops. A steeper drop indicates a shorter reliable life. Relate this to their eta values.

2.  **Failure Probability Curve F(t) - Cumulative Failure:**
    - Explain that this chart shows the probability that a component will have failed by time 't'. It is the inverse of R(t). A lower curve is better.
    - Compare how quickly the probability of failure rises for each supplier.

3.  **Probability Density Function f(t) - Likelihood of Failure:**
    - Explain that this chart shows the relative likelihood of failure at a specific time 't'. The peak of the curve indicates the most likely time of failure.
    - Compare the peaks for each supplier. A peak that is further to the right indicates a longer time to the most probable failure. A more spread-out curve indicates more variability in failure times.

4.  **Failure Rate Curve λ(t) - Hazard Rate:**
    - Explain that this chart shows the instantaneous rate of failure at time 't', given that the component has survived up to that time. The shape is determined by Beta (β).
    - Analyze the shape of the curve for each supplier based on their β value:
      - β < 1: Decreasing failure rate (infant mortality).
      - β = 1: Constant failure rate (random failures).
      - β > 1: Increasing failure rate (wear-out failures).
    - Compare the failure rate trends for the suppliers.
`,
});

const analyzeChartDataFlow = ai.defineFlow(
  {
    name: 'analyzeChartDataFlow',
    inputSchema: AnalyzeChartDataInputSchema,
    outputSchema: AnalyzeChartDataOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
