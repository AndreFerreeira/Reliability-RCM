'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { ReliabilityData, Supplier } from '@/lib/types';
import { BathtubCurveIcon, PFCurveIcon } from '@/components/icons';

interface ReliabilityChartsProps {
  chartData: ReliabilityData;
  suppliers: Supplier[];
}

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
  

export default function ReliabilityCharts({ chartData, suppliers }: ReliabilityChartsProps) {
  const hasData = suppliers.length > 0;

  const renderChart = (title: string, description: string, dataKey: keyof ReliabilityData, lineType: 'step' | 'monotone', yDomain: any, tickFormatter?: (value: any) => string) => (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData[dataKey]} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="time" 
                type="number" 
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                domain={['dataMin', 'dataMax']} 
                name="Time" 
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                domain={yDomain} 
                tickFormatter={tickFormatter}
              />
              <Tooltip content={<CustomTooltip />} wrapperClassName="!border-border !bg-background !shadow-lg" />
              <Legend wrapperStyle={{fontSize: "0.8rem"}} iconType="line" />
              {suppliers.map(supplier => (
                <Line
                  key={supplier.id}
                  type={lineType}
                  dataKey={supplier.name}
                  stroke={supplier.color}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Adicione dados de fornecedor para ver os gráficos.
          </div>
        )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {renderChart('Confiabilidade: R(t)', 'Probabilidade de funcionar corretamente até o tempo t.', 'Rt', 'monotone', [0, 1])}
        {renderChart('Probabilidade de Falha: F(t)', 'Probabilidade de falhar antes do tempo t.', 'Ft', 'monotone', [0, 1])}
        {renderChart('Densidade de Probabilidade: f(t)', 'Probabilidade relativa de falha no tempo t.', 'ft', 'monotone', ['auto', 'auto'])}
        {renderChart('Taxa de Falha: λ(t)', 'Probabilidade instantânea de falha no tempo t.', 'lambda_t', 'monotone', ['auto', 'auto'])}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
            <CardHeader>
                <CardTitle>Guia da Curva P-F</CardTitle>
                <CardDescription>Entendendo o intervalo entre a falha potencial e a funcional.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-card border flex items-center justify-center">
                    <PFCurveIcon className="w-full h-auto max-w-md" />
                </div>
                <div className="text-sm text-muted-foreground space-y-2 prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-strong:text-foreground">
                    <p>A Curva P-F ilustra a jornada de um ativo desde a detecção de uma <strong>Falha Potencial (P)</strong> até sua <strong>Falha Funcional (F)</strong>. O objetivo é atuar neste intervalo.</p>
                    <p>Ao analisar o gráfico de <strong>Taxa de Falha λ(t)</strong>, você pode identificar o ponto onde a taxa começa a aumentar (início da zona de desgaste). Isso se correlaciona com o "Início da Falha" na Curva P-F, indicando que é hora de intensificar o monitoramento (ultrassom, vibração) para detectar a falha potencial e planejar a manutenção antes que ela se torne crítica e cara.</p>
                </div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle>Guia da Curva da Banheira</CardTitle>
                <CardDescription>Interpretando a vida útil de um componente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-card border flex items-center justify-center">
                    <BathtubCurveIcon className="w-full h-auto max-w-md" />
                </div>
                <div className="text-sm text-muted-foreground space-y-2 prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-strong:text-foreground prose-ul:pl-5">
                    <p>A Curva da Banheira mostra como a taxa de falha de um componente se comporta ao longo do tempo. Use o gráfico <strong>Taxa de Falha λ(t)</strong> para identificar em qual fase seu componente se encontra:</p>
                    <ul className="space-y-1">
                        <li><strong>Mortalidade Infantil:</strong> Taxa de falha decrescente. Falhas prematuras devido a defeitos de fabricação.</li>
                        <li><strong>Vida Útil:</strong> Taxa de falha constante e baixa. Falhas ocorrem de forma aleatória.</li>
                        <li><strong>Desgaste:</strong> Taxa de falha crescente. Falhas ocorrem por envelhecimento e uso.</li>
                    </ul>
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
