'use client';
import React from 'react';
import ReactECharts from 'echarts-for-react';
import { Card, CardContent } from '@/components/ui/card';
import type { Supplier, Distribution } from '@/lib/types';

interface ProbabilityPlotProps {
    suppliers: Supplier[];
    paperType: Distribution; // All suppliers on the plot share this distribution type
}

// Low-level approximation for the inverse of the standard normal CDF
function normalInverse(p: number) {
    if (p <= 0) p = 1e-6;
    if (p >= 1) p = 0.999999;
    const y = p - 0.5;
    const r = y * y;
    const a1 = -39.69683028665376, a2 = 220.9460984245205, a3 = -275.9285104469687;
    const b1 = -54.47609879822406, b2 = 161.5858368580409, b3 = -155.6989798598866;
    return (y * (a1 + r * (a2 + r * a3))) / (1 + r * (b1 + r * (b2 + r * b3)));
}

export default function ProbabilityPlot({ suppliers, paperType }: React.PropsWithChildren<ProbabilityPlotProps>) {
    
    const validSuppliers = suppliers.filter(s => s && s.plotData && s.plotData.points && s.plotData.line && s.plotData.points.length > 0 && s.distribution === paperType);

    if (validSuppliers.length === 0) {
       return (
            <Card className="h-full">
                <CardContent className="flex items-center justify-center h-full min-h-[450px]">
                    <div className="text-center text-muted-foreground">
                        <p className="font-semibold">Aguardando dados...</p>
                        <p className="text-sm mt-2">Adicione ou selecione fornecedores com a distribuição "{paperType}" para ver o gráfico.</p>
                    </div>
                </CardContent>
            </Card>
        );
    }
    
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
                transformedPoints = plotData.points.map(p => [Math.log(p.time), normalInverse(p.prob)]);
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
                name: `${name} (Dados)`,
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

    // Axis formatters
    const axisSettings = {
        Weibull: { xLabel: (val: number) => Math.exp(val).toPrecision(2), yLabel: (val: number) => (1 - Math.exp(-Math.exp(val))) * 100 },
        Lognormal: { xLabel: (val: number) => Math.exp(val).toPrecision(2), yLabel: (val: number) => val },
        Normal: { xLabel: (val: number) => val.toPrecision(2), yLabel: (val: number) => val },
        Exponential: { xLabel: (val: number) => val.toPrecision(2), yLabel: (val: number) => val },
        Loglogistic: { xLabel: (val: number) => Math.exp(val).toPrecision(2), yLabel: (val: number) => val },
        Gumbel: { xLabel: (val: number) => val.toPrecision(2), yLabel: (val: number) => val }
    };
    
    // ECharts option object
    const option = {
        backgroundColor: "transparent",
        grid: { left: 80, right: 20, top: 50, bottom: 60 },
        legend: {
            data: validSuppliers.flatMap(s => [`${s.name} (Dados)`, `${s.name} (Ajuste)`]),
            bottom: 0,
            textStyle: {
                color: 'hsl(var(--muted-foreground))'
            },
            icon: 'circle'
        },
        xAxis: {
            type: "value",
            name: "Tempo",
            nameLocation: 'middle',
            nameGap: 30,
            axisLabel: { formatter: axisSettings[paperType].xLabel, color: "hsl(var(--foreground))" },
            splitLine: { show: true, lineStyle: { color: "hsl(var(--border))", opacity: 0.7 } }
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
            splitLine: { show: true, lineStyle: { color: "hsl(var(--border))", opacity: 0.7 } }
        },
        tooltip: {
            trigger: 'axis',
            formatter: (params: any) => {
                const pointParam = params.find((p:any) => p.seriesType === 'scatter');
                if (!pointParam) return '';
                
                const supplier = validSuppliers.find(s => `${s.name} (Dados)` === pointParam.seriesName);
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
        series: series
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