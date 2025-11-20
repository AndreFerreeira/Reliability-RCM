'use client';
import { useMemo } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Label } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Supplier } from '@/lib/types';

interface ProbabilityPlotProps {
    suppliers: Supplier[];
    paperType: 'Weibull' | 'Lognormal' | 'Normal' | 'Exponential';
}

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="rounded-lg border bg-background p-2 shadow-sm text-xs">
                <p className="font-bold mb-1" style={{color: payload[0].color}}>{data.name}</p>
                <p><span className="font-medium">Tempo:</span> {data.time.toFixed(2)}</p>
                <p><span className="font-medium">Prob. Falha (F(t)):</span> {(data.prob * 100).toFixed(2)}%</p>
            </div>
        );
    }
    return null;
};


const transformData = (suppliers: Supplier[], paperType: 'Weibull' | 'Lognormal' | 'Normal' | 'Exponential') => {
    return suppliers.flatMap(supplier => {
        const sortedTimes = [...supplier.failureTimes].sort((a, b) => a - b);
        const n = sortedTimes.length;
        if (n === 0) return [];

        return sortedTimes.map((time, i) => {
            const order = i + 1;
            const medianRank = (order - 0.3) / (n + 0.4);
            if (medianRank >= 1) return null;

            let x: number | null = null;
            let y: number | null = null;

            switch (paperType) {
                case 'Weibull':
                    x = time > 0 ? Math.log(time) : null;
                    y = Math.log(Math.log(1 / (1 - medianRank)));
                    break;
                // Add cases for other paper types here in the future
                case 'Normal':
                case 'Lognormal':
                case 'Exponential':
                default:
                    // For now, we only implement Weibull plot
                    return null;
            }

            if (x === null || !isFinite(x) || y === null || !isFinite(y)) return null;

            return {
                x,
                y,
                time,
                prob: medianRank,
                name: supplier.name,
                color: supplier.color,
            };
        }).filter(p => p !== null);
    });
};

const tickFormatter = (value: number) => {
    const originalValue = Math.exp(value);
    if (originalValue < 10) return originalValue.toPrecision(2);
    return Math.round(originalValue);
}

export default function ProbabilityPlot({ suppliers, paperType }: ProbabilityPlotProps) {
    const plotData = useMemo(() => transformData(suppliers, paperType), [suppliers, paperType]);
    
    if (paperType !== 'Weibull') {
         return (
            <Card>
                <CardHeader>
                    <CardTitle>Visualização de Papel de Probabilidade {paperType}</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center h-64">
                    <p className="text-muted-foreground">Gráfico para {paperType} ainda não implementado.</p>
                </CardContent>
            </Card>
        );
    }

    if (suppliers.length === 0 || plotData.length === 0) {
       return (
            <Card>
                <CardHeader>
                    <CardTitle>Visualização de Papel de Probabilidade</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center h-64">
                    <p className="text-muted-foreground">Adicione dados de fornecedores para visualizar o gráfico de probabilidade.</p>
                </CardContent>
            </Card>
        );
    }
    
    const suppliersToPlot = [...new Set(plotData.map(d => d.name))];
    const supplierColors = suppliers.reduce((acc, s) => ({ ...acc, [s.name]: s.color }), {} as Record<string, string>);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Visualização Dinâmica - Papel Weibull</CardTitle>
                <CardDescription>
                   Pontos de falha plotados em eixos transformados. Dados que seguem uma distribuição Weibull se alinharão como uma reta.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-96 w-full pr-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 30 }}>
                             <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />

                            <XAxis 
                                type="number" 
                                dataKey="x" 
                                name="Tempo" 
                                domain={['dataMin', 'dataMax']}
                                scale="log"
                                tickFormatter={tickFormatter}
                                stroke="hsl(var(--muted-foreground))"
                                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                            >
                                <Label value="Tempo (t)" offset={-25} position="insideBottom" fill="hsl(var(--foreground))" />
                            </XAxis>

                            <YAxis 
                                type="number" 
                                dataKey="y" 
                                name="Probabilidade de Falha"
                                allowDuplicatedCategory={false}
                                stroke="hsl(var(--muted-foreground))"
                                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                            >
                                <Label value="ln(ln(1/(1-F(t))))" angle={-90} position="insideLeft" style={{ textAnchor: 'middle', fill: 'hsl(var(--foreground))' }} />
                            </YAxis>

                            <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
                            
                            <Legend />

                            {suppliersToPlot.map(name => (
                                <Scatter 
                                    key={name}
                                    name={name} 
                                    data={plotData.filter(d => d.name === name)} 
                                    fill={supplierColors[name]}
                                    isAnimationActive={false}
                                />
                            ))}
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
