'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getSupplierSummary } from '@/actions/reliability';
import type { Supplier, SummarizeSupplierReliabilityOutput } from '@/lib/types';
import { Bot, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface AiChartAnalysisProps {
  suppliers: Supplier[];
}

type AnalysisResult = ({ supplierId: string } & SummarizeSupplierReliabilityOutput) | { supplierId: string, error?: string };

export default function AiChartAnalysis({ suppliers }: AiChartAnalysisProps) {
  const [isPending, startTransition] = useTransition();
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  const handleAnalyzeSupplier = (supplier: Supplier) => {
    startTransition(async () => {
      setAnalysis({ supplierId: supplier.id }); // To show loader for this specific supplier
      const result = await getSupplierSummary({
        supplierName: supplier.name,
        beta: supplier.beta,
        eta: supplier.eta,
      });
      setAnalysis({ supplierId: supplier.id, ...result });
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Supplier Analysis</CardTitle>
        <CardDescription>Get a detailed reliability summary for each supplier.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {suppliers.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Add supplier data to get an analysis.</p>}
        {suppliers.map(supplier => (
            <div key={supplier.id} className="rounded-md border p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-8 rounded-full" style={{ backgroundColor: supplier.color }} />
                        <span className="font-semibold text-lg">{supplier.name}</span>
                    </div>
                    <Button 
                        onClick={() => handleAnalyzeSupplier(supplier)} 
                        disabled={isPending}
                        size="sm"
                    >
                    {isPending && analysis?.supplierId === supplier.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Bot className="mr-2 h-4 w-4" />
                    )}
                    Analyze
                    </Button>
                </div>
                {analysis?.supplierId === supplier.id && (
                    <div className='pt-4 border-t'>
                        {isPending ? (
                             <div className="flex items-center gap-2 text-muted-foreground">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                <p>Generating analysis...</p>
                            </div>
                        ) : 'error' in analysis && analysis.error ? (
                            <Alert variant="destructive">
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>{analysis.error}</AlertDescription>
                            </Alert>
                        ) : 'summary' in analysis && analysis.summary ? (
                            <Alert>
                                <Bot className="h-4 w-4" />
                                <AlertTitle>AI Reliability Summary</AlertTitle>
                                <AlertDescription>
                                    <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                                        {analysis.summary}
                                    </div>

                                </AlertDescription>
                            </Alert>
                        ) : null}
                    </div>
                )}
            </div>
        ))}
      </CardContent>
    </Card>
  );
}
