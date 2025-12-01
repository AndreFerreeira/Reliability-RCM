'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { ReliabilityData, Supplier } from '@/lib/types';

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

  const renderChart = (title: string, description: string, dataKey: keyof ReliabilityData, yDomain: any) => (
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
                tickFormatter={(tick) => {
                    if (tick >= 1000) return `${(tick / 1000).toPrecision(2)}k`;
                    return tick.toPrecision(2);
                }}
              />
              <Tooltip content={<CustomTooltip />} wrapperClassName="!border-border !bg-background !shadow-lg" />
              <Legend wrapperStyle={{fontSize: "0.8rem"}} iconType="line" />
              <Brush 
                dataKey="time" 
                height={20} 
                stroke="hsl(var(--primary))"
                fill="hsl(var(--background))"
                travellerWidth={10}
                y={60}
              />
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
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Adicione dados do equipamento para ver os gráficos.
          </div>
        )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {renderChart('Confiabilidade: R(t)', 'Probabilidade de funcionar corretamente até o tempo t.', 'Rt', [0, 1])}
        {renderChart('Probabilidade de Falha: F(t)', 'Probabilidade de falhar antes do tempo t.', 'Ft', [0, 1])}
        {renderChart('Densidade de Probabilidade: f(t)', 'Probabilidade relativa de falha no tempo t.', 'ft', [0, 'dataMax * 1.2'])}
        {renderChart('Taxa de Falha: λ(t)', 'Probabilidade instantânea de falha no tempo t.', 'lambda_t', [0, 'dataMax * 1.2'])}
      </div>
    </div>
  );
}
