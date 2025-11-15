'use server';

/**
 * @fileOverview A reliability report generation AI agent.
 *
 * - generateReliabilityReport - A function that handles the reliability report generation process.
 * - GenerateReliabilityReportInput - The input type for the generateReliabilityReport function.
 * - GenerateReliabilityReportOutput - The return type for the generateReliabilityReport function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateReliabilityReportInputSchema = z.object({
  supplierNames: z.array(z.string()).describe('The names of the suppliers to include in the report.'),
  rtData: z.string().describe('The reliability function (R(t)) data for each supplier, as a JSON string.'),
  ftData: z.string().describe('The failure probability (F(t)) data for each supplier, as a JSON string.'),
  ftDensityData: z.string().describe('The probability density function (f(t)) data for each supplier, as a JSON string.'),
  lambdaTData: z.string().describe('The failure rate (λ(t)) data for each supplier, as a JSON string.'),
});
export type GenerateReliabilityReportInput = z.infer<typeof GenerateReliabilityReportInputSchema>;

const GenerateReliabilityReportOutputSchema = z.object({
  report: z.string().describe('A detailed report summarizing the reliability analysis for each supplier, including interpretations of the R(t), F(t), f(t), and λ(t) curves.'),
});
export type GenerateReliabilityReportOutput = z.infer<typeof GenerateReliabilityReportOutputSchema>;

export async function generateReliabilityReport(input: GenerateReliabilityReportInput): Promise<GenerateReliabilityReportOutput> {
  return generateReliabilityReportFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateReliabilityReportPrompt',
  input: {schema: GenerateReliabilityReportInputSchema},
  output: {schema: GenerateReliabilityReportOutputSchema},
  prompt: `You are an expert reliability engineer. You are provided with reliability data for several suppliers, and you must generate a detailed report summarizing the reliability analysis for each supplier. The report should include interpretations of the R(t), F(t), f(t), and λ(t) curves for each supplier, so that stakeholders can quickly understand the comparative reliability performance.

The suppliers to include in the report are: {{supplierNames}}

The reliability function (R(t)) data for each supplier is: {{rtData}}
The failure probability (F(t)) data for each supplier is: {{ftData}}
The probability density function (f(t)) data for each supplier is: {{ftDensityData}}
The failure rate (λ(t)) data for each supplier is: {{lambdaTData}}

Generate a comprehensive report that includes:
- A summary of each supplier's reliability performance based on the provided data.
- An interpretation of the R(t) curve for each supplier, explaining the probability of the component functioning correctly over time.
- An interpretation of the F(t) curve for each supplier, explaining the probability of failure before a specified time.
- An interpretation of the f(t) curve for each supplier, explaining the relative likelihood of a failure occurring at a specific time.
- An interpretation of the λ(t) curve for each supplier, explaining the instantaneous probability of failure at time t, given that the component has survived until that time.
- A comparative analysis of the suppliers' reliability performance, highlighting the strengths and weaknesses of each.
`,
});

const generateReliabilityReportFlow = ai.defineFlow(
  {
    name: 'generateReliabilityReportFlow',
    inputSchema: GenerateReliabilityReportInputSchema,
    outputSchema: GenerateReliabilityReportOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
