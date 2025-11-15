'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getRiskFactors } from '@/actions/reliability';
import type { Supplier } from '@/lib/types';
import type { PredictFailureRiskFactorsOutput } from '@/ai/flows/predict-failure-risk-factors';
import { Bot, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';

interface AiRiskPredictorProps {
  suppliers: Supplier[];
}

type RiskAnalysisResult = PredictFailureRiskFactorsOutput | { error?: string };

export default function AiRiskPredictor({ suppliers }: AiRiskPredictorProps) {
  const [isPending, startTransition] = useTransition();
  const [analysis, setAnalysis] = useState<RiskAnalysisResult | null>(null);

  const handlePredictRisk = () => {
    startTransition(async () => {
      setAnalysis(null);
      const result = await getRiskFactors(suppliers);
      setAnalysis(result);
    });
  };

  const riskFactors = analysis && 'riskFactors' in analysis ? analysis.riskFactors : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Previsor de Risco de Falha com IA</CardTitle>
        <CardDescription>
          Use dados históricos de falha para identificar os fatores de risco mais significativos que contribuem para falhas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <Button onClick={handlePredictRisk} disabled={isPending || suppliers.length === 0}>
            {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Bot className="mr-2 h-4 w-4" />
            )}
            Prever Fatores de Risco
            </Button>
            {suppliers.length === 0 && <p className="text-sm text-muted-foreground">Adicione dados de fornecedores na aba de análise para habilitar a previsão.</p>}
        </div>

        {isPending && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p>Analisando dados históricos... Isso pode levar um momento.</p>
          </div>
        )}

        {analysis && 'error' in analysis && (
          <Alert variant="destructive">
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{analysis.error}</AlertDescription>
          </Alert>
        )}

        {analysis && 'summary' in analysis && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Análise de Fatores de Risco</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50%]">Fator</TableHead>
                      <TableHead>Importância</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {riskFactors.length === 0 && <TableRow><TableCell colSpan={2} className="text-center">Nenhum fator de risco significativo identificado.</TableCell></TableRow>}
                    {riskFactors.map((factor, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{factor.factor}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={factor.importance * 100} className="w-[60%]" />
                            <span>{(factor.importance * 100).toFixed(0)}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Alert>
              <Bot className="h-4 w-4" />
              <AlertTitle>Resumo da IA</AlertTitle>
              <AlertDescription>
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                  {analysis.summary}
                </div>
              </AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
