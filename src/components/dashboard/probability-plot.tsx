'use client';
import React from 'react';
import ReactECharts from 'echarts-for-react';
import { Card, CardContent } from '@/components/ui/card';
import type { Supplier, Distribution } from '@/lib/types';


interface ProbabilityPlotProps {
    supplier: Supplier | null;
    paperType: Distribution;
}

const WeibullPaperClassic = ({ data }: { data: Supplier['plotData'] }) => {
    if (!data || !data.points || !data.line) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">Gerando...</p>
            </div>
        );
    }
    
    const points = data.points;
    const line = data.line;
    const params = data.params;

    const scatterData = points.map(p => [p.x, p.y]);
    const lineData = line.map(p => [p.x, p.y]);

    function weibullInverse(y: number): number {
        const F = 1 - Math.exp(-Math.exp(y)); // 0–1
        return F * 100;
    }

    const probTicks = [0.1, 0.2, 0.5, 1, 2, 3, 5, 7, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90, 95, 97, 98, 99, 99.5, 99.8, 99.9];
    const yTicks = probTicks.map(F => {
        const f = F / 100;
        return Math.log(Math.log(1 / (1 - f)));
    });

    const betaLinesData: { lineStyle: any; label: any; xAxis?: number; yAxis?: number, name?: string }[] = [];
    if (params?.beta && params?.eta) {
        const beta = params.beta;
        const eta = params.eta;

        // Simplified logic based on Echarts example
        const betaLines = [0.5, 0.7, 1, 1.5, 2, 3, 4, 6];
        betaLines.forEach(b => {
             const y = b * (Math.log(10) - Math.log(eta)) + Math.log(Math.log(1 / (1-0.5)));

            betaLinesData.push({
                name: `β=${b}`,
                lineStyle: { color: "#777", type: "dashed", width: 1 },
                label: {
                    formatter: `β=${b}`,
                    color: "#777",
                    fontSize: 10,
                    position: "end"
                },
                yAxis: y
            });
        });
    }

    const option = {
        backgroundColor: "transparent",
        grid: { left: 80, right: 50, top: 50, bottom: 60 },
        xAxis: {
            type: "value",
            name: "Tempo (h) — escala log",
            nameLocation: 'middle',
            nameGap: 30,
            axisLabel: {
                formatter: (val: number) => Math.exp(val).toPrecision(2)
            },
            splitLine: {
                show: true,
                lineStyle: { color: "hsl(var(--border))", width: 1, opacity: 0.7 }
            },
        },
        yAxis: {
            type: "value",
            name: "Probabilidade (%)",
            nameLocation: 'middle',
            nameGap: 55,
            min: Math.min(...yTicks),
            max: Math.max(...yTicks),
            axisLabel: {
                formatter: (val: number) => {
                    const prob = weibullInverse(val);
                    if (prob < 1) return prob.toFixed(1);
                    return Math.round(prob);
                }
            },
            splitLine: {
                show: true,
                lineStyle: { color: "hsl(var(--border))", width: 1, opacity: 0.7 }
            },
            axisPointer: {
                label: {
                    formatter: (params: any) => `${weibullInverse(params.value).toFixed(2)}%`
                }
            }
        },
        tooltip: {
            trigger: 'axis',
             formatter: (params: any) => {
                const point = params.find((p:any) => p.seriesType === 'scatter');
                if (!point) return '';
                const time = Math.exp(point.value[0]);
                const prob = weibullInverse(point.value[1]);
                return `Tempo: ${time.toFixed(0)}<br/>Prob. Falha: ${prob.toFixed(2)}%`;
            }
        },
        series: [
            {
                type: "scatter",
                name: "Falhas",
                data: scatterData,
                symbolSize: 8,
                itemStyle: { color: "hsl(var(--primary))" }
            },
            {
                type: "line",
                name: "Ajuste Weibull",
                data: lineData,
                showSymbol: false,
                lineStyle: { width: 2, color: "hsl(var(--accent))" }
            },
        ]
    };

    return (
        <ReactECharts
            option={option}
            style={{ height: "100%", width: "100%" }}
            notMerge={true}
            lazyUpdate={true}
        />
    );
};


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
    
    const { rSquared, params } = supplier.plotData;

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
                   <WeibullPaperClassic data={supplier.plotData} />
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
