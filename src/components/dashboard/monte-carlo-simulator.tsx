'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { TestTube } from '@/components/icons';
import ReactECharts from 'echarts-for-react';
import { calculateLikelihoodRatioBounds, estimateParametersByRankRegression, generateWeibullFailureTime, calculateLikelihoodRatioContour } from '@/lib/reliability';
import type { Supplier, LRBoundsResult, PlotData, ContourData, DistributionAnalysisResult } from '@/lib/types';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

const formSchema = z.object({
  beta: z.coerce.number().gt(0, { message: 'Beta (β) deve ser maior que zero.' }).optional(),
  eta: z.coerce.number().gt(0, { message: 'Eta (η) deve ser maior que zero.' }).optional(),
  sampleSize: z.coerce.number().int().min(2, { message: 'Mínimo de 2 amostras.' }).max(100, { message: 'Máximo de 100 amostras.'}).optional(),
  simulationCount: z.coerce.number().int().min(10, { message: "Mínimo de 10 simulações." }).max(2000, { message: "Máximo de 2000 simulações." }).optional(),
  confidenceLevel: z.coerce.number().min(1).max(99.9),
  manualData: z.string().optional(),
  timeForCalc: z.coerce.number().gt(0, "O tempo deve ser positivo").optional(),
}).refine(data => {
    // Validação complexa baseada no tipo de simulação será tratada no momento do envio
    return true;
});


type FormData = z.infer<typeof formSchema>;

interface SimulationResult {
  boundsData?: LRBoundsResult;
  dispersionData?: PlotData[];
  originalPlot?: PlotData;
  contourData?: ContourData;
  simulationCount?: number;
}

const FisherMatrixPlot = ({ data, timeForCalc }: { data?: LRBoundsResult, timeForCalc?: number }) => {
    if (!data || !data.medianCurve) return null;

    const {
        medianCurve: rawMedian,
        lowerCurve: rawLower,
        upperCurve: rawUpper,
        points: rawPoints,
        betaMLE,
        etaMLE,
        rSquared,
        calculation
    } = data;
    
    // PASSO 1: Garantir que todos os dados são números e ordenados
    const sortFn = (a: { x: number }, b: { x: number }) => a.x - b.x;
    const medianCurve = rawMedian.map(p => ({ x: Number(p.x), y: Number(p.y) })).sort(sortFn);
    const lowerCurve = rawLower.map(p => ({ x: Number(p.x), y: Number(p.y) })).sort(sortFn);
    const upperCurve = rawUpper.map(p => ({ x: Number(p.x), y: Number(p.y) })).sort(sortFn);
    const points = rawPoints.map(p => ({ time: Number(p.time), prob: Number(p.prob) * 100, x: Number(p.x), y: Number(p.y) }));

    const medianData = medianCurve.map(p => [p.x, p.y]);
    const lowerData = lowerCurve.map(p => [p.x, p.y]);
    const upperData = upperCurve.map(p => [p.x, p.y]);
    const scatterData = points.map(p => [p.time, p.prob]);

    const lowerSeries = {
        name: `Limite Inferior ${data.confidenceLevel}%`,
        type: 'line',
        data: lowerData,
        showSymbol: false,
        smooth: 0.35,
        lineStyle: { width: 2, type: 'dashed', color: '#88ff88' },
        z: 9,
    };

    const upperSeries = {
        name: `Limite Superior ${data.confidenceLevel}%`,
        type: 'line',
        data: upperData,
        showSymbol: false,
        smooth: 0.35,
        lineStyle: { width: 2, type: 'dashed', color: '#ffd766' },
        z: 9,
    };
    
    const bandBaseSeries = {
        name: 'Faixa de Confiança Base',
        type: 'line',
        data: lowerData,
        showSymbol: false,
        lineStyle: { width: 0 },
        stack: 'confidence',
        z: 1,
    };
    
    const bandFillSeries = {
        name: 'Faixa de Confiança',
        type: 'line',
        data: upperData.map((p, i) => [p[0], Math.max(0, p[1] - (lowerData[i]?.[1] ?? 0))]),
        showSymbol: false,
        lineStyle: { width: 0 },
        areaStyle: { color: 'rgba(255, 215, 102, 0.15)' },
        stack: 'confidence',
        z: 1,
    };

     const medianSeries = {
        name: `Ajuste Mediano`,
        type: 'line',
        data: medianData,
        showSymbol: false,
        smooth: 0.35,
        lineStyle: { width: 3, color: '#a88cff' },
        z: 10,
    };

    const scatterSeries = {
        name: 'Dados Originais',
        type: 'scatter',
        data: scatterData,
        symbolSize: 6,
        itemStyle: { color: 'rgba(200,200,200,0.8)' }
    };
    
    let series: any[] = [
        bandBaseSeries,
        bandFillSeries,
        upperSeries,
        lowerSeries,
        medianSeries,
        scatterSeries,
    ];

    if (timeForCalc && calculation && calculation.medianAtT !== null && calculation.lowerAtT !== null && calculation.upperAtT !== null) {
        medianSeries.markLine = {
            silent: true,
            symbol: 'none',
            lineStyle: { color: 'rgba(255,215,102,0.9)', type: 'dashed', width: 2 },
            data: [{ xAxis: timeForCalc, name: 'Tempo t' }]
        };
        
         const calculatedPointsSeries = {
            name: "Valor no t",
            type: "scatter",
            data: [
                [timeForCalc, calculation.medianAtT],
                [timeForCalc, calculation.lowerAtT],
                [timeForCalc, calculation.upperAtT]
            ],
            symbolSize: 8,
            itemStyle: {
                color: (params: any) => ['#a88cff', '#88ff88', '#ffd766'][params.dataIndex],
                borderColor: '#fff',
                borderWidth: 1.5,
            },
            z: 20,
        };
        series.push(calculatedPointsSeries);
    }
    
    const probabilityTicks = [0.1, 1, 5, 10, 20, 30, 50, 70, 90, 99, 99.9];
    
    const option = {
        backgroundColor: "transparent",
        grid: { left: 65, right: 40, top: 70, bottom: 60 },
        title: {
            text: 'Limites de Confiança (Razão de Verossimilhança)',
            subtext: `β: ${betaMLE.toFixed(2)} | η: ${etaMLE.toFixed(0)} | N: ${points.length}`,
            left: 'center',
            textStyle: { color: 'hsl(var(--foreground))', fontSize: 16 },
            subtextStyle: { color: 'hsl(var(--muted-foreground))', fontSize: 12 },
        },
        tooltip: { 
            trigger: 'axis',
            formatter: (params: any[]) => {
              const axisValue = params[0].axisValue;
              let tooltip = `<strong>Tempo:</strong> ${Number(axisValue).toLocaleString()}<br/>`;
              params.forEach(p => {
                  if (p.seriesName && !p.seriesName.includes('Stack') && !p.seriesName.includes('Band') && !p.seriesName.includes('Base') && p.seriesName !== 'Dados Originais' && p.seriesName !== 'Valor no t') {
                      const value = p.value[1];
                      if(typeof value === 'number') {
                         tooltip += `<span style="color:${p.color};">●</span> ${p.seriesName}: ${value.toFixed(2)}%<br/>`;
                      }
                  }
              });
              return tooltip;
            }
        },
        legend: {
            data: series.map(s => s.name).filter(name => name && !name.includes('Stack') && !name.includes('Base') && !name.includes('Band') && name !== 'Dados Originais' && name !== 'Valor no t'),
            bottom: 0,
            textStyle: { color: 'hsl(var(--muted-foreground))', fontSize: 13 },
            itemGap: 20,
            inactiveColor: "#555"
        },
        xAxis: {
            type: 'log',
            name: 'Tempo (t)',
            nameLocation: 'middle',
            nameGap: 30,
            axisLabel: { color: "#aaa", formatter: (v: number) => Number(v).toLocaleString() },
            splitLine: { show: true, lineStyle: { type: 'dashed', color: "rgba(255,255,255,0.05)", opacity: 0.5 } },
        },
        yAxis: {
            type: 'log',
            name: 'Probabilidade de Falha, F(t)%',
            nameLocation: 'middle',
            nameGap: 50,
            axisLabel: {
                formatter: (value: number) => `${value}%`,
                color: "#aaa",
            },
            splitLine: { show: true, lineStyle: { type: 'dashed', color: 'rgba(255,255,255,0.05)', opacity: 0.5 } },
        },
        series: series
    };

    return (
      <Card>
        <CardContent className="pt-6">
          <ReactECharts option={option} style={{ height: '450px', width: '100%' }} notMerge={true} />
        </CardContent>
      </Card>
    )
};

function linspaceLog(min: number, max: number, n: number) {
  const out: number[] = [];
  const logMin = Math.log10(min);
  const logMax = Math.log10(max);
  for (let i = 0; i < n; i++) {
    out.push(Math.pow(10, logMin + (logMax - logMin) * (i / (n - 1))));
  }
  return out;
}

// linear interpolation: x must be sorted ascending
function interp1(xArr: number[], yArr: number[], x: number) {
  if (x <= xArr[0]) return yArr[0];
  if (x >= xArr[xArr.length - 1]) return yArr[yArr.length - 1];
  // find bracketing indices
  let i = 0;
  while (i < xArr.length - 1 && x > xArr[i + 1]) i++;
  const x0 = xArr[i], x1 = xArr[i + 1];
  const y0 = yArr[i], y1 = yArr[i + 1];
  const t = (x - x0) / (x1 - x0);
  return y0 + t * (y1 - y0);
}

function percentile(values: number[], p: number) {
  if (values.length === 0) return NaN;
  const arr = values.slice().sort((a,b) => a-b);
  const idx = (arr.length - 1) * (p/100);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return arr[lo];
  const t = idx - lo;
  return arr[lo] * (1-t) + arr[hi] * t;
}

const DispersionPlot = ({ original, simulations, simulationCount, maxLines = 300 }: { original?: PlotData; simulations?: PlotData[]; simulationCount: number; maxLines?: number }) => {
  if (!original || !simulations || simulations.length === 0) return null;

  const allTimes = original.line.map(p => Math.exp(p.x));
  const minT = Math.max(1, Math.min(...allTimes) * 0.6);
  const maxT = Math.max(...allTimes) * 1.4;
  const TIME_POINTS = 150;
  const timeGrid = linspaceLog(minT, maxT, TIME_POINTS);

  const simYsByGrid: number[][] = [];
  for (let s = 0; s < simulations.length; s++) {
    const sim = simulations[s];
    const simXs = sim.line.map(p => Math.exp(p.x));
    const simYs = sim.line.map(p => (1 - Math.exp(-Math.exp(p.y))) * 100);
    const pairs = simXs.map((x,i) => ({x, y: simYs[i]})).sort((a,b) => a.x - b.x);
    const xs = pairs.map(p => p.x), ys = pairs.map(p => p.y);

    const yOnGrid = timeGrid.map(t => interp1(xs, ys, t));
    simYsByGrid.push(yOnGrid);
  }

  const meanCurve: [number, number][] = [];
  const p5Curve: [number, number][] = [];
  const p95Curve: [number, number][] = [];

  for (let i = 0; i < timeGrid.length; i++) {
    const vals = simYsByGrid.map(arr => arr[i]).filter(v => isFinite(v));
    meanCurve.push([timeGrid[i], vals.reduce((a,b) => a+b, 0) / Math.max(1, vals.length)]);
    p5Curve.push([timeGrid[i], percentile(vals, 5)]);
    p95Curve.push([timeGrid[i], percentile(vals, 95)]);
  }

  const opacity = Math.max(0.05, Math.min(0.3, 1 / Math.sqrt(simulationCount)));
  const linesToDraw = Math.min(simulations.length, maxLines);
  const step = Math.max(1, Math.floor(simulations.length / linesToDraw));

  const thinSimSeries = [];
  for (let s = 0; s < simulations.length; s += step) {
      const sim = simulations[s];
      const xs = sim.line.map(p => Math.exp(p.x));
      const ys = sim.line.map(p => (1 - Math.exp(-Math.exp(p.y))) * 100);
      const pairs = xs.map((x,i) => [x, ys[i]]);
      thinSimSeries.push({
          name: `Simulação (${simulationCount})`,
          type: 'line',
          data: pairs,
          showSymbol: false,
          lineStyle: { width: 1, color: `rgba(120, 150, 255, ${opacity})` },
          z: 1
      });
  }

  const bandUpper = p95Curve;
  const bandLower = p5Curve;
  
  const originalProbCurve = original.line.map(p => {
    const time = Math.exp(p.x);
    const prob = (1 - Math.exp(-Math.exp(p.y))) * 100;
    return [time, prob];
  }).sort((a,b) => a[0] - b[0]);

  const option = {
    backgroundColor: 'transparent',
    grid: { left: 80, right: 40, top: 70, bottom: 80 },
    title: {
      text: `Dispersão de Parâmetros — ${simulationCount} Simulações`,
      left: 'center',
      textStyle: { 
        color: 'hsl(var(--foreground))',
        fontSize: 16,
        fontWeight: simulationCount > 500 ? 'bold' : 'normal'
       }
    },
    xAxis: {
      type: 'log',
      name: 'Tempo',
      axisLabel: { color: 'hsl(var(--muted-foreground))' },
      splitLine: { show: true, lineStyle: { type: 'dashed', color: 'rgba(255,255,255,0.04)' } }
    },
    yAxis: {
      type: 'value',
      name: 'Probabilidade de Falha, F(t)%',
      axisLabel: { color: 'hsl(var(--muted-foreground))', formatter: (v: number) => `${v.toFixed(0)}%` },
      min: 0,
      max: 100,
      splitLine: { show: true, lineStyle: { type: 'dashed', color: 'rgba(255,255,255,0.04)' } }
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params: any[]) => {
        const axisValue = params[0]?.value?.[0] ?? params[0]?.axisValue;
        let out = `<b>Tempo:</b> ${Number(axisValue).toLocaleString()}<br/>`;
        params.forEach(p => {
          if (p.seriesName && p.seriesName.includes('Faixa')) return;
          if (p.seriesName.includes('Simulação') && params.length > 5) return;
          const val = (p.value && p.value[1] !== undefined) ? p.value[1] : p.value;
          if (isFinite(val)) out += `<span style="color:${p.color}">●</span> ${p.seriesName}: ${Number(val).toFixed(2)}%<br/>`;
        });
        return out;
      }
    },
    legend: {
      data: [
        {name: `Simulação (${simulationCount})`}, 
        'Curva Original',
        'Média das Simulações',
        ...(simulations.length > 0 ? ['P5', 'P95'] : [])
      ],
      bottom: 0,
      textStyle: { color: 'hsl(var(--muted-foreground))' },
      selected: { [`Simulação (${simulationCount})`]: false }
    },
    series: [
      ...thinSimSeries,
      {
        name: 'Faixa P5–P95',
        type: 'line',
        data: bandUpper.map((p,i) => [p[0], Math.max(0, p[1]-(bandLower[i] ? bandLower[i][1] : 0))]),
        lineStyle: { width: 0 },
        showSymbol: false,
        stack: 'percentile_band',
        areaStyle: { color: `rgba(80, 220, 80, ${Math.max(0.05, opacity * 0.8)})` },
        z: 2,
      },
      {
        name: 'Faixa P5–P95 (base)',
        type: 'line',
        data: bandLower,
        lineStyle: { width: 0 },
        showSymbol: false,
        stack: 'percentile_band',
        z: 1,
        silent: true
      },
      {
        name: 'Média das Simulações',
        type: 'line',
        data: meanCurve,
        showSymbol: false,
        lineStyle: { width: 3, color: 'hsl(var(--accent))' },
        z: 10
      },
      {
        name: 'P5',
        type: 'line',
        data: p5Curve,
        showSymbol: false,
        lineStyle: { width: 2, type: 'dashed', color: 'rgba(80, 220, 80, 0.7)' },
        z: 5
      },
      {
        name: 'P95',
        type: 'line',
        data: p95Curve,
        showSymbol: false,
        lineStyle: { width: 2, type: 'dashed', color: 'rgba(80, 220, 80, 0.7)' },
        z: 5
      },
      {
        name: 'Curva Original',
        type: 'line',
        data: originalProbCurve,
        showSymbol: false,
        lineStyle: { width: 2.5, color: 'hsl(var(--foreground))' },
        z: 12
      }
    ]
  };

  return <Card><CardContent className="pt-6"><ReactECharts option={option} style={{ height: '450px', width: '100%' }} notMerge={true} /></CardContent></Card>;
};


const ContourPlot = ({ data }: { data?: ContourData }) => {
    if (!data) return null;

    const { center, ellipse, confidenceLevel, limits, bounds } = data;

    const series = [
        {
            name: 'Estimativa MLE',
            type: 'scatter',
            data: [[center.eta, center.beta]],
            symbolSize: 10,
            itemStyle: { color: 'hsl(var(--accent))' },
             markLine: {
                silent: true,
                symbol: 'none',
                lineStyle: {
                    type: 'dashed',
                    color: 'hsl(var(--muted-foreground))'
                },
                data: [
                    { name: 'Beta Lower', yAxis: bounds.beta_lower, label: { formatter: `β inf: ${bounds.beta_lower.toFixed(2)}` } },
                    { name: 'Beta Upper', yAxis: bounds.beta_upper, label: { formatter: `β sup: ${bounds.beta_upper.toFixed(2)}` } },
                    { name: 'Eta Lower', xAxis: bounds.eta_lower, label: { formatter: `η inf: ${bounds.eta_lower.toFixed(0)}` } },
                    { name: 'Eta Upper', xAxis: bounds.eta_upper, label: { position: 'insideEndTop', formatter: `η sup: ${bounds.eta_upper.toFixed(0)}` } }
                ],
                 label: {
                    position: 'end',
                    color: 'hsl(var(--muted-foreground))',
                    fontSize: 10
                }
            }
        },
        {
            name: `Contorno de Confiança ${confidenceLevel}%`,
            type: 'line',
            data: ellipse,
            symbol: 'none',
            lineStyle: {
                width: 2,
                color: 'hsl(var(--primary))',
            }
        },
    ];

    const option = {
        backgroundColor: 'transparent',
        title: {
            text: 'Gráfico de Contorno da Razão de Verossimilhança',
            subtext: `Nível de Confiança: ${confidenceLevel}%`,
            left: 'center',
            textStyle: { color: 'hsl(var(--foreground))' },
            subtextStyle: { color: 'hsl(var(--muted-foreground))' },
        },
        grid: { left: 80, right: 80, top: 70, bottom: 60 },
        tooltip: {
            trigger: 'item',
            formatter: ({ seriesName, data }: any) => {
                if (seriesName === 'Estimativa MLE') {
                    return `<b>${seriesName}</b><br/>Eta (η): ${data[0].toFixed(2)}<br/>Beta (β): ${data[1].toFixed(2)}`;
                }
                return `Contorno de ${confidenceLevel}%`;
            }
        },
        xAxis: {
            type: 'value',
            name: 'Eta (η)',
            nameLocation: 'middle',
            nameGap: 30,
            axisLabel: { color: 'hsl(var(--muted-foreground))' },
            splitLine: { show: true, lineStyle: { type: 'dashed', color: 'hsl(var(--border))', opacity: 0.5 } },
            min: limits.eta_min,
            max: limits.eta_max,
        },
        yAxis: {
            type: 'value',
            name: 'Beta (β)',
            nameLocation: 'middle',
            nameGap: 50,
            axisLabel: { color: 'hsl(var(--muted-foreground))' },
            splitLine: { show: true, lineStyle: { type: 'dashed', color: 'hsl(var(--border))', opacity: 0.5 } },
            min: limits.beta_min,
            max: limits.beta_max,
        },
        series: series
    };

    return (
        <Card>
            <CardContent className="pt-6">
                <ReactECharts option={option} style={{ height: '450px', width: '100%' }} notMerge={true} />
            </CardContent>
        </Card>
    );
};

const SliderWrapper = React.forwardRef<HTMLDivElement, any>(({ className, ...props }, ref) => {
  return (
    <div ref={ref} className={className}>
      <Slider {...props} />
    </div>
  );
});
SliderWrapper.displayName = 'SliderWrapper';

const ConfidenceControls = ({ form, isSimulating, onSubmit }: { form: any, isSimulating: boolean, onSubmit: (data: FormData) => void }) => (
    <Card>
        <CardHeader>
            <CardTitle>Limites de Confiança</CardTitle>
            <CardDescription>Calcule os limites com base em dados de falha inseridos manualmente.</CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                        control={form.control}
                        name="manualData"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Tempos de Falha (Manual)</FormLabel>
                                <FormControl>
                                    <Textarea
                                        placeholder="Ex: 150, 200, 210, 300..."
                                        rows={5}
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    
                    <FormField
                        control={form.control}
                        name="confidenceLevel"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Nível de confiança (%)</FormLabel>
                                <FormControl>
                                  <SliderWrapper
                                      value={[field.value ?? 90]}
                                      onValueChange={(value: number[]) => field.onChange(value[0])}
                                      max={99.9}
                                      min={80}
                                      step={0.1}
                                  />
                                </FormControl>
                                <div className="text-center text-sm text-muted-foreground pt-1">
                                    {(Number(field.value) || 0).toFixed(1)}%
                                </div>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    
                    <FormField
                        control={form.control}
                        name="timeForCalc"
                        render={({ field }) => (
                           <FormItem>
                               <FormLabel>Tempo para Cálculo (t)</FormLabel>
                               <FormControl>
                                   <Input type="number" placeholder="Ex: 700" {...field} value={field.value ?? ''}/>
                               </FormControl>
                               <FormMessage />
                           </FormItem>
                        )}
                    />

                    <Button type="submit" disabled={isSimulating} className="w-full">
                        {isSimulating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Calculando...</> : 'Calcular Limites'}
                    </Button>
                </form>
            </Form>
        </CardContent>
    </Card>
)

const DispersionControls = ({ form, isSimulating, onSubmit }: { form: any, isSimulating: boolean, onSubmit: (data: FormData) => void }) => (
     <Card>
        <CardHeader>
            <CardTitle>Dispersão de Parâmetros</CardTitle>
            <CardDescription>Simule a variabilidade dos parâmetros Beta e Eta.</CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                        control={form.control}
                        name="beta"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Beta (β - Parâmetro de Forma)</FormLabel>
                                <FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl>
                                <FormDescription>Define o modo de falha. &lt;1: prematuras; ≈1: aleatórias; &gt;1: por desgaste.</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="eta"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Eta (η - Vida Característica)</FormLabel>
                                <FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl>
                                <FormDescription>O tempo em que 63.2% da população terá falhado. Indica a vida útil.</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="sampleSize"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Tamanho da Amostra (N)</FormLabel>
                                <FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl>
                                <FormDescription>Nº de pontos de dados em cada teste. Amostras maiores geram estimativas mais estáveis.</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="simulationCount"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Número de Simulações</FormLabel>
                                <FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl>
                                <FormDescription>Nº de vezes que a simulação é executada. Aumentar reduz a incerteza do resultado.</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <Button type="submit" disabled={isSimulating} className="w-full">
                        {isSimulating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Simulando...</> : 'Iniciar Simulação'}
                    </Button>
                </form>
            </Form>
        </CardContent>
    </Card>
)

const ContourControls = ({ form, isSimulating, onSubmit }: { form: any; isSimulating: boolean; onSubmit: (data: FormData) => void; }) => (
    <Card>
        <CardHeader>
            <CardTitle>Gráfico de Contorno</CardTitle>
            <CardDescription>Calcule a elipse de confiança da razão de verossimilhança.</CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                        control={form.control}
                        name="manualData"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Tempos de Falha (Manual)</FormLabel>
                                <FormControl>
                                    <Textarea
                                        placeholder="Ex: 150, 200, 210, 300..."
                                        rows={5}
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="confidenceLevel"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Nível de confiança (%)</FormLabel>
                                <FormControl>
                                    <SliderWrapper
                                        value={[field.value ?? 90]}
                                        onValueChange={(value: number[]) => field.onChange(value[0])}
                                        max={99.9}
                                        min={80}
                                        step={0.1}
                                    />
                                </FormControl>
                                <div className="text-center text-sm text-muted-foreground pt-1">
                                    {(Number(field.value) || 0).toFixed(1)}%
                                </div>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <Button type="submit" disabled={isSimulating} className="w-full">
                        {isSimulating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Calculando...</> : 'Calcular Contorno'}
                    </Button>
                </form>
            </Form>
        </CardContent>
    </Card>
);

const ResultsDisplay = ({ result, timeForCalc }: { result: SimulationResult, timeForCalc?: number }) => {
    if (!result?.boundsData?.calculation || timeForCalc === undefined) return null;
    
    const { calculation, confidenceLevel } = result.boundsData;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Valores Calculados para t = {timeForCalc}</CardTitle>
                    <CardDescription>
                        Estimativas pontuais e limites de confiança para Confiabilidade e Probabilidade de Falha.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Métrica</TableHead>
                                <TableHead className="text-right">Inferior</TableHead>
                                <TableHead className="text-right">Mediana</TableHead>
                                <TableHead className="text-right">Superior</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell className="font-medium">Prob. Falha (F(t))</TableCell>
                                <TableCell className="text-right font-mono text-green-400">{(calculation.lowerAtT ?? 0).toFixed(2)}%</TableCell>
                                <TableCell className="text-right font-mono text-purple-400">{(calculation.medianAtT ?? 0).toFixed(2)}%</TableCell>
                                <TableCell className="text-right font-mono text-yellow-400">{(calculation.upperAtT ?? 0).toFixed(2)}%</TableCell>
                            </TableRow>
                             <TableRow>
                                <TableCell className="font-medium">Confiabilidade (R(t))</TableCell>
                                <TableCell className="text-right font-mono text-green-400">{(100 - (calculation.upperAtT ?? 0)).toFixed(2)}%</TableCell>
                                <TableCell className="text-right font-mono text-purple-400">{(100 - (calculation.medianAtT ?? 0)).toFixed(2)}%</TableCell>
                                <TableCell className="text-right font-mono text-yellow-400">{(100 - (calculation.lowerAtT ?? 0)).toFixed(2)}%</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Interpretando os Resultados</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-4">
                     {isFinite(calculation.medianAtT ?? NaN) && timeForCalc ? (
                        <>
                            <p>
                                Para um tempo de <strong className="text-foreground">{timeForCalc} horas</strong>, a probabilidade de falha estimada (melhor palpite) é de <strong className="text-primary">{(calculation.medianAtT ?? 0).toFixed(2)}%</strong>.
                            </p>
                            <p>
                                O intervalo de confiança de <strong className="text-foreground">{confidenceLevel}%</strong> significa que podemos afirmar com essa certeza que a <strong className="text-foreground">verdadeira probabilidade de falha</strong> do equipamento está entre <strong className="text-primary">{(calculation.lowerAtT ?? 0).toFixed(2)}%</strong> (cenário otimista) e <strong className="text-primary">{(calculation.upperAtT ?? 0).toFixed(2)}%</strong> (cenário pessimista).
                            </p>
                             <p>
                                Um intervalo de confiança largo sugere maior incerteza, muitas vezes devido a um tamanho de amostra pequeno.
                            </p>
                        </>
                    ) : (
                        <p>Não foi possível calcular a interpretação. Verifique os dados de entrada e os limites de confiança.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

const ContourResultsDisplay = ({ result }: { result: SimulationResult }) => {
    if (!result.contourData) return null;
    const { center, bounds } = result.contourData;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Limites de Confiança dos Parâmetros</CardTitle>
                <CardDescription>
                    Estimativa de Máxima Verossimilhança (MLE) e os limites de confiança para cada parâmetro.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Parâmetro</TableHead>
                            <TableHead className="text-right">Lim. Inferior</TableHead>
                            <TableHead className="text-right">Estimativa (MLE)</TableHead>
                            <TableHead className="text-right">Lim. Superior</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell className="font-medium">Beta (β)</TableCell>
                            <TableCell className="text-right font-mono">{Math.max(0, bounds.beta_lower).toFixed(3)}</TableCell>
                            <TableCell className="text-right font-mono">{center.beta.toFixed(3)}</TableCell>
                            <TableCell className="text-right font-mono">{bounds.beta_upper.toFixed(3)}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium">Eta (η)</TableCell>
                            <TableCell className="text-right font-mono">{bounds.eta_lower.toFixed(0)}</TableCell>
                            <TableCell className="text-right font-mono">{center.eta.toFixed(0)}</TableCell>
                            <TableCell className="text-right font-mono">{bounds.eta_upper.toFixed(0)}</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};


export default function MonteCarloSimulator() {
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationType, setSimulationType] = useState<'confidence' | 'dispersion' | 'contour'>('confidence');
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();
  

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      beta: 1.85,
      eta: 1500,
      sampleSize: 20,
      simulationCount: 200,
      confidenceLevel: 90,
      manualData: '105, 213, 332, 351, 365, 397, 400, 397, 437, 1014, 1126, 1132, 3944, 5042',
      timeForCalc: 700,
    },
  });

  useEffect(() => {
    setIsClient(true);
  }, []);

  const timeForCalc = form.watch('timeForCalc');
  
  const handleSimulationTypeChange = (type: 'confidence' | 'dispersion' | 'contour') => {
      setSimulationType(type);
      setResult(null); // Limpa os resultados ao trocar de modo
      form.reset({ // Reseta o formulário para os valores padrão do modo selecionado
        beta: 1.85,
        eta: 1500,
        sampleSize: 20,
        simulationCount: 200,
        confidenceLevel: 90,
        manualData: type === 'confidence' || type === 'contour' ? '105, 213, 332, 351, 365, 397, 400, 397, 437, 1014, 1126, 1132, 3944, 5042' : '',
        timeForCalc: 700,
    });
  }


  const runConfidenceSimulation = (data: FormData) => {
    const failureTimes = data.manualData?.replace(/\./g, '').split(/[\s,]+/).map(v => parseFloat(v.trim())).filter(v => !isNaN(v) && v > 0) || [];
                
    if (failureTimes.length < 2) {
        toast({
            variant: 'destructive',
            title: 'Dados Insuficientes',
            description: 'Por favor, insira pelo menos dois tempos de falha válidos.',
        });
        setIsSimulating(false);
        return;
    }

    const boundsData = calculateLikelihoodRatioBounds({
        times: failureTimes,
        confidenceLevel: data.confidenceLevel / 100,
        tValue: data.timeForCalc
    });
    
    if (process.env.NODE_ENV === 'development') {
      console.log("DEBUG_BOUNDS", JSON.stringify(boundsData, null, 2));
    }

    if (!boundsData || boundsData.error) {
        throw new Error(boundsData?.error || "Não foi possível calcular os limites de confiança pelo método da razão de verossimilhança.");
    }
    setResult({ boundsData });
  }

  const runDispersionSimulation = (data: FormData) => {
      const { beta, eta, sampleSize, simulationCount } = data;
      if (!beta || !eta || !sampleSize || !simulationCount) {
          toast({ variant: 'destructive', title: 'Parâmetros Faltando', description: 'Por favor, preencha todos os campos para a simulação de dispersão.' });
          setIsSimulating(false);
          return;
      }
      
      const trueIntercept = -beta * Math.log(eta);
      const timesForPlot = Array.from({length: 100}, (_, i) => (i + 1) * (eta * 3 / 100));
      const logTimesForPlot = timesForPlot.map(t => Math.log(t));
      const minLogTime = Math.min(...logTimesForPlot);
      const maxLogTime = Math.max(...logTimesForPlot);
      const trueLine = [
          { x: minLogTime, y: beta * minLogTime + trueIntercept },
          { x: maxLogTime, y: beta * maxLogTime + trueIntercept },
      ];
      const originalPlot: PlotData = { points: [], line: trueLine, rSquared: 1 };

      const dispersionData = Array.from({ length: simulationCount }, () => {
          const sample = Array.from({ length: sampleSize }, () =>
              generateWeibullFailureTime(beta, eta)
          );
          return estimateParametersByRankRegression('Weibull', sample, [], 'SRM')?.plotData;
      }).filter((d): d is PlotData => d !== null && !!d && d.line.length > 0);
      
      setResult({ originalPlot, dispersionData, simulationCount });
  }

  const runContourSimulation = (data: FormData) => {
    const failureTimes = data.manualData?.replace(/\./g, '').split(/[\s,]+/).map(v => parseFloat(v.trim())).filter(v => !isNaN(v) && v > 0) || [];
    
    if (failureTimes.length < 2) {
        toast({
            variant: 'destructive',
            title: 'Dados Insuficientes',
            description: 'Por favor, insira pelo menos dois tempos de falha válidos.',
        });
        return;
    }

    const contourData = calculateLikelihoodRatioContour(failureTimes, [], data.confidenceLevel);
    if (!contourData) {
        throw new Error("Não foi possível calcular o contorno de confiança. Verifique se os dados são adequados para uma análise Weibull.");
    }
    setResult({ contourData });
  };

  const onSubmit = (data: FormData) => {
    setIsSimulating(true);
    setResult(null);

    setTimeout(() => {
        try {
            if (simulationType === 'confidence') {
                runConfidenceSimulation(data);
            } else if (simulationType === 'dispersion') {
                runDispersionSimulation(data);
            } else if (simulationType === 'contour') {
                runContourSimulation(data);
            }
        } catch (error: any) {
             toast({
                variant: 'destructive',
                title: 'Erro na Simulação',
                description: error.message || 'Ocorreu um erro inesperado.',
            });
        } finally {
            setIsSimulating(false);
        }
    }, 50);
  }

  useEffect(() => {
    if (isClient && simulationType === 'confidence') {
        form.handleSubmit(onSubmit)();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient]); 


  if (!isClient) {
    return (
      <Card className="flex flex-col items-center justify-center min-h-[500px]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-muted-foreground">Carregando simulador...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
        <Card>
            <CardHeader>
                <CardTitle>Simulador Monte Carlo</CardTitle>
                <CardDescription>Selecione o tipo de simulação que deseja realizar.</CardDescription>
            </CardHeader>
             <CardContent>
                <RadioGroup defaultValue={simulationType} onValueChange={(v) => handleSimulationTypeChange(v as 'confidence' | 'dispersion' | 'contour')} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Label htmlFor="confidence" className={`flex flex-col items-center justify-between rounded-md border-2 p-4 cursor-pointer ${simulationType === 'confidence' ? 'border-primary' : 'border-muted'}`}>
                          <RadioGroupItem value="confidence" id="confidence" className="sr-only" />
                          <TestTube className="mb-3 h-6 w-6" />
                          Limites de Confiança
                      </Label>
                      <Label htmlFor="dispersion" className={`flex flex-col items-center justify-between rounded-md border-2 p-4 cursor-pointer ${simulationType === 'dispersion' ? 'border-primary' : 'border-muted'}`}>
                          <RadioGroupItem value="dispersion" id="dispersion" className="sr-only" />
                           <TestTube className="mb-3 h-6 w-6" />
                          Dispersão de Parâmetros
                      </Label>
                      <Label htmlFor="contour" className={`flex flex-col items-center justify-between rounded-md border-2 p-4 cursor-pointer ${simulationType === 'contour' ? 'border-primary' : 'border-muted'}`}>
                          <RadioGroupItem value="contour" id="contour" className="sr-only" />
                           <TestTube className="mb-3 h-6 w-6" />
                          Gráfico de Contorno
                      </Label>
              </RadioGroup>
            </CardContent>
        </Card>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
                {simulationType === 'confidence' &&
                    <ConfidenceControls form={form} isSimulating={isSimulating} onSubmit={onSubmit} />
                }
                {simulationType === 'dispersion' &&
                    <DispersionControls form={form} isSimulating={isSimulating} onSubmit={onSubmit} />
                }
                {simulationType === 'contour' &&
                    <ContourControls form={form} isSimulating={isSimulating} onSubmit={onSubmit} />
                }
            </div>

            <div className="lg:col-span-2 space-y-6">
                {isSimulating && (
                    <Card className="flex flex-col items-center justify-center min-h-[500px]">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        <p className="mt-4 text-lg text-muted-foreground">Executando simulação...</p>
                    </Card>
                )}

                {!isSimulating && !result && (
                     <Card className="flex flex-col items-center justify-center min-h-[500px]">
                        <TestTube className="h-16 w-16 text-muted-foreground/50" />
                        <p className="mt-4 text-lg text-center text-muted-foreground">Aguardando parâmetros para iniciar a simulação.</p>
                    </Card>
                )}

                {result?.boundsData && simulationType === 'confidence' && (
                    <FisherMatrixPlot data={result.boundsData} timeForCalc={form.getValues('timeForCalc')} />
                )}

                {result?.dispersionData && result.simulationCount && simulationType === 'dispersion' && (
                    <DispersionPlot original={result.originalPlot} simulations={result.dispersionData} simulationCount={result.simulationCount} />
                )}

                {result?.contourData && simulationType === 'contour' && (
                    <ContourPlot data={result.contourData} />
                )}

                {!isSimulating && result?.boundsData && simulationType === 'confidence' && (
                    <ResultsDisplay result={result} timeForCalc={form.getValues('timeForCalc')} />
                )}

                {!isSimulating && result?.contourData && simulationType === 'contour' && (
                  <ContourResultsDisplay result={result} />
                )}
            </div>
        </div>
    </div>
  );
}
