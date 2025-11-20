'use client';
import React from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Label, Line } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import type { Supplier, Distribution } from '@/lib/types';
import { invErf, invNormalCdf } from '@/lib/reliability';


interface ProbabilityPlotProps {
    supplier: Supplier | null;
    paperType: Distribution;
}

// Helper to convert the Y value from a transformed space back to probability (0-100)
function inverseTransformY(y: number, paperType: Distribution): number {
    if (!isFinite(y)) return NaN;
    let F: number; // Cumulative probability (0 to 1)
    
    switch(paperType) {
        case 'Weibull':
            // y = ln( ln( 1/(1-F) ) )  =>  F = 1 - exp(-exp(y))
            F = 1 - Math.exp(-Math.exp(y));
            break;
        case 'Lognormal':
        case 'Normal':
            // y = Z-score => F = CDF(y)
            F = 0.5 * (1 + invErf(y / Math.sqrt(2)));
            break;
        case 'Exponential':
            // y = ln(1 / (1 - F)) => F = 1 - exp(-y)
             F = 1 - Math.exp(-y);
            break;
        case 'Loglogistic':
             // y = ln(F / (1 - F)) => F = exp(y) / (1 + exp(y))
             const expY = Math.exp(y);
             F = expY / (1 + expY);
             break;
        case 'Gumbel':
            // y = -ln(-ln(F)) => F = exp(-exp(-y))
            F = Math.exp(-Math.exp(-y));
            break;
        default:
            return NaN;
    }
    return F * 100;
}


const CustomTooltip = ({ active, payload, paperType }: any) => {
    if (active && payload && payload.length) {
        const data = payload.find((p: any) => p.name !== 'Ajuste')?.payload;
        if (!data) return null;

        let time = data.time;
        if (paperType === 'Lognormal' || paperType === 'Loglogistic') {
             time = Math.exp(data.x);
        }

        const probability = inverseTransformY(data.y, paperType);
        
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

const getAxisConfig = (paperType: Distribution) => {
    const timeLabel = (paperType === 'Lognormal' || paperType === 'Loglogistic') ? 'Tempo (log)' : 'Tempo';
    
    // Ticks for Y-axis (probability)
    const yProbTicks = [0.1, 1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 99, 99.9];
    let yTicks: number[] = [];
    
    switch(paperType) {
        case 'Weibull':
            yTicks = yProbTicks.map(prob => Math.log(Math.log(1 / (1 - prob / 100)))).filter(isFinite);
            break;
        case 'Lognormal':
        case 'Normal':
            yTicks = [-3, -2, -1, 0, 1, 2, 3]; // Z-scores
            break;
        case 'Exponential':
            yTicks = [0.1, 0.5, 1, 2, 3, 4, 5]; // Values of ln(1/R)
            break;
        case 'Loglogistic':
             yTicks = yProbTicks.map(prob => Math.log((prob/100) / (1 - prob/100))).filter(isFinite);
             break;
        case 'Gumbel':
            yTicks = [-1, 0, 1, 2, 3, 4, 5, 6, 7]; // Values of -ln(-ln(F))
            break;
    }
    
    const yTickFormatter = (value: number) => {
        const prob = inverseTransformY(value, paperType);
        if (!isFinite(prob)) return '';
        if (paperType === 'Lognormal' || paperType === 'Normal') {
             return `${prob.toFixed(1)}% (Z=${value.toFixed(1)})`;
        }
        return prob.toFixed(1);
    }

    const xTickFormatter = (value: number) => {
        if (paperType === 'Lognormal' || paperType === 'Loglogistic') {
            const expVal = Math.exp(value);
            return isFinite(expVal) ? Math.round(expVal).toString() : '';
        }
        return Math.round(value).toString();
    }
    
    return { timeLabel, yTicks, yTickFormatter, xTickFormatter };
}


export default function ProbabilityPlot({ supplier, paperType }: React.PropsWithChildren<ProbabilityPlotProps>) {
    
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
    const { timeLabel, yTicks, yTickFormatter, xTickFormatter } = getAxisConfig(paperType);
    
    const renderParams = () => {
        if (!params) return null;
        switch(paperType) {
            case 'Weibull':
                return <>
                    {params.beta != null && <p><strong>β (Forma):</strong> {params.beta.toFixed(3)}</p>}
                    {params.eta != null && <p><strong>η (Vida):</strong> {params.eta.toFixed(1)}</p>}
                </>;
            case 'Lognormal':
                 return <>
                    {params.mean != null && <p><strong>μ (Log-Média):</strong> {params.mean.toFixed(3)}</p>}
                    {params.stdDev != null && <p><strong>σ (Log-DP):</strong> {params.stdDev.toFixed(3)}</p>}
                </>;
            case 'Normal':
                 return <>
                    {params.mean != null && <p><strong>μ (Média):</strong> {params.mean.toFixed(1)}</p>}
                    {params.stdDev != null && <p><strong>σ (DP):</strong> {params.stdDev.toFixed(1)}</p>}
                </>;
            case 'Exponential':
                 return <>
                    {params.lambda != null && <p><strong>λ (Taxa):</strong> {params.lambda.toPrecision(4)}</p>}
                 </>;
            case 'Loglogistic':
                return <>
                    {params.beta != null && <p><strong>β (Forma):</strong> {params.beta.toFixed(3)}</p>}
                    {params.alpha != null && <p><strong>α (Escala):</strong> {params.alpha.toFixed(1)}</p>}
                </>;
            case 'Gumbel':
                 return <>
                    {params.mu != null && <p><strong>μ (Local):</strong> {params.mu.toFixed(1)}</p>}
                    {params.sigma != null && <p><strong>σ (Escala):</strong> {params.sigma.toFixed(1)}</p>}
                </>;
            default:
                return null;
        }
    }

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
                                name={timeLabel}
                                domain={['dataMin', 'dataMax']}
                                tickFormatter={xTickFormatter}
                                stroke="hsl(var(--muted-foreground))"
                                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                            >
                                <Label value={timeLabel} offset={-25} position="insideBottom" fill="hsl(var(--foreground))" />
                            </XAxis>

                            <YAxis 
                                type="number" 
                                dataKey="y" 
                                name="Probabilidade de Falha (%)"
                                domain={yTicks.length > 1 ? [yTicks[0], yTicks[yTicks.length - 1]] : ['auto', 'auto']}
                                ticks={yTicks.length > 0 ? yTicks : undefined}
                                tickFormatter={yTickFormatter}
                                stroke="hsl(var(--muted-foreground))"
                                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                            >
                                <Label value="Probabilidade de Falha (%)" angle={-90} position="insideLeft" style={{ textAnchor: 'middle', fill: 'hsl(var(--foreground))' }} />
                            </YAxis>

                            <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip paperType={paperType} />} />
                            
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
                  {renderParams()}
                  {rSquared != null && <p><strong>R² (Aderência):</strong> {rSquared.toFixed(3)}</p>}
              </div>
            )}
        </Card>
    );
}

    