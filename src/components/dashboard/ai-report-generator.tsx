'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getReliabilityReport } from '@/actions/reliability';
import type { ReliabilityData, Supplier } from '@/lib/types';
import { Bot, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface AiReportGeneratorProps {
  suppliers: Supplier[];
  chartData: ReliabilityData;
}

export default function AiReportGenerator({ suppliers, chartData }: AiReportGeneratorProps) {
  const [isPending, startTransition] = useTransition();
  const [report, setReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateReport = () => {
    startTransition(async () => {
      setError(null);
      setReport(null);
      const result = await getReliabilityReport(suppliers, chartData);
      if (result.startsWith('Failed')) {
        setError(result);
      } else {
        setReport(result);
      }
    });
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI-Powered Analysis</CardTitle>
        <CardDescription>
          Generate a detailed reliability report with interpretations of the curves using AI.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleGenerateReport} disabled={isPending || suppliers.length === 0}>
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Bot className="mr-2 h-4 w-4" />
          )}
          Generate AI Report
        </Button>

        {isPending && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p>Generating report... This may take a moment.</p>
          </div>
        )}
        
        {error && <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

        {report && (
          <Alert>
            <Bot className="h-4 w-4" />
            <AlertTitle>AI Reliability Report</AlertTitle>
            <AlertDescription>
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                {report}
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
