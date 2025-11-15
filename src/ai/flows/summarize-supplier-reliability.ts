'use server';

/**
 * @fileOverview Summarizes the reliability performance of a single supplier.
 *
 * - summarizeSupplierReliability - A function that generates a reliability summary for a supplier.
 */

import { ai } from '@/ai/genkit';
import {
  SummarizeSupplierReliabilityInputSchema,
  type SummarizeSupplierReliabilityInput,
  SummarizeSupplierReliabilityOutputSchema,
  type SummarizeSupplierReliabilityOutput,
} from '@/lib/types';

export async function summarizeSupplierReliability(
  input: SummarizeSupplierReliabilityInput
): Promise<SummarizeSupplierReliabilityOutput> {
  return summarizeSupplierReliabilityFlow(input);
}

const summarizeSupplierReliabilityPrompt = ai.definePrompt({
  name: 'summarizeSupplierReliabilityPrompt',
  input: {schema: SummarizeSupplierReliabilityInputSchema},
  output: {schema: SummarizeSupplierReliabilityOutputSchema},
  prompt: `You are a reliability engineer providing a detailed analysis of a supplier's reliability based on their Weibull parameters.

  Supplier: {{supplierName}}
  - Beta (β - Shape Parameter): {{beta}}
  - Eta (η - Scale Parameter / Characteristic Life): {{eta}}

  Based on these parameters, generate a detailed summary of the reliability performance for this supplier. Explain:
  1.  What the Beta (β) value means in terms of failure mode (e.g., infant mortality, wear-out, random failures).
  2.  What the Eta (η) value represents (the time at which 63.2% of the population will have failed).
  3.  Provide an overall assessment of the supplier's reliability based on these two key metrics. Be technical and specific.`,
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
