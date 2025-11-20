'use client';
import React from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Label, Line } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import type { Supplier } from '@/lib/types';

interface ProbabilityPlotProps {
    supplier: Supplier | null;
    paperType: 'Weibull' | 'Lognormal' | 'Normal' | 'Exponential';
}

// Helper para converter o valor Y do espaço Weibull de volta para probabilidade (0-100)
function weibullInverseTransform(y: number): number {
    if (!isFinite(y)) return NaN;
    // y = ln( ln( 1/(1-F) ) )  =>  F = 1 - exp(-exp(y))
    const F = 1 - Math.exp(-Math.exp(y));
    return F * 100;
}

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload.find(p => p.name !== 'Ajuste')?.payload;
        if (!data) return null;

        const time = Math.exp(data.x);
        const probability = weibullInverseTransform(data.y);
        
        if (isNaN(time) || isNaN(probability)) return null;

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


export default function ProbabilityPlot({ supplier, paperType }: React.PropsWithChildren<ProbabilityPlotProps>) {
    
    // Ticks para o eixo Y, convertidos para o espaço transformado
    const yAxisProbabilityTicks = [0.1, 1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 99, 99.9];
    const yAxisTicks = yAxisProbabilityTicks.map(prob => {
        const F = prob / 100;
        return Math.log(Math.log(1 / (1 - F)));
    }).filter(isFinite);

    // Ticks para o eixo X (em valor logarítmico)
    const xAxisTimeTicks = [10, 100, 1000, 10000];
    const xAxisTicks = xAxisTimeTicks.map(time => Math.log(time));

    if (paperType !== 'Weibull') {
         return (
            <Card>
                <CardContent className="flex items-center justify-center h-64">
                    <p className="text-muted-foreground">Gráfico para {paperType} ainda não implementado.</p>
                </CardContent>
            </Card>
        );
    }

    if (!supplier || !supplier.plotData || !supplier.plotData.points || supplier.plotData.points.length === 0) {
       return (
            <Card className="h-full">
                <CardContent className="flex items-center justify-center h-full min-h-[450px]">
                    <div className="text-center text-muted-foreground">
                        <p className="font-semibold">Aguardando dados...</p>
                        <p className="text-sm mt-2">Insira os dados de falha, ajuste as amostras e clique em "Plotar Gráfico".</p>
                    </div>
                </CardContent>
            </Card>
        );
    }
    
    const { points: plotData, line: lineData, rSquared, params } = supplier.plotData;
    const pointsWithName = plotData.map(p => ({...p, name: supplier.name, color: supplier.color }));
    
    return (
        <Card className="h-full relative">
            <CardContent className="h-full pt-6">
                <div className="h-[450px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 30 }}>
                             <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />

                            <XAxis 
                                type="number" 
                                dataKey="x" 
                                name="Tempo" 
                                domain={['dataMin', 'dataMax']}
                                ticks={xAxisTicks}
                                tickFormatter={(value: number) => {
                                    const expVal = Math.exp(value);
                                    return isFinite(expVal) ? Math.round(expVal).toString() : '';
                                }}
                                stroke="hsl(var(--muted-foreground))"
                                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                            >
                                <Label value="Tempo" offset={-25} position="insideBottom" fill="hsl(var(--foreground))" />
                            </XAxis>

                            <YAxis 
                                type="number" 
                                dataKey="y" 
                                name="Probabilidade de Falha (%)"
                                domain={[yAxisTicks[0], yAxisTicks[yAxisTicks.length -1]]}
                                ticks={yAxisTicks}
                                tickFormatter={(value: number) => {
                                    const prob = weibullInverseTransform(value);
                                     if (!isFinite(prob)) return '';
                                    return prob.toFixed(1);
                                }}
                                stroke="hsl(var(--muted-foreground))"
                                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                            >
                                <Label value="Probabilidade de Falha (%)" angle={-90} position="insideLeft" style={{ textAnchor: 'middle', fill: 'hsl(var(--foreground))' }} />
                            </YAxis>

                            <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
                            
                            <Legend verticalAlign="bottom" wrapperStyle={{fontSize: "0.8rem", paddingTop: "20px"}} iconType="circle" />
                            
                            <Scatter 
                                name={supplier.name} 
                                data={pointsWithName} 
                                fill={supplier.color}
                                isAnimationActive={false}
                            />
                            {lineData && lineData.length > 0 && (
                                <Line
                                    type="monotone"
                                    dataKey="y"
                                    data={lineData}
                                    stroke={supplier.color}
                                    strokeWidth={2}
                                    dot={false}
                                    isAnimationActive={false}
                                    name="Ajuste"
                                    legendType="line"
                                />
                            )}
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
            {params && (
              <div className="absolute bottom-4 right-4 bg-background/80 p-2 rounded-md border text-xs text-muted-foreground space-y-1">
                  {params.beta != null && <p><strong>β (Forma):</strong> {params.beta.toFixed(3)}</p>}
                  {params.eta != null && <p><strong>η (Vida):</strong> {params.eta.toFixed(1)}</p>}
                  {rSquared != null && <p><strong>R² (Aderência):</strong> {rSquared.toFixed(3)}</p>}
              </div>
            )}
        </Card>
    );
}
