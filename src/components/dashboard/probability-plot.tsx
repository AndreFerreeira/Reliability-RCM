'use client';
import React from 'react';
import ReactECharts from 'echarts-for-react';
import { Card, CardContent } from '@/components/ui/card';
import type { Supplier, Distribution } from '@/lib/types';

interface ProbabilityPlotProps {
    supplier: Supplier | null;
    paperType: Distribution;
}

// Low-level approximation for the inverse of the standard normal CDF
function normalInverse(p: number) {
    // Safeguard for edge cases
    if (p <= 0) p = 1e-6;
    if (p >= 1) p = 0.999999;
    
    const y = p - 0.5;
    const r = y * y;
    
    // Rational approximation
    const a1 = -39.69683028665376, a2 = 220.9460984245205, a3 = -275.9285104469687;
    const b1 = -54.47609879822406, b2 = 161.5858368580409, b3 = -155.6989798598866;
    
    return (y * (a1 + r * (a2 + r * a3))) / (1 + r * (b1 + r * (b2 + r * b3)));
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
    
    const { rSquared, params, points, line } = supplier.plotData;
    
    let transformedPoints: [number, number][] = [];
    let transformedLine: [number, number][] = [];
    
    // Data transformation based on paper type
    switch(paperType) {
        case 'Weibull':
            transformedPoints = points.map(p => [p.x, p.y]);
            transformedLine = line.map(p => [p.x, p.y]);
            break;
        case 'Lognormal':
            transformedPoints = points.map(p => [Math.log(p.time), normalInverse(p.prob)]);
            transformedLine = line.map(p => [p.x, p.y]);
            break;
        case 'Normal':
            transformedPoints = points.map(p => [p.time, normalInverse(p.prob)]);
            transformedLine = line.map(p => [p.x, p.y]);
            break;
        case 'Exponential':
            transformedPoints = points.map(p => [p.time, -Math.log(1 - p.prob)]);
            transformedLine = line.map(p => [p.x, p.y]);
            break;
        case 'Loglogistic':
            transformedPoints = points.map(p => [Math.log(p.time), Math.log(p.prob / (1 - p.prob))]);
            transformedLine = line.map(p => [p.x, p.y]);
            break;
        case 'Gumbel':
            transformedPoints = points.map(p => [p.time, -Math.log(-Math.log(p.prob))]);
            transformedLine = line.map(p => [p.x, p.y]);
            break;
    }

    // Axis formatters
    const axisSettings = {
        Weibull: {
            xLabel: (val: number) => Math.exp(val).toPrecision(2),
            yLabel: (val: number) => (1 - Math.exp(-Math.exp(val))) * 100
        },
        Lognormal: {
            xLabel: (val: number) => Math.exp(val).toPrecision(2),
            yLabel: (val: number) => val
        },
        Normal: {
            xLabel: (val: number) => val.toPrecision(2),
            yLabel: (val: number) => val
        },
        Exponential: {
            xLabel: (val: number) => val.toPrecision(2),
            yLabel: (val: number) => val
        },
        Loglogistic: {
            xLabel: (val: number) => Math.exp(val).toPrecision(2),
            yLabel: (val: number) => val
        },
        Gumbel: {
            xLabel: (val: number) => val.toPrecision(2),
            yLabel: (val: number) => val
        }
    };
    
    // ECharts option object
    const option = {
        backgroundColor: "transparent",
        grid: { left: 80, right: 50, top: 50, bottom: 60 },
        xAxis: {
            type: "value",
            name: "Tempo",
            nameLocation: 'middle',
            nameGap: 30,
            axisLabel: {
                formatter: axisSettings[paperType].xLabel,
                color: "hsl(var(--foreground))"
            },
            splitLine: {
                show: true,
                lineStyle: { color: "hsl(var(--border))", opacity: 0.7 }
            }
        },
        yAxis: {
            type: "value",
            name: "Probabilidade (%)",
            nameLocation: 'middle',
            nameGap: 55,
             axisLabel: {
                formatter: (val: number) => {
                    if (paperType === 'Weibull') {
                        const prob = axisSettings.Weibull.yLabel(val);
                        if (prob < 1) return prob.toFixed(1);
                        return Math.round(prob);
                    }
                    return val.toPrecision(2);
                },
                 color: "hsl(var(--foreground))"
            },
            splitLine: {
                show: true,
                lineStyle: { color: "hsl(var(--border))", opacity: 0.7 }
            }
        },
        tooltip: {
            trigger: 'axis',
            formatter: (params: any) => {
                const point = params.find((p:any) => p.seriesType === 'scatter');
                if (!point) return '';
                const originalPoint = supplier.plotData!.points[point.dataIndex];
                return `Tempo: ${originalPoint.time.toFixed(0)}<br/>Prob. Falha: ${(originalPoint.prob * 100).toFixed(2)}%`;
            }
        },
        series: [
            {
                type: 'scatter',
                name: 'Falhas',
                data: transformedPoints,
                symbolSize: 8,
                itemStyle: { color: "hsl(var(--primary))" }
            },
            {
                type: 'line',
                name: `Ajuste ${paperType}`,
                data: transformedLine,
                showSymbol: false,
                lineStyle: { width: 2, color: "hsl(var(--accent))" }
            }
        ]
    };
    

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
                   <ReactECharts
                        option={option}
                        style={{ height: "100%", width: "100%" }}
                        notMerge={true}
                        lazyUpdate={true}
                    />
                </div>
            </CardContent>
            {params && Object.keys(params).length > 0 && (
              <div className="absolute bottom-4 right-4 bg-background/80 p-2 rounded-md border text-xs text-muted-foreground space-y-1">
                  {renderParams()}
                  {rSquared != null && <p><strong>R² (Aderência):</strong> {rSquared.toFixed(3)}</p>}
              </div>
            )}
        </Card>
    );
}
