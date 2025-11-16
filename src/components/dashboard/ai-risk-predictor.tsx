'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getRiskFactors } from '@/actions/reliability';
import type { Supplier } from '@/lib/types';
import type { PredictFailureRiskFactorsOutput } from '@/lib/types';
import { Bot, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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

  const hasAnalysis = analysis && 'riskFactors' in analysis;
  const riskFactors = hasAnalysis ? analysis.riskFactors : [];

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
            {suppliers.length === 0 && <p className="text-sm text-muted-foreground">Adicione dados de fornecedores para habilitar a previsão.</p>}
        </div>

        {isPending && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p>Analisando dados históricos... Isso pode levar um momento.</p>
          </div>
        )}

        {analysis && 'error' in analysis && (
          <Alert variant="destructive">
            <AlertTitle>Erro na Análise</AlertTitle>
            <AlertDescription>{analysis.error}</AlertDescription>
          </Alert>
        )}

        {hasAnalysis && (
          <div className="space-y-6">
            <Alert>
              <Bot className="h-4 w-4" />
              <AlertTitle>Resumo da Análise de Risco</AlertTitle>
              <AlertDescription className="text-muted-foreground">
                <div className="whitespace-pre-wrap">
                  {analysis.summary}
                </div>
              </AlertDescription>
            </Alert>
            
            <div className="space-y-4">
                <h3 className="text-lg font-semibold tracking-tight">Fatores de Risco Identificados</h3>
                {riskFactors.length === 0 ? (
                    <Card className="flex flex-col justify-center items-center h-32">
                        <p className="text-muted-foreground text-sm">Nenhum fator de risco significativo foi identificado.</p>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {riskFactors.map((factor, index) => (
                            <Card key={index} className="flex flex-col justify-between">
                                <CardHeader className="pb-4">
                                    <CardDescription>Fator de Risco #{index + 1}</CardDescription>
                                    <CardTitle className="text-base">{factor.factor}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-medium text-muted-foreground">IMPORTÂNCIA</span>
                                            <span className="text-lg font-bold text-primary">{(factor.importance * 100).toFixed(0)}%</span>
                                        </div>
                                        <Progress value={factor.importance * 100} aria-label={`Importância de ${factor.factor} é ${(factor.importance * 100).toFixed(0)}%`} />
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
