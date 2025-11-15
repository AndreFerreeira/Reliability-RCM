'use server';

/**
 * @fileOverview Summarizes the reliability performance of suppliers.
 *
 * - summarizeSupplierReliability - A function that generates a summary of supplier reliability.
 * - SummarizeSupplierReliabilityInput - The input type for the summarizeSupplierReliability function.
 * - SummarizeSupplierReliabilityOutput - The return type for the summarizeSupplierReliability function.
 */

import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {z} from 'genkit';

const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-1.5-flash-latest',
});

const SummarizeSupplierReliabilityInputSchema = z.object({
  supplierName: z.string().describe('The name of the supplier.'),
  failureRate: z.number().describe('The failure rate of the supplier.'),
  reliability: z.number().describe('The reliability of the supplier.'),
  failureProbability: z.number().describe('The failure probability of the supplier.'),
  probabilityDensity: z.number().describe('The probability density of the supplier.'),
});

export type SummarizeSupplierReliabilityInput = z.infer<
  typeof SummarizeSupplierReliabilityInputSchema
>;

const SummarizeSupplierReliabilityOutputSchema = z.object({
  summary: z.string().describe('A summary of the supplier reliability performance.'),
});

export type SummarizeSupplierReliabilityOutput = z.infer<
  typeof SummarizeSupplierReliabilityOutputSchema
>;

export async function summarizeSupplierReliability(
  input: SummarizeSupplierReliabilityInput
): Promise<SummarizeSupplierReliabilityOutput> {
  return summarizeSupplierReliabilityFlow(input);
}

const summarizeSupplierReliabilityPrompt = ai.definePrompt({
  name: 'summarizeSupplierReliabilityPrompt',
  input: {schema: SummarizeSupplierReliabilityInputSchema},
  output: {schema: SummarizeSupplierReliabilityOutputSchema},
  prompt: `You are a reliability engineer providing a summary of supplier reliability.

  Based on the provided metrics, generate a concise summary of the reliability performance for supplier {{supplierName}}, highlighting key metrics and potential areas of concern. Metrics:

  - Failure Rate: {{failureRate}}
  - Reliability: {{reliability}}
  - Failure Probability: {{failureProbability}}
  - Probability Density: {{probabilityDensity}}`,
});

const summarizeSupplierReliabilityFlow = ai.defineFlow(
  {
    name: 'summarizeSupplierReliabilityFlow',
    inputSchema: SummarizeSupplierReliabilityInputSchema,
    outputSchema: SummarizeSupplierReliabilityOutputSchema,
  },
  async input => {
    const {output} = await summarizeSupplierReliabilityPrompt(input);
    return output!;
  }
);
