'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { getChartAnalysis } from '@/actions/reliability';
import type { Supplier, AnalyzeChartDataOutput } from '@/lib/types';
import { Bot, Loader2, BarChart } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface AiComprehensiveAnalysisProps {
  suppliers: Supplier[];
}

type AnalysisResult = AnalyzeChartDataOutput | { error?: string };

export default function AiComprehensiveAnalysis({ suppliers }: AiComprehensiveAnalysisProps) {
  const [isPending, startTransition] = useTransition();
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  const handleAnalyze = () => {
    startTransition(async () => {
      setAnalysis(null);
      const analysisInput = {
        suppliers: suppliers.map(({ name, beta, eta }) => ({ name, beta, eta })),
      };
      const result = await getChartAnalysis(analysisInput);
      setAnalysis(result);
    });
  };

  const analysisItems = analysis && 'reliability' in analysis ? [
    analysis.reliability,
    analysis.failureProbability,
    analysis.probabilityDensity,
    analysis.failureRate,
  ] : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Comprehensive Report</CardTitle>
        <CardDescription>
          Generate a detailed technical analysis comparing all suppliers across the four key reliability charts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Button onClick={handleAnalyze} disabled={isPending || suppliers.length === 0}>
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Bot className="mr-2 h-4 w-4" />
            )}
            Generate Comprehensive Analysis
          </Button>
          {suppliers.length === 0 && <p className="text-sm text-muted-foreground">Add supplier data to enable analysis.</p>}
        </div>

        {isPending && (
          <div className="flex items-center justify-center gap-3 text-lg text-muted-foreground py-10">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p>Generating comparative analysis... This may take a moment.</p>
          </div>
        )}

        {analysis && 'error' in analysis && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{analysis.error}</AlertDescription>
          </Alert>
        )}

        {analysis && 'reliability' in analysis && (
          <div className="space-y-4">
            <Alert>
              <Bot className="h-4 w-4" />
              <AlertTitle>AI Analysis Complete</AlertTitle>
              <AlertDescription>
                Below is a detailed technical breakdown for each reliability chart, comparing the performance of all selected suppliers.
              </AlertDescription>
            </Alert>
            <Accordion type="single" collapsible defaultValue={analysisItems[0].title}>
                {analysisItems.map((item, index) => (
                    <AccordionItem value={item.title} key={index}>
                        <AccordionTrigger>
                            <div className='flex items-center gap-2'>
                                <BarChart className='h-5 w-5 text-primary' />
                                <span className='text-base font-semibold'>{item.title}</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                           <div 
                             className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-headings:text-foreground prose-strong:text-foreground" 
                             dangerouslySetInnerHTML={{ __html: item.analysis.replace(/\n/g, '<br />') }} 
                           />
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
