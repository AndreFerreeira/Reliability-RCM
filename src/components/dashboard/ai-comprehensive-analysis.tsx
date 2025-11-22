'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getChartAnalysis } from '@/actions/reliability';
import type { Supplier, AnalyzeChartDataOutput, ReliabilityData, ChartDataPoint, Distribution, WeibullParams, NormalParams, LognormalParams, ExponentialParams } from '@/lib/types';
import { Bot, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { marked } from 'marked';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import React from 'react';

interface AiComprehensiveAnalysisProps {
  suppliers: Supplier[];
  chartData: ReliabilityData;
}

type AnalysisResult = AnalyzeChartDataOutput | { error?: string };

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <div className="font-bold mb-2 text-foreground">{`Tempo: ${Math.round(label)}`}</div>
          <div className="grid gap-1.5">
            {payload.map((entry: any, index: number) => (
               <div key={`item-${index}`} className="flex items-center justify-between gap-4 text-sm">
                 <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-muted-foreground">{`${entry.name}`}</span>
                 </div>
                 <span className="font-mono font-medium text-foreground">{entry.value.toFixed(4)}</span>
               </div>
            ))}
          </div>
      </div>
    );
  }

  return null;
};

const MiniChart = ({ data, suppliers }: { data: ChartDataPoint[], suppliers: Supplier[] }) => (
    <div className="h-48 w-full mb-4">
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="2 2" strokeOpacity={0.5} />
                <XAxis 
                    dataKey="time" 
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                    tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                    height={20}
                    tickFormatter={(val) => Math.round(val).toString()}
                />
                <YAxis
                    domain={['auto', 'auto']}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                    tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                    width={40}
                    tickFormatter={(val) => typeof val === 'number' ? val.toPrecision(1) : val}
                />
                <Tooltip content={<CustomTooltip />} wrapperClassName="!border-border !bg-background !shadow-lg" />
                {suppliers.map(supplier => (
                    <Line
                        key={supplier.id}
                        type="monotone"
                        dataKey={supplier.name}
                        stroke={supplier.color}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                    />
                ))}
            </LineChart>
        </ResponsiveContainer>
    </div>
);


export default function AiComprehensiveAnalysis({ suppliers, chartData }: AiComprehensiveAnalysisProps) {
  const [isPending, startTransition] = useTransition();
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  const handleAnalyze = () => {
    startTransition(async () => {
      setAnalysis(null);
      const analysisInput = {
        suppliers: suppliers.map(({ name, distribution, params }) => ({
          name,
          distribution,
          params
        })),
      };
      // @ts-ignore
      const result = await getChartAnalysis(analysisInput);
      setAnalysis(result);
    });
  };

  const hasAnalysis = analysis && 'reliability' in analysis;
  const analysisItems = hasAnalysis ? [
    { key: 'reliability', data: chartData.Rt, ...analysis.reliability },
    { key: 'failureProbability', data: chartData.Ft, ...analysis.failureProbability },
    { key: 'probabilityDensity', data: chartData.ft, ...analysis.probabilityDensity },
    { key: 'failureRate', data: chartData.lambda_t, ...analysis.failureRate },
  ] : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Relatório Abrangente com IA</CardTitle>
        <CardDescription>
          Gere uma análise técnica detalhada comparando todos os equipamentos nos quatro principais gráficos de confiabilidade.
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
            Gerar Análise Abrangente
          </Button>
          {suppliers.length === 0 && <p className="text-sm text-muted-foreground">Adicione dados de equipamentos para habilitar a análise.</p>}
        </div>

        {isPending && (
          <div className="flex items-center justify-center gap-3 text-lg text-muted-foreground py-10">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p>Gerando análise comparativa... Isso pode levar um momento.</p>
          </div>
        )}

        {analysis && 'error' in analysis && (
          <Alert variant="destructive">
            <AlertTitle>Erro na Análise</AlertTitle>
            <AlertDescription>{analysis.error}</AlertDescription>
          </Alert>
        )}

        {hasAnalysis && (
          <div className="space-y-4">
            <Alert>
              <Bot className="h-4 w-4" />
              <AlertTitle>Análise da IA Concluída</AlertTitle>
              <AlertDescription>
                Abaixo está uma análise técnica para cada gráfico, comparando o desempenho dos equipamentos selecionados.
              </AlertDescription>
            </Alert>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {analysisItems.map((item, index) => (
                    <Card key={index} className="flex flex-col">
                        <CardHeader>
                           <CardTitle className="text-lg">{item.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col">
                            <MiniChart data={item.data} suppliers={suppliers} />
                            <div 
                             className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-headings:text-foreground prose-strong:text-foreground prose-ul:pl-4" 
                             dangerouslySetInnerHTML={{ __html: marked.parse(item.analysis) as string }} 
                           />
                        </CardContent>
                    </Card>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
