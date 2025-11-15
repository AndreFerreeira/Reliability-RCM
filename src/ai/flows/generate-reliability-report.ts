'use server';

/**
 * @fileOverview A reliability report generation AI agent.
 *
 * - generateReliabilityReport - A function that handles the reliability report generation process.
 * - GenerateReliabilityReportInput - The input type for the generateReliabilityReport function.
 * - GenerateReliabilityReportOutput - The return type for the generateReliabilityReport function.
 */

import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {z} from 'genkit';

const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-1.5-flash-latest',
});

const GenerateReliabilityReportInputSchema = z.object({
  supplierData: z.array(z.object({
    name: z.string(),
    beta: z.number().describe('The Weibull shape parameter (β).'),
    eta: z.number().describe('The Weibull scale parameter (η).'),
  })).describe('An array of supplier reliability data based on Weibull parameters.'),
});
export type GenerateReliabilityReportInput = z.infer<typeof GenerateReliabilityReportInputSchema>;

const GenerateReliabilityReportOutputSchema = z.object({
  report: z.string().describe('A detailed report summarizing the reliability analysis for each supplier, including interpretations of what the Weibull beta and eta parameters imply for each.'),
});
export type GenerateReliabilityReportOutput = z.infer<typeof GenerateReliabilityReportOutputSchema>;

export async function generateReliabilityReport(input: GenerateReliabilityReportInput): Promise<GenerateReliabilityReportOutput> {
  return generateReliabilityReportFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateReliabilityReportPrompt',
  input: {schema: GenerateReliabilityReportInputSchema},
  output: {schema: GenerateReliabilityReportOutputSchema},
  prompt: `You are an expert reliability engineer. You are provided with Weibull parameters (beta for shape, eta for scale) for several suppliers. Generate a detailed report summarizing the reliability analysis.

The supplier data is:
{{#each supplierData}}
- Supplier: {{name}}
  - Beta (β - Shape Parameter): {{beta}}
  - Eta (η - Scale Parameter/Characteristic Life): {{eta}}
{{/each}}

Generate a comprehensive report that includes:
- A summary of each supplier's reliability performance based on their Weibull parameters.
- An interpretation of the Beta (β) value for each supplier:
  - If β < 1, it indicates early life failures (infant mortality). The failure rate is decreasing over time.
  - If β = 1, it indicates random failures (useful life). The failure rate is constant. This corresponds to the exponential distribution.
  - If β > 1, it indicates wear-out failures (end-of-life). The failure rate is increasing over time.
- An interpretation of the Eta (η) value for each supplier. Eta represents the 'characteristic life', which is the time at which 63.2% of the components are expected to have failed. A higher η value generally indicates a longer-lasting component.
- A comparative analysis of the suppliers' reliability, highlighting the most and least reliable suppliers based on these parameters and explaining why. Make a recommendation.
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
