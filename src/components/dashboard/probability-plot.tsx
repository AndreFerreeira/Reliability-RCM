'use client';
import React, { useMemo } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Label, Line } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import type { Supplier } from '@/lib/types';
import { estimateWeibullRankRegression } from '@/lib/reliability';

interface ProbabilityPlotProps {
    suppliers: Supplier[];
    paperType: 'Weibull' | 'Lognormal' | 'Normal' | 'Exponential';
}

// Helper para converter o valor Y do espaço Weibull de volta para probabilidade (0-100)
function weibullInverseTransform(y: number): number {
    if (!isFinite(y)) return NaN;
    // y = ln( ln( 1/(1-F) ) )  =>  F = 1 - exp(-exp(y))
    const F = 1 - Math.exp(-Math.exp(y));
    return F * 100;
}

// Ticks de probabilidade para o eixo Y, como em um papel Weibull clássico
const probabilityTicks = [0.1, 0.5, 1, 2, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99, 99.9];
const yAxisTicks = probabilityTicks.map(prob => {
    const F = prob / 100;
    // y = ln( ln( 1/(1-F) ) )
    return Math.log(Math.log(1 / (1 - F)));
}).filter(isFinite);


const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload.find(p => p.dataKey.includes('x'))?.payload;
        if (!data) return null;

        const time = data.time;
        const probability = weibullInverseTransform(data.y);

        return (
            <div className="rounded-lg border bg-background p-2 shadow-sm text-xs">
                <p className="font-bold mb-1" style={{color: data.color}}>{data.name}</p>
                <p><span className="font-medium">Tempo:</span> {time.toFixed(0)}</p>
                <p><span className="font-medium">Prob. Falha (F(t)):</span> {probability.toFixed(2)}%</p>
            </div>
        );
    }
    return null;
};

const transformData = (suppliers: Supplier[]) => {
    const plotData: any[] = [];
    const lineData: any[] = [];
    const analysisResults: any[] = [];

    suppliers.forEach(supplier => {
        if (supplier.failureTimes.length < 2) return;

        const { points, line, params, rSquared } = estimateWeibullRankRegression(supplier.failureTimes);

        points.forEach(p => {
            plotData.push({
                ...p,
                name: supplier.name,
                color: supplier.color,
            });
        });

        line.forEach(p => {
             lineData.push({
                ...p,
                name: supplier.name,
             })
        });

        analysisResults.push({
            name: supplier.name,
            color: supplier.color,
            beta: params.beta,
            eta: params.eta,
            rSquared: rSquared,
        });
    });

    return { plotData, lineData, analysisResults };
};


export default function ProbabilityPlot({ suppliers, paperType }: React.PropsWithChildren<ProbabilityPlotProps>) {
    const { plotData, lineData, analysisResults } = useMemo(() => transformData(suppliers), [suppliers]);
    
    if (paperType !== 'Weibull') {
         return (
            <Card>
                <CardContent className="flex items-center justify-center h-64">
                    <p className="text-muted-foreground">Gráfico para {paperType} ainda não implementado.</p>
                </CardContent>
            </Card>
        );
    }

    if (suppliers.length === 0 || plotData.length === 0) {
       return (
            <Card className="h-full">
                <CardContent className="flex items-center justify-center h-full">
                    <div className="text-center text-muted-foreground">
                        <p className="font-semibold">Aguardando dados...</p>
                        <p className="text-sm mt-2">Insira os dados de falha no painel ao lado e clique em "Plotar Gráfico" para visualizar.</p>
                    </div>
                </CardContent>
            </Card>
        );
    }
    
    const suppliersToPlot = [...new Set(plotData.map(d => d.name))];
    const supplierColors = suppliers.reduce((acc, s) => ({ ...acc, [s.name]: s.color }), {} as Record<string, string>);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full items-start">
            <div className="h-96 w-full pr-4 md:col-span-2">
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 30 }}>
                         <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />

                        <XAxis 
                            type="number" 
                            dataKey="x" 
                            name="Tempo" 
                            domain={['dataMin', 'dataMax']}
                            tickFormatter={(value: number) => Math.round(Math.exp(value)).toString()}
                            stroke="hsl(var(--muted-foreground))"
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        >
                            <Label value="Tempo" offset={-25} position="insideBottom" fill="hsl(var(--foreground))" />
                        </XAxis>

                        <YAxis 
                            type="number" 
                            dataKey="y" 
                            name="Probabilidade de Falha (%)"
                            domain={['dataMin', 'dataMax']}
                            ticks={yAxisTicks}
                            tickFormatter={(value: number) => `${weibullInverseTransform(value).toFixed(1)}`}
                            stroke="hsl(var(--muted-foreground))"
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        >
                            <Label value="Probabilidade de Falha (%)" angle={-90} position="insideLeft" style={{ textAnchor: 'middle', fill: 'hsl(var(--foreground))' }} />
                        </YAxis>

                        <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
                        
                        <Legend wrapperStyle={{fontSize: "0.8rem"}} iconType="line" />

                        {suppliersToPlot.map(name => (
                            <React.Fragment key={`fragment-${name}`}>
                                <Scatter 
                                    key={`points-${name}`}
                                    name={name} 
                                    data={plotData.filter(d => d.name === name)} 
                                    fill={supplierColors[name]}
                                    isAnimationActive={false}
                                    dataKey="x"
                                />
                                 <Line
                                    key={`line-${name}`}
                                    data={lineData.filter(d => d.name === name)}
                                    dataKey="y"
                                    stroke={supplierColors[name]}
                                    strokeWidth={2}
                                    dot={false}
                                    strokeDasharray="5 5"
                                    name={`${name} (Ajuste)`}
                                    isAnimationActive={false}
                                    legendType="none"
                                />
                            </React.Fragment>
                        ))}
                    </ScatterChart>
                </ResponsiveContainer>
            </div>
            <div className="space-y-4">
                 <h3 className="font-semibold text-foreground pt-4">Parâmetros Estimados (Regressão)</h3>
                 {analysisResults.map(res => (
                     <Card key={res.name} className="p-3 bg-muted/30">
                        <p className="font-bold text-sm mb-2" style={{color: res.color}}>{res.name}</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                                <p className="text-muted-foreground">β (Forma)</p>
                                <p className="font-mono text-base font-medium">{res.beta.toFixed(2)}</p>
                            </div>
                             <div>
                                <p className="text-muted-foreground">η (Vida)</p>
                                <p className="font-mono text-base font-medium">{Math.round(res.eta)}</p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-muted-foreground">R² (Aderência)</p>
                                <p className="font-mono text-base font-medium">{(res.rSquared * 100).toFixed(1)}%</p>
                            </div>
                        </div>
                     </Card>
                 ))}
            </div>
        </div>
    );
}
