'use client';
import React from 'react';
import ReactECharts from 'echarts-for-react';
import { Card, CardContent } from '@/components/ui/card';
import type { Supplier, Distribution } from '@/lib/types';

interface ProbabilityPlotProps {
    suppliers?: Supplier[]; // Allow undefined
    paperType: Distribution; 
}

// Low-level approximation for the inverse of the standard normal CDF
function normalInverse(p: number): number {
    if (p <= 0) p = 1e-6;
    if (p >= 1) p = 0.999999;

    // A&S formula 26.2.23
    const t = Math.sqrt(-2 * Math.log(1 - p));
    const c0 = 2.515517;
    const c1 = 0.802853;
    const c2 = 0.010328;
    const d1 = 1.432788;
    const d2 = 0.189269;
    const d3 = 0.001308;

    let z = t - ((c2 * t + c1) * t + c0) / (((d3 * t + d2) * t + d1) * t + 1.0);
    if (p < 0.5) {
      z = -z;
    }
    return z;
}

export default function ProbabilityPlot({ suppliers = [], paperType }: React.PropsWithChildren<ProbabilityPlotProps>) {
    
    const validSuppliers = (suppliers || []).filter(s => s && s.plotData && s.plotData.points && s.plotData.line && s.plotData.points.length > 0 && s.distribution === paperType);

    if (validSuppliers.length === 0) {
       return (
            <Card className="h-full">
                <CardContent className="flex items-center justify-center h-full min-h-[450px]">
                    <div className="text-center text-muted-foreground">
                        <p className="font-semibold">Aguardando dados...</p>
                        <p className="text-sm mt-2">Adicione ou selecione equipamentos com a distribuição "{paperType}" para ver o gráfico.</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const allX = validSuppliers.flatMap(s => s.plotData!.line.map(p => p.x));
    const minX = Math.min(...allX);
    const maxX = Math.max(...allX);
    const xRange = maxX - minX;

    const angleGraphics = validSuppliers.map((supplier, index) => {
        if (!supplier.plotData?.angle || !supplier.plotData.line.length) return null;

        const line = supplier.plotData.line;
        const startPoint = line[0];
        const angle = supplier.plotData.angle;

        // Position the angle indicator near the start of the line
        const indicatorPositionX = startPoint.x + xRange * 0.1;
        const indicatorPositionY = startPoint.y + Math.tan(angle * Math.PI / 180) * (xRange * 0.1);

        return [
            {
                type: 'group',
                children: [
                    {
                        type: 'arc',
                        shape: {
                            cx: startPoint.x,
                            cy: startPoint.y,
                            r: xRange * 0.1,
                            startAngle: -angle,
                            endAngle: 0,
                        },
                        style: {
                            stroke: supplier.color,
                            lineWidth: 1.5,
                        },
                    },
                    {
                        type: 'text',
                        style: {
                            text: 'θ',
                            x: startPoint.x + xRange * 0.12,
                            y: startPoint.y - Math.tan(angle * Math.PI / 180) * (xRange * 0.05),
                            font: 'italic 14px "Inter", sans-serif',
                            fill: supplier.color,
                        }
                    },
                ],
            },
        ];
    }).filter(Boolean).flat();
    
    // ECharts series
    const series = validSuppliers.flatMap(supplier => {
        const { plotData, color, name } = supplier;
        if (!plotData || !plotData.points || !plotData.line) return [];
        
        let transformedPoints: [number, number][] = [];
        let transformedLine: [number, number][] = [];

        // Data transformation based on paper type
        switch(paperType) {
            case 'Weibull':
                transformedPoints = plotData.points.map(p => [p.x, p.y]);
                transformedLine = plotData.line.map(p => [p.x, p.y]);
                break;
            case 'Lognormal':
                transformedPoints = plotData.points.map(p => [p.x, p.y]);
                transformedLine = plotData.line.map(p => [p.x, p.y]);
                break;
            case 'Normal':
                transformedPoints = plotData.points.map(p => [p.time, normalInverse(p.prob)]);
                transformedLine = plotData.line.map(p => [p.x, p.y]);
                break;
            case 'Exponential':
                transformedPoints = plotData.points.map(p => [p.time, -Math.log(1 - p.prob)]);
                transformedLine = plotData.line.map(p => [p.x, p.y]);
                break;
            case 'Loglogistic':
                transformedPoints = plotData.points.map(p => [Math.log(p.time), Math.log(p.prob / (1 - p.prob))]);
                transformedLine = plotData.line.map(p => [p.x, p.y]);
                break;
            case 'Gumbel':
                transformedPoints = plotData.points.map(p => [p.time, -Math.log(-Math.log(p.prob))]);
                transformedLine = plotData.line.map(p => [p.x, p.y]);
                break;
        }

        return [
            {
                type: 'scatter',
                name: name,
                data: transformedPoints,
                symbolSize: 8,
                itemStyle: { color: color }
            },
            {
                type: 'line',
                name: `${name} (Ajuste)`,
                data: transformedLine,
                showSymbol: false,
                lineStyle: { width: 2, color: color }
            }
        ];
    });

    const probabilityTicks = [0.01, 0.1, 1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99, 99.9, 99.99];

    let yAxisSettings = {};
    if (paperType === 'Weibull') {
        yAxisSettings = {
            type: 'value',
            name: "Probabilidade Cumulativa (%)",
            nameLocation: 'middle',
            nameGap: 55,
            axisLabel: {
                formatter: (value: number) => {
                    const prob = (1 - Math.exp(-Math.exp(value))) * 100;
                     if (prob < 1) return prob.toFixed(2);
                     if (prob > 99) return prob.toFixed(2);
                     return Math.round(prob);
                },
                color: "hsl(var(--foreground))"
            },
            axisPointer: {
                label: {
                     formatter: ({ value }: { value: number }) => {
                        const prob = (1 - Math.exp(-Math.exp(value))) * 100;
                        return prob.toFixed(2) + '%';
                     }
                }
            },
            splitLine: { show: true, lineStyle: { color: "hsl(var(--border))", opacity: 0.7 } },
            axisLine: { show: true },
            data: probabilityTicks.map(p => Math.log(Math.log(1 / (1 - p/100))))
        };
    } else if (paperType === 'Lognormal' || paperType === 'Normal') {
        yAxisSettings = {
            type: 'value',
            name: 'Probabilidade Cumulativa (%)',
            nameLocation: 'middle',
            nameGap: 55,
            axisLabel: {
                formatter: (value: number) => {
                    const prob = probabilityTicks.find(p => Math.abs(normalInverse(p / 100) - value) < 0.1);
                    return prob !== undefined ? `${prob}` : '';
                },
                color: "hsl(var(--foreground))"
            },
             axisPointer: {
                label: {
                     formatter: ({ value }: { value: number }) => {
                        // This requires a normal CDF function to be accurate
                        return value.toFixed(2); // shows z-score for now
                     }
                }
            },
            splitLine: { show: true, lineStyle: { color: "hsl(var(--border))", opacity: 0.7 } },
            data: probabilityTicks.map(p => normalInverse(p/100))
        };
    } else {
        yAxisSettings = {
            type: 'value',
            name: "Probabilidade (%)",
            nameLocation: 'middle',
            nameGap: 55,
            axisLabel: { color: "hsl(var(--foreground))" },
            splitLine: { show: true, lineStyle: { color: "hsl(var(--border))", opacity: 0.7 } },
        }
    }

    const xAxisSettings = {
        Weibull: { name: 'ln(Tempo)', type: 'value' },
        Lognormal: { name: 'ln(Tempo)', type: 'value' },
        Normal: { name: 'Tempo', type: 'value' },
        Exponential: { name: 'Tempo', type: 'value' },
        Loglogistic: { name: 'ln(Tempo)', type: 'value' },
        Gumbel: { name: 'Tempo', type: 'value' }
    };
    
    // ECharts option object
    const option = {
        backgroundColor: "transparent",
        grid: { left: 80, right: 40, top: 50, bottom: 60 },
        legend: {
            data: validSuppliers.map(s => s.name),
            bottom: 0,
            type: 'scroll',
            textStyle: {
                color: 'hsl(var(--muted-foreground))'
            },
            icon: 'circle',
            selected: validSuppliers.reduce((acc, s) => {
                // By default, all series are selected.
                // ECharts automatically handles grouping in the legend
                // if series names are related (e.g., 'A' and 'A (Ajuste)').
                // Clicking 'A' in the legend will toggle both.
                acc[s.name] = true;
                acc[`${s.name} (Ajuste)`] = true;
                return acc;
            }, {} as Record<string, boolean>)
        },
        xAxis: {
            ...xAxisSettings[paperType],
            nameLocation: 'middle',
            nameGap: 30,
            min: 'dataMin',
            max: 'dataMax',
            splitLine: { show: true, lineStyle: { color: "hsl(var(--border))", opacity: 0.7 } },
            axisLabel: { color: "hsl(var(--foreground))" },
        },
        yAxis: yAxisSettings,
        tooltip: {
            trigger: 'axis',
             axisPointer: {
                type: 'cross',
                label: {
                    backgroundColor: 'hsl(var(--background))',
                    color: 'hsl(var(--foreground))',
                    borderColor: 'hsl(var(--border))',
                    borderWidth: 1,
                }
            },
            formatter: (params: any) => {
                const pointParam = params.find((p:any) => p.componentSubType === 'scatter');
                if (!pointParam) {
                    const lineParam = params[0];
                    if (!lineParam) return '';
                    let timeVal;
                    if(paperType === 'Weibull' || paperType === 'Lognormal' || paperType === 'Loglogistic') {
                        timeVal = Math.exp(lineParam.axisValue).toPrecision(4);
                    } else {
                        timeVal = lineParam.axisValue.toPrecision(4);
                    }
                    
                    let probVal;
                     if (paperType === 'Weibull') {
                        probVal = (1 - Math.exp(-Math.exp(lineParam.value))) * 100;
                    } else {
                        probVal = 'N/A'; // Need CDF for others
                    }

                    return `Tempo: ${timeVal}<br/>Prob. Estimada: ${probVal.toFixed(2)}%`;
                }
                
                const supplier = validSuppliers.find(s => s.name === pointParam.seriesName);
                if (!supplier || !supplier.plotData) return '';
                
                const originalPoint = supplier.plotData.points[pointParam.dataIndex];
                if (!originalPoint) return '';

                let tooltip = `<strong>${supplier.name}</strong><br/>Tempo: ${originalPoint.time.toFixed(0)}<br/>Prob. Falha: ${(originalPoint.prob * 100).toFixed(2)}%`;

                if (supplier.params.rho != null) {
                    tooltip += `<br/>R²: ${supplier.params.rho.toFixed(3)}`;
                }
                return tooltip;
            }
        },
        series: series,
        graphic: angleGraphics
    };
    
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
        </Card>
    );
}
