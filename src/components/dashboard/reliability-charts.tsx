'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { ReliabilityData, Supplier } from '@/lib/types';

interface ReliabilityChartsProps {
  chartData: ReliabilityData;
  suppliers: Supplier[];
}

const formatters = {
  percent: (value: number) => `${(value * 100).toFixed(1)}%`,
  decimal: (value: number) => value.toFixed(4),
};

const CustomTooltip = ({ active, payload, label, title }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
          <div className="col-span-2 font-bold">{`Tempo: ${Math.round(label)}`}</div>
          {payload.map((entry: any, index: number) => (
             <React.Fragment key={`item-${index}`}>
               <div className="flex items-center gap-2 text-sm">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span>{`${entry.name}`}</span>
               </div>
               <div className="text-right font-mono text-sm">{entry.value.toFixed(4)}</div>
             </React.Fragment>
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
              <Tooltip content={<CustomTooltip title={title} />} wrapperClassName="!border-border !bg-background !shadow-lg" />
              <Legend wrapperStyle={{fontSize: "0.8rem"}} />
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
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {renderChart('Confiabilidade: R(t)', 'Probabilidade de funcionar corretamente até o tempo t.', 'Rt', 'monotone', [0, 1])}
      {renderChart('Probabilidade de Falha: F(t)', 'Probabilidade de falhar antes do tempo t.', 'Ft', 'monotone', [0, 1])}
      {renderChart('Densidade de Probabilidade: f(t)', 'Probabilidade relativa de falha no tempo t.', 'ft', 'monotone', ['auto', 'auto'])}
      {renderChart('Taxa de Falha: λ(t)', 'Probabilidade instantânea de falha no tempo t.', 'lambda_t', 'monotone', ['auto', 'auto'])}
    </div>
  );
}
