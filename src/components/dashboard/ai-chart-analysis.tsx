'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getChartAnalysis } from '@/actions/reliability';
import type { Supplier } from '@/lib/types';
import type { AnalyzeChartDataOutput } from '@/ai/flows/analyze-chart-data';
import { Bot, Loader2, FileText, Activity, AlertTriangle, TrendingUp } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface AiChartAnalysisProps {
  suppliers: Supplier[];
}

type AnalysisResult = AnalyzeChartDataOutput | { error?: string };

const iconMap = {
  reliability: <TrendingUp className="h-5 w-5 text-green-500" />,
  failureProbability: <AlertTriangle className="h-5 w-5 text-red-500" />,
  probabilityDensity: <Activity className="h-5 w-5 text-blue-500" />,
  failureRate: <FileText className="h-5 w-5 text-yellow-500" />,
};

export default function AiChartAnalysis({ suppliers }: AiChartAnalysisProps) {
  const [isPending, startTransition] = useTransition();
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  const handleAnalyzeCharts = () => {
    startTransition(async () => {
      setAnalysis(null);
      const result = await getChartAnalysis(suppliers);
      setAnalysis(result);
    });
  };

  const analysisSections = analysis && 'reliability' in analysis ? analysis : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Chart Analysis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <Button onClick={handleAnalyzeCharts} disabled={isPending || suppliers.length === 0}>
            {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Bot className="mr-2 h-4 w-4" />
            )}
            Analyze Charts
            </Button>
            {suppliers.length === 0 && <p className="text-sm text-muted-foreground">Add supplier data to enable analysis.</p>}
        </div>

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

        {analysisSections && (
            <Accordion type="multiple" className="w-full space-y-2">
                {Object.entries(analysisSections).map(([key, value]) => (
                    <AccordionItem value={key} key={key} className="rounded-md border bg-card/50 px-4">
                        <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                           <div className='flex items-center gap-3'>
                             {iconMap[key as keyof typeof iconMap]}
                             {value.title}
                           </div>
                        </AccordionTrigger>
                        <AccordionContent>
                           <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap pt-4">
                            {value.analysis}
                           </div>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        )}
      </CardContent>
    </Card>
  );
}
