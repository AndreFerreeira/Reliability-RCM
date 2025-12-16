'use client';
import React from 'react';
import ReactECharts from 'echarts-for-react';
import { Card, CardContent } from '@/components/ui/card';
import type { Supplier, Distribution } from '@/lib/types';
import { useI18n } from '@/i18n/i18n-provider';

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
    const { t } = useI18n();
    const validSuppliers = (suppliers || []).filter(s => s && s.plotData && s.plotData.points?.median && s.plotData.points.median.length > 0 && s.distribution === paperType);

    if (validSuppliers.length === 0) {
       return (
            <Card className="h-full">
                <CardContent className="flex items-center justify-center h-full min-h-[450px]">
                    <div className="text-center text-muted-foreground">
                        <p className="font-semibold">{t('probabilityPlot.waiting')}</p>
                        <p className="text-sm mt-2">{t('probabilityPlot.noData', { paperType })}</p>
                    </div>
                </CardContent>
            </Card>
        );
    }
    
    // ECharts series
    const series = validSuppliers.flatMap(supplier => {
        const { plotData, color, name } = supplier;
        if (!plotData || !plotData.points?.median || !plotData.line) return [];
        
        let transformedPoints: [number, number][] = [];
        let transformedLine: [number, number][] = [];

        // Data transformation based on paper type
        switch(paperType) {
            case 'Weibull':
                transformedPoints = plotData.points.median.map(p => [p.x, p.y]);
                transformedLine = plotData.line.map(p => [p.x, p.y]);
                break;
            case 'Lognormal':
                transformedPoints = plotData.points.median.map(p => [p.x, p.y]);
                transformedLine = plotData.line.map(p => [p.x, p.y]);
                break;
            case 'Normal':
                transformedPoints = plotData.points.median.map(p => [p.time, normalInverse(p.prob)]);
                transformedLine = plotData.line.map(p => [p.x, p.y]);
                break;
            case 'Exponential':
                transformedPoints = plotData.points.median.map(p => [p.time, -Math.log(1 - p.prob)]);
                transformedLine = plotData.line.map(p => [p.x, p.y]);
                break;
            case 'Loglogistic':
                transformedPoints = plotData.points.median.map(p => [Math.log(p.time), Math.log(p.prob / (1 - p.prob))]);
                transformedLine = plotData.line.map(p => [p.x, p.y]);
                break;
            case 'Gumbel':
                transformedPoints = plotData.points.median.map(p => [p.time, -Math.log(-Math.log(p.prob))]);
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
                name: `${name} (${t('probabilityPlot.fit')})`,
                data: transformedLine,
                showSymbol: false,
                lineStyle: { width: 2, color: color }
            }
        ];
    });

    // Calculate axis ranges to enforce a 1:1 aspect ratio
    const allPoints = series.filter(s => s.type === 'scatter').flatMap(s => s.data as [number, number][]);
    const allX = allPoints.map(p => p[0]);
    const allY = allPoints.map(p => p[1]);

    const minX = Math.min(...allX);
    const maxX = Math.max(...allX);
    const minY = Math.min(...allY);
    const maxY = Math.max(...allY);

    const xRange = maxX - minX;
    const yRange = maxY - minY;

    const maxRange = Math.max(xRange, yRange);
    const padding = maxRange * 0.1;

    const finalMinX = (minX + maxX) / 2 - maxRange / 2 - padding;
    const finalMaxX = (minX + maxX) / 2 + maxRange / 2 + padding;
    const finalMinY = (minY + maxY) / 2 - maxRange / 2 - padding;
    const finalMaxY = (minY + maxY) / 2 + maxRange / 2 + padding;

    const probabilityTicks = [0.01, 0.1, 1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99, 99.9, 99.99];

    let yAxisSettings = {};
    if (paperType === 'Weibull') {
        yAxisSettings = {
            type: 'value',
            min: finalMinY,
            max: finalMaxY,
            name: t('probabilityPlot.yAxis'),
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
            min: finalMinY,
            max: finalMaxY,
            name: t('probabilityPlot.yAxis'),
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
            min: finalMinY,
            max: finalMaxY,
            name: t('probabilityPlot.yAxis'),
            nameLocation: 'middle',
            nameGap: 55,
            axisLabel: { color: "hsl(var(--foreground))" },
            splitLine: { show: true, lineStyle: { color: "hsl(var(--border))", opacity: 0.7 } },
        }
    }

    const xAxisSettings = {
        Weibull: { name: 'ln(Tempo)', type: 'value', min: finalMinX, max: finalMaxX },
        Lognormal: { name: 'ln(Tempo)', type: 'value', min: finalMinX, max: finalMaxX },
        Normal: { name: t('charts.time'), type: 'value', min: finalMinX, max: finalMaxX },
        Exponential: { name: t('charts.time'), type: 'value', min: finalMinX, max: finalMaxX },
        Loglogistic: { name: 'ln(Tempo)', type: 'value', min: finalMinX, max: finalMaxX },
        Gumbel: { name: t('charts.time'), type: 'value', min: finalMinX, max: finalMaxX }
    };
    
    // ECharts option object
    const option = {
        backgroundColor: "transparent",
        grid: { left: 80, right: 40, top: 50, bottom: 60 },
        dataZoom: [
            {
                type: 'inside',
                filterMode: 'none',
                xAxisIndex: [0],
            },
            {
                type: 'inside',
                filterMode: 'none',
                yAxisIndex: [0],
            },
        ],
        legend: {
            data: validSuppliers.map(s => s.name),
            bottom: 0,
            type: 'scroll',
            textStyle: {
                color: 'hsl(var(--muted-foreground))'
            },
            icon: 'circle',
            selected: validSuppliers.reduce((acc, s) => {
                acc[s.name] = true;
                acc[`${s.name} (${t('probabilityPlot.fit')})`] = true;
                return acc;
            }, {} as Record<string, boolean>),
        },
        xAxis: {
            ...xAxisSettings[paperType],
            nameLocation: 'middle',
            nameGap: 30,
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
                        probVal = (1 - Math.exp(-Math.exp(lineParam.value[1]))) * 100;
                    } else {
                        probVal = 'N/A'; // Need CDF for others
                    }

                    return `${t('charts.time')}: ${timeVal}<br/>${t('probabilityPlot.estimatedProb')}: ${probVal.toFixed(2)}%`;
                }
                
                const supplier = validSuppliers.find(s => s.name === pointParam.seriesName);
                if (!supplier || !supplier.plotData || !supplier.plotData.points.median) return '';
                
                const originalPoint = supplier.plotData.points.median[pointParam.dataIndex];
                if (!originalPoint) return '';

                let tooltip = `<strong>${supplier.name}</strong><br/>${t('charts.time')}: ${originalPoint.time.toFixed(0)}<br/>${t('probabilityPlot.failureProb')}: ${(originalPoint.prob * 100).toFixed(2)}%`;

                if (supplier.params.rho != null) {
                    tooltip += `<br/>R²: ${supplier.params.rho.toFixed(3)}`;
                }
                return tooltip;
            }
        },
        series: series,
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
