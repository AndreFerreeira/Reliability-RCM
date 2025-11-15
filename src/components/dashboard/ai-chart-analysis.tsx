'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getChartAnalysis } from '@/actions/reliability';
import type { Supplier } from '@/lib/types';
import { Bot, Loader2, BarChart } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import type { AnalyzeChartDataOutput } from '@/ai/flows/analyze-chart-data';

interface AiChartAnalysisProps {
  suppliers: Supplier[];
}

type ChartAnalysisResult = AnalyzeChartDataOutput | { error?: string };

export default function AiChartAnalysis({ suppliers }: AiChartAnalysisProps) {
  const [isPending, startTransition] = useTransition();
  const [analysis, setAnalysis] = useState<ChartAnalysisResult | null>(null);

  const handleGenerateAnalysis = () => {
    startTransition(async () => {
      setAnalysis(null);
      const result = await getChartAnalysis(suppliers);
      setAnalysis(result);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart className="h-6 w-6" />
          AI Chart Analysis
        </CardTitle>
        <CardDescription>
          Generate a detailed technical analysis for each of the reliability charts below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleGenerateAnalysis} disabled={isPending || suppliers.length === 0}>
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Bot className="mr-2 h-4 w-4" />
          )}
          Analyze Charts
        </Button>

        {isPending && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p>Generating detailed analysis... This may take a moment.</p>
          </div>
        )}
        
        {analysis && 'error' in analysis && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{analysis.error}</AlertDescription>
          </Alert>
        )}

        {analysis && 'reliability' in analysis && (
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>Reliability: R(t) Analysis</AccordionTrigger>
              <AccordionContent>
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                  {analysis.reliability}
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>Failure Probability: F(t) Analysis</AccordionTrigger>
              <AccordionContent>
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                  {analysis.failureProbability}
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>Probability Density: f(t) Analysis</AccordionTrigger>
              <AccordionContent>
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                  {analysis.probabilityDensity}
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4">
              <AccordionTrigger>Failure Rate: λ(t) Analysis</AccordionTrigger>
              <AccordionContent>
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                  {analysis.failureRate}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}
