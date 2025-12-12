'use client';

import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Trash2, Trophy } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TestTube } from '@/components/icons';
import ReactECharts from 'echarts-for-react';
import { analyzeCompetingFailureModes, calculateLikelihoodRatioBounds, estimateParametersByRankRegression, generateWeibullFailureTime, calculateLikelihoodRatioContour, calculateExpectedFailures, fitWeibullMLE, getFailureProbWithBounds } from '@/lib/reliability';
import type { Supplier, LRBoundsResult, PlotData, ContourData, DistributionAnalysisResult, ExpectedFailuresResult, BudgetInput, CensoredData, CompetingFailureMode, AnalysisTableData } from '@/lib/types';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { invNormalCdf } from '@/lib/reliability';

const competingModeSchema = z.object({
  name: z.string().min(1, 'O nome é obrigatório.'),
  times: z.string().min(1, 'Insira pelo menos um tempo de falha.'),
});

const formSchema = z.object({
  beta: z.coerce.number().gt(0, { message: 'Beta (β) deve ser maior que zero.' }).optional(),
  eta: z.coerce.number().gt(0, { message: 'Eta (η) deve ser maior que zero.' }).optional(),
  sampleSize: z.coerce.number().int().min(2, { message: 'Mínimo de 2 amostras.' }).max(100, { message: 'Máximo de 100 amostras.'}).optional(),
  simulationCount: z.coerce.number().int().min(10, { message: "Mínimo de 10 simulações." }).max(2000, { message: "Máximo de 2000 simulações." }).optional(),
  confidenceLevel: z.coerce.number().min(1).max(99.9),
  manualData: z.string().optional(),
  timeForCalc: z.coerce.number().gt(0, "O tempo deve ser positivo").optional(),
  budgetSourceData: z.string().optional(),
  budgetPopulationData: z.string().optional(),
  budgetPeriod: z.coerce.number().gt(0, "O período deve ser positivo").optional(),
  budgetItemCost: z.coerce.number().gt(0, "O custo deve ser positivo").optional(),
  competingModes: z.array(competingModeSchema).min(1, "Adicione pelo menos um modo de falha."),
  competingModesPeriod: z.coerce.number().gt(0, "O período deve ser positivo").optional(),
}).refine(data => {
    return true;
});


type FormData = z.infer<typeof formSchema>;

interface SimulationResult {
  boundsData?: LRBoundsResult;
  dispersionData?: PlotData[];
  originalPlot?: PlotData;
  contourData?: ContourData;
  budgetResult?: ExpectedFailuresResult;
  competingModesResult?: CompetingModesAnalysis;
  simulationCount?: number;
  budgetParams?: { beta: number, eta: number };
}

const FisherMatrixPlot = ({ data, timeForCalc }: { data?: LRBoundsResult, timeForCalc?: number }) => {
    if (!data || !data.medianLine) return null;

    const {
        medianLine,
        lowerLine,
        upperLine,
        points,
        beta,
        eta,
        confidenceLevel,
        calculation
    } = data;
    
    const sortFn = (a: { x: number }, b: { x: number }) => a.x - b.x;
    
    const medianData = medianLine.map(p => [p.x, p.y]).sort(sortFn);
    const lowerData = lowerLine.map(p => [p.x, p.y]).sort(sortFn);
    const upperData = upperLine.map(p => [p.x, p.y]).sort(sortFn);

    const scatterData = points.median.map(p => [p.x, p.y]);
    
    const lowerSeries = {
        name: `Limite Inferior ${confidenceLevel}%`,
        type: 'line',
        data: lowerData,
        showSymbol: false,
        smooth: false,
        lineStyle: { width: 2, type: 'dashed', color: '#88ff88' },
        z: 9,
    };

    const upperSeries = {
        name: `Limite Superior ${confidenceLevel}%`,
        type: 'line',
        data: upperData,
        showSymbol: false,
        smooth: false,
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
        smooth: false,
        lineStyle: { width: 3, color: '#a88cff' },
        z: 10,
    };

    const scatterSeries = {
        name: 'Dados (Posto Mediano)',
        type: 'scatter',
        data: scatterData,
        symbolSize: 8,
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
         const timeLog = Math.log(timeForCalc);
         medianSeries.markLine = {
            silent: true,
            symbol: 'none',
            lineStyle: { color: 'rgba(255,215,102,0.9)', type: 'dashed', width: 2 },
            data: [{ xAxis: timeLog, name: 'Tempo t' }]
        };
        
         const calculatedPointsSeries = {
            name: "Valor no t",
            type: "scatter",
            data: [
                [timeLog, calculation.medianAtT],
                [timeLog, calculation.lowerAtT],
                [timeLog, calculation.upperAtT]
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
    const logProbabilityTicks = probabilityTicks.map(p => Math.log(Math.log(1 / (1 - p/100))));
    
    const option = {
        backgroundColor: "transparent",
        grid: { left: 65, right: 40, top: 70, bottom: 60 },
        title: {
            text: 'Limites de Confiança (Postos de Plotagem)',
            subtext: `β: ${beta.toFixed(2)} | η: ${eta.toFixed(0)} | N: ${points.median.length}`,
            left: 'center',
            textStyle: { color: 'hsl(var(--foreground))', fontSize: 16 },
            subtextStyle: { color: 'hsl(var(--muted-foreground))', fontSize: 12 },
        },
        tooltip: { 
            trigger: 'axis',
            formatter: (params: any[]) => {
              if (!params || params.length === 0) return '';
              const logTime = params[0].axisValue;
              const time = Math.exp(logTime);
              let tooltip = `<strong>Tempo:</strong> ${time.toLocaleString()}<br/>`;
              params.forEach(p => {
                  if (p.seriesName && !p.seriesName.includes('Base') && !p.seriesName.includes('Faixa') && !p.seriesName.includes('Dados')) {
                      const loglogY = p.value[1];
                      if(typeof loglogY === 'number') {
                         const prob = (1 - Math.exp(-Math.exp(loglogY))) * 100;
                         tooltip += `<span style="color:${p.color};">●</span> ${p.seriesName}: ${prob.toFixed(2)}%<br/>`;
                      }
                  }
              });
              return tooltip;
            }
        },
        legend: {
            data: series.map(s => s.name).filter(name => name && !name.includes('Base') && !name.includes('Faixa') && !name.includes('Valor no t')),
            bottom: 0,
            textStyle: { color: 'hsl(var(--muted-foreground))', fontSize: 13 },
            itemGap: 20,
            inactiveColor: "#555"
        },
        xAxis: {
            type: 'value',
            name: 'ln(Tempo)',
            nameLocation: 'middle',
            nameGap: 30,
            axisLabel: { color: "#aaa" },
            splitLine: { show: true, lineStyle: { type: 'dashed', color: "rgba(255,255,255,0.05)", opacity: 0.5 } },
        },
        yAxis: {
            type: 'value',
            name: 'ln(ln(1/(1-F(t))))',
            nameLocation: 'middle',
            nameGap: 50,
            axisLabel: {
                formatter: (value: number) => {
                    const prob = (1 - Math.exp(-Math.exp(value))) * 100;
                    const roundedProb = Math.round(prob);
                    const tickMatch = probabilityTicks.find(p => Math.abs(p - roundedProb) < 1 || (p < 1 && Math.abs(p - prob) < 0.1) );
                    return tickMatch ? `${tickMatch}%` : '';
                },
                color: "#aaa",
            },
            splitLine: { show: false },
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
  const arr = values.slice().sort((a,b) => a-b).filter(v => isFinite(v));
  if (arr.length === 0) return NaN;
  const idx = (arr.length - 1) * (p/100);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return arr[lo];
  const t = idx - lo;
  return arr[lo] * (1-t) + arr[hi] * t;
}

const DispersionPlot = ({ original, simulations, simulationCount, maxLines = 300 }: { original?: PlotData; simulations?: PlotData[]; simulationCount: number; maxLines?: number }) => {
  if (!original || !simulations || simulations.length === 0) {
    return <Card className="flex items-center justify-center min-h-[450px]"><p className="text-muted-foreground">Aguardando dados da simulação...</p></Card>;
  }

  const allTimes = original.line.map(p => Math.exp(p.x));
  const minT = Math.max(1, Math.min(...allTimes) * 0.6);
  const maxT = Math.max(...allTimes) * 1.4;
  const TIME_POINTS = 150;
  const timeGrid = linspaceLog(minT, maxT, TIME_POINTS);

  const simYsByGrid: number[][] = [];
  for (let s = 0; s < simulations.length; s++) {
    const sim = simulations[s];
    if (!sim || !sim.line || sim.line.length < 2) continue;
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
    if (vals.length > 0) {
      meanCurve.push([timeGrid[i], vals.reduce((a,b) => a+b, 0) / vals.length]);
      p5Curve.push([timeGrid[i], percentile(vals, 5)]);
      p95Curve.push([timeGrid[i], percentile(vals, 95)]);
    }
  }

  const opacity = Math.max(0.05, Math.min(0.3, 1 / Math.sqrt(simulationCount)));
  const linesToDraw = Math.min(simulations.length, maxLines);
  const step = Math.max(1, Math.floor(simulations.length / linesToDraw));

  const thinSimSeries = [];
  for (let s = 0; s < simulations.length; s += step) {
      const sim = simulations[s];
      if (!sim || !sim.line || sim.line.length < 2) continue;
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

  const bandUpper = p95Curve.filter(p => isFinite(p[1]));
  const bandLower = p5Curve.filter(p => isFinite(p[1]));
  
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
        `Simulação (${simulationCount})`,
        'Curva Original',
        'Média das Simulações',
        ...(simulations.length > 0 ? ['P5', 'P95'] : [])
      ],
      bottom: 0,
      textStyle: { color: 'hsl(var(--muted-foreground))' },
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

const CompetingModesPlot = ({ result }: { result?: CompetingModesAnalysis }) => {
    if (!result) return null;
    const { analyses, reliabilityData } = result;

    const legendData = analyses.map(a => a.name).concat('Sistema');
    const series = legendData.map(name => ({
        name: name,
        type: 'line',
        data: reliabilityData.map(d => [d.time, d[name]! * 100]),
        showSymbol: false,
        lineStyle: { width: name === 'Sistema' ? 3 : 2 },
    }));

    const option = {
        backgroundColor: 'transparent',
        title: {
            text: 'Confiabilidade do Sistema (Modos Competitivos)',
            subtext: `Período de Análise: ${result.period}`,
            left: 'center',
            textStyle: { color: 'hsl(var(--foreground))' },
            subtextStyle: { color: 'hsl(var(--muted-foreground))' },
        },
        grid: { left: 80, right: 40, top: 80, bottom: 80 },
        tooltip: {
            trigger: 'axis',
            formatter: (params: any[]) => {
                let tooltip = `<b>Tempo: ${params[0].axisValue.toFixed(0)}</b><br/>`;
                params.forEach(p => {
                    tooltip += `<span style="color: ${p.color}">●</span> ${p.seriesName}: ${p.value[1].toFixed(2)}%<br/>`;
                });
                return tooltip;
            }
        },
        legend: {
            data: legendData,
            bottom: 25,
            textStyle: { color: 'hsl(var(--muted-foreground))' },
        },
        xAxis: {
            type: 'value',
            name: 'Tempo',
            nameLocation: 'middle',
            nameGap: 30,
            axisLabel: { color: 'hsl(var(--muted-foreground))' },
            splitLine: { show: true, lineStyle: { type: 'dashed', color: 'hsl(var(--border))', opacity: 0.5 } },
        },
        yAxis: {
            type: 'value',
            name: 'Confiabilidade R(t), %',
            nameLocation: 'middle',
            nameGap: 50,
            min: 0,
            max: 100,
            axisLabel: { color: 'hsl(var(--muted-foreground))', formatter: '{value}%' },
            splitLine: { show: true, lineStyle: { type: 'dashed', color: 'hsl(var(--border))', opacity: 0.5 } },
        },
        series: series
    };

    return <ReactECharts option={option} style={{ height: '450px', width: '100%' }} notMerge={true} />;
};


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
                                  <Slider
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
                                    <Slider
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

const BudgetControls = ({ form, isSimulating, onSubmit, onExtract }: { form: any; isSimulating: boolean; onSubmit: (data: FormData) => void; onExtract: () => void; }) => (
    <Card>
        <CardHeader>
            <CardTitle>Orçamento de Sobressalentes</CardTitle>
            <CardDescription>Estime falhas futuras e custos para uma população de itens em serviço.</CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                     <FormField
                        control={form.control}
                        name="budgetSourceData"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>1. Dados de Falha e Suspensão</FormLabel>
                                <FormControl>
                                    <Textarea
                                        placeholder={"Ex:\n150 F\n210 S"}
                                        rows={8}
                                        {...field}
                                    />
                                </FormControl>
                                <FormDescription>Dados para estimar os parâmetros Beta e Eta. Use [Tempo] [F/S].</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="budgetPopulationData"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>2. População em Serviço</FormLabel>
                                <FormControl>
                                    <Textarea
                                        placeholder={"Ex:\n0 133\n5 1\n33 1"}
                                        rows={6}
                                        {...field}
                                    />
                                </FormControl>
                                <FormDescription>Itens atualmente em operação. Use [Idade] [Quantidade].</FormDescription>
                                <Button type="button" variant="outline" size="sm" onClick={onExtract} className="mt-2 w-full">
                                    Extrair Suspensões dos Dados Acima
                                </Button>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                         <FormField
                            control={form.control}
                            name="budgetPeriod"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Período de Previsão</FormLabel>
                                    <FormControl><Input type="number" placeholder="Ex: 365" {...field} value={field.value ?? ''} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="budgetItemCost"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Custo Unitário (R$)</FormLabel>
                                    <FormControl><Input type="number" step="0.01" placeholder="Ex: 2500" {...field} value={field.value ?? ''} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    <FormField
                        control={form.control}
                        name="confidenceLevel"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Nível de confiança (%)</FormLabel>
                                <FormControl>
                                  <Slider
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
                        {isSimulating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Calculando...</> : 'Calcular Orçamento'}
                    </Button>
                </form>
            </Form>
        </CardContent>
    </Card>
);

const CompetingModesControls = ({ form, isSimulating, onSubmit }: { form: any; isSimulating: boolean; onSubmit: (data: FormData) => void; }) => {
    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "competingModes",
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Modos de Falha Competitivos</CardTitle>
                <CardDescription>Analise a confiabilidade de um sistema com múltiplos modos de falha.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="space-y-4">
                            {fields.map((field, index) => (
                                <Card key={field.id} className="p-4 relative">
                                    <div className="grid grid-cols-1 gap-4">
                                        <FormField
                                            control={form.control}
                                            name={`competingModes.${index}.name`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Nome do Modo #{index + 1}</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Ex: Quebra" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name={`competingModes.${index}.times`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Tempos de Falha</FormLabel>
                                                    <FormControl>
                                                        <Textarea placeholder="500, 900, 1200..." rows={4} {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="absolute top-1 right-1"
                                        onClick={() => remove(index)}
                                    >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </Card>
                            ))}
                        </div>
                        
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={() => append({ name: '', times: '' })}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Adicionar Modo de Falha
                        </Button>
                        
                        <FormField
                            control={form.control}
                            name="competingModesPeriod"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tempo para Análise (t)</FormLabel>
                                    <FormControl><Input type="number" placeholder="Ex: 2000" {...field} value={field.value ?? ''} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" disabled={isSimulating} className="w-full">
                            {isSimulating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analisando...</> : 'Analisar Modos Competitivos'}
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
};


const ResultsDisplay = ({ result, timeForCalc }: { result: SimulationResult, timeForCalc?: number }) => {
    if (!result?.boundsData?.calculation || timeForCalc === undefined) return null;
    
    const { calculation, confidenceLevel } = result.boundsData;

    const transformY = (y: number) => (1 - Math.exp(-Math.exp(y))) * 100;
    
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
                                <TableCell className="text-right font-mono text-green-400">{transformY(calculation.lowerAtT ?? 0).toFixed(2)}%</TableCell>
                                <TableCell className="text-right font-mono text-purple-400">{transformY(calculation.medianAtT ?? 0).toFixed(2)}%</TableCell>
                                <TableCell className="text-right font-mono text-yellow-400">{transformY(calculation.upperAtT ?? 0).toFixed(2)}%</TableCell>
                            </TableRow>
                             <TableRow>
                                <TableCell className="font-medium">Confiabilidade (R(t))</TableCell>
                                <TableCell className="text-right font-mono text-green-400">{(100 - transformY(calculation.upperAtT ?? 0)).toFixed(2)}%</TableCell>
                                <TableCell className="text-right font-mono text-purple-400">{(100 - transformY(calculation.medianAtT ?? 0)).toFixed(2)}%</TableCell>
                                <TableCell className="text-right font-mono text-yellow-400">{(100 - transformY(calculation.lowerAtT ?? 0)).toFixed(2)}%</TableCell>
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
                                Para um tempo de <strong className="text-foreground">{timeForCalc} horas</strong>, a probabilidade de falha estimada (melhor palpite) é de <strong className="text-primary">{transformY(calculation.medianAtT ?? 0).toFixed(2)}%</strong>.
                            </p>
                            <p>
                                O intervalo de confiança de <strong className="text-foreground">{confidenceLevel}%</strong> significa que podemos afirmar com essa certeza que a <strong className="text-foreground">verdadeira probabilidade de falha</strong> do equipamento está entre <strong className="text-primary">{transformY(calculation.lowerAtT ?? 0).toFixed(2)}%</strong> (cenário otimista) e <strong className="text-primary">{transformY(calculation.upperAtT ?? 0).toFixed(2)}%</strong> (cenário pessimista).
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

const BudgetResultsDisplay = ({ result, itemCost, confidenceLevel }: { result: SimulationResult, itemCost: number, confidenceLevel: number }) => {
    if (!result.budgetResult) return null;
    const { totals } = result.budgetResult;
    const formatCurrency = (value: number) => {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    return (
        <div className="space-y-6">
             {result.budgetParams && (
                 <Card>
                    <CardHeader>
                        <CardTitle>Parâmetros Weibull Calculados (MLE)</CardTitle>
                        <CardDescription>
                           Estes são os parâmetros de forma (Beta) e escala (Eta) calculados a partir dos seus dados.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                         <div className="grid grid-cols-2 gap-4">
                            <div className="rounded-md border p-4">
                                <p className="text-sm text-muted-foreground">Beta (β)</p>
                                <p className="text-2xl font-bold">{result.budgetParams.beta.toFixed(3)}</p>
                            </div>
                            <div className="rounded-md border p-4">
                                <p className="text-sm text-muted-foreground">Eta (η)</p>
                                <p className="text-2xl font-bold">{result.budgetParams.eta.toFixed(0)}</p>
                            </div>
                        </div>
                    </CardContent>
                 </Card>
             )}
            <Card>
                <CardHeader>
                    <CardTitle>Resultados do Orçamento</CardTitle>
                    <CardDescription>
                        Quantidade de falhas esperadas e custos associados para a população em serviço no período definido.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Métrica</TableHead>
                                <TableHead className="text-right">Inferior (LI)</TableHead>
                                <TableHead className="text-right">Mediana</TableHead>
                                <TableHead className="text-right">Superior (LS)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell className="font-medium">Falhas Esperadas</TableCell>
                                <TableCell className="text-right font-mono">{totals.li.toFixed(2)}</TableCell>
                                <TableCell className="text-right font-mono">{totals.median.toFixed(2)}</TableCell>
                                <TableCell className="text-right font-mono">{totals.ls.toFixed(2)}</TableCell>
                            </TableRow>
                             <TableRow>
                                <TableCell className="font-medium">Custo do Orçamento</TableCell>
                                <TableCell className="text-right font-mono text-green-400">{formatCurrency(totals.li * itemCost)}</TableCell>
                                <TableCell className="text-right font-mono text-purple-400">{formatCurrency(totals.median * itemCost)}</TableCell>
                                <TableCell className="text-right font-mono text-yellow-400">{formatCurrency(totals.ls * itemCost)}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </CardContent>
                 <CardFooter>
                    <p className="text-sm text-muted-foreground">
                        Planeje seu orçamento com base no Limite Superior (LS) para garantir um nível de serviço de {confidenceLevel}%.
                    </p>
                 </CardFooter>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Interpretando a Previsão de Falhas</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-4">
                     <p>
                        A <strong className="text-foreground">Mediana</strong> é a sua melhor estimativa, o número mais provável de falhas com base nos dados. É o ponto de partida para o planejamento.
                    </p>
                    <p>
                        Os <strong className="text-foreground">Limites de Confiança (LI e LS)</strong> quantificam a incerteza da previsão, com base no nível de confiança de <strong className="text-foreground">{confidenceLevel}%</strong>. Eles definem um intervalo onde o número real de falhas provavelmente se encontrará.
                    </p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li><strong className="text-green-400">Limite Inferior (LI):</strong> O cenário otimista. Há uma baixa probabilidade de que o número de falhas seja menor que este valor.</li>
                        <li><strong className="text-yellow-400">Limite Superior (LS):</strong> O cenário pessimista e o mais importante para o orçamento. Para garantir um nível de serviço adequado e evitar falta de estoque, planeje seu orçamento de sobressalentes com base neste valor.</li>
                    </ul>
                     <p className="pt-2">
                       A largura do intervalo (diferença entre LS e LI) reflete a qualidade dos seus dados. Dados mais consistentes e em maior volume geralmente resultam em um intervalo de confiança mais estreito e uma previsão mais precisa.
                    </p>
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle>Tabela Detalhada de Falhas por Item</CardTitle>
                     <CardDescription>Esta é a previsão de falhas para cada grupo de itens da sua população em serviço.</CardDescription>
                </CardHeader>
                <CardContent className="max-h-80 overflow-y-auto">
                    <Table>
                        <TableHeader>
                           <TableRow>
                                <TableHead>Idade Atual</TableHead>
                                <TableHead>Qtd. Itens</TableHead>
                                <TableHead className="text-right">Falhas (LI)</TableHead>
                                <TableHead className="text-right">Falhas (Mediana)</TableHead>
                                <TableHead className="text-right">Falhas (LS)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {result.budgetResult.details.map((item, index) => (
                                <TableRow key={index}>
                                    <TableCell>{item.age}</TableCell>
                                    <TableCell>{item.quantity}</TableCell>
                                    <TableCell className="text-right font-mono">{item.li.toFixed(5)}</TableCell>
                                    <TableCell className="text-right font-mono">{item.median.toFixed(5)}</TableCell>
                                    <TableCell className="text-right font-mono">{item.ls.toFixed(5)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};

const CompetingModesResultsDisplay = ({ result }: { result: SimulationResult }) => {
    if (!result.competingModesResult) return null;
    const { analyses, failureProbabilities, period, tables } = result.competingModesResult;
    const criticalMode = failureProbabilities?.[0];

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Análise dos Modos de Falha</CardTitle>
                    <CardDescription>
                        Parâmetros Weibull (MLE) calculados para cada modo de falha competitivo.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Modo de Falha</TableHead>
                                <TableHead className="text-right">Beta (β)</TableHead>
                                <TableHead className="text-right">Eta (η)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {analyses.map(mode => (
                                <TableRow key={mode.name}>
                                    <TableCell className="font-medium">{mode.name}</TableCell>
                                    <TableCell className="text-right font-mono">{mode.params.beta?.toFixed(3) ?? 'N/A'}</TableCell>
                                    <TableCell className="text-right font-mono">{mode.params.eta?.toFixed(0) ?? 'N/A'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
             {failureProbabilities && (
                 <Card>
                    <CardHeader>
                        <CardTitle>Probabilidade de Falha em t = {period}</CardTitle>
                        <CardDescription>Probabilidade de falha individual para cada modo no tempo especificado.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Modo de Falha</TableHead>
                                    <TableHead className="text-right">Probabilidade F(t)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {failureProbabilities.map(fp => (
                                    <TableRow key={fp.name} className={cn(fp.name === criticalMode.name && "bg-primary/10")}>
                                        <TableCell className="font-medium flex items-center">
                                            {fp.name}
                                            {fp.name === criticalMode.name && (
                                                <Trophy className="h-4 w-4 ml-2 text-yellow-500" />
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            {(fp.probability * 100).toFixed(4)}%
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        {criticalMode && (
                           <CardFooter className="pt-4">
                                <p className="text-sm text-muted-foreground">
                                    O modo de falha <strong className="text-primary">{criticalMode.name}</strong> é o mais crítico, com a maior probabilidade de ocorrência.
                                </p>
                           </CardFooter>
                        )}
                    </CardContent>
                 </Card>
            )}
            <Card>
                 <CardContent className="pt-6">
                    <CompetingModesPlot result={result.competingModesResult} />
                </CardContent>
            </Card>

            {tables && tables.length > 0 && <CompetingModesTablesDisplay tables={tables} />}
        </div>
    );
};

const CompetingModesTablesDisplay = ({ tables }: { tables: AnalysisTableData[] }) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Tabelas de Dados da Análise</CardTitle>
                <CardDescription>
                    Veja como os dados são tratados para cada análise individual de modo de falha. 'F' indica uma falha do modo em análise, e 'S' indica uma suspensão (uma falha de um modo competitivo).
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tables.map(table => (
                        <div key={table.modeName}>
                            <h3 className="font-semibold text-center mb-2">Analisando - {table.modeName}</h3>
                            <div className="max-h-80 overflow-y-auto rounded-md border">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                                        <TableRow>
                                            <TableHead>Tempo</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Modo de Falha</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {table.dataRows.map((row, index) => (
                                            <TableRow key={index} className={cn(row.status === 'F' && 'bg-primary/10')}>
                                                <TableCell>{row.time}</TableCell>
                                                <TableCell>{row.status}</TableCell>
                                                <TableCell>{row.originalMode}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};


interface MonteCarloSimulatorProps {
  suppliers: Supplier[];
}

export default function MonteCarloSimulator({ suppliers }: MonteCarloSimulatorProps) {
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationType, setSimulationType] = useState<'confidence' | 'dispersion' | 'contour' | 'budget' | 'competing'>('budget');
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();
  

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      beta: 1.56,
      eta: 1512,
      sampleSize: 20,
      simulationCount: 200,
      confidenceLevel: 90,
      manualData: '500, 900, 1200, 1600, 1800',
      timeForCalc: 700,
      budgetSourceData: "5 S\n33 S\n39 F\n41 F\n57 F\n60 S\n64 F\n78 S\n91 F\n117 S\n118 S\n124 S\n133 S\n134 F\n135 F\n186 S\n196 F\n203 S\n228 S\n235 F\n241 S\n272 F\n276 S\n277 F\n282 F\n289 S\n290 F\n291 S\n295 F\n296 F\n299 F\n302 F\n302 S\n303 F\n308 F\n326 F\n336 F\n338 F\n347 S\n354 S\n376 S\n376 S\n385 F\n388 S\n389 F\n415 S\n416 S\n422 F\n424 S\n425 F\n425 S\n429 F\n429 F\n434 S\n440 F\n444 F\n458 F\n459 S\n460 S\n471 F\n475 F\n475 S\n482 F\n497 F\n497 F\n520 F\n528 S\n535 F\n541 S\n543 S\n563 F\n576 F\n586 F\n613 F\n618 S\n626 S\n657 S\n662 F\n669 S\n670 F\n677 F\n688 S\n689 S\n708 S\n735 F\n748 F\n754 F\n760 F\n760 F\n773 S\n777 F\n782 F\n821 F\n833 F\n839 F\n859 F\n868 F\n884 S\n896 F\n902 S\n907 F\n931 S\n936 F\n940 F\n940 F\n950 F\n951 F\n968 S\n969 F\n970 F\n970 S\n984 F\n986 F\n1004 F\n1012 S\n1016 F\n1027 S\n1039 F\n1047 S\n1049 F\n1049 S\n1050 S\n1052 S\n1060 F\n1078 F\n1084 S\n1170 S\n1181 S\n1185 S\n1200 F\n1201 S\n1202 F\n1210 F\n1227 F\n1229 F\n1249 F\n1261 F\n1264 S\n1287 F\n1293 S\n1298 F\n1298 S\n1313 F\n1325 F\n1364 F\n1375 S\n1378 F\n1387 S\n1409 F\n1424 S\n1428 F\n1434 F\n1452 F\n1454 F\n1469 F\n1503 F\n1538 F\n1540 F\n1540 F\n1548 F\n1567 F\n1613 F\n1650 F\n1676 F\n1680 F\n1683 S\n1710 F\n1719 F\n1725 S\n1731 F\n1737 F\n1810 F\n1836 F\n1912 F\n1954 S\n2023 F\n2109 F\n2120 F\n2121 F\n2224 F\n2229 F\n2291 F\n2300 F\n2340 F\n2396 F\n2397 F\n2567 F\n2652 F\n2698 F\n2708 F\n2725 F\n2781 F\n2818 F\n2861 F\n2899 F\n2942 F\n3158 F\n3562 F\n3631 F",
      budgetPopulationData: "0 133",
      budgetPeriod: 365,
      budgetItemCost: 2500,
      competingModes: [
        { name: 'Quebra', times: '980, 1253, 1589, 1785, 1996, 2357, 2467, 3013' },
        { name: 'Empenamento', times: '2345, 2467, 2789, 2996, 3025, 3321' },
        { name: 'Desgaste', times: '3996, 4345, 4678, 5213, 5303' }
      ],
      competingModesPeriod: 2000,
    },
  });

  useEffect(() => {
    setIsClient(true);
  }, []);

  const timeForCalc = form.watch('timeForCalc');
  const budgetItemCost = form.watch('budgetItemCost');
  const confidenceLevel = form.watch('confidenceLevel');
  
  const handleSimulationTypeChange = (type: 'confidence' | 'dispersion' | 'contour' | 'budget' | 'competing') => {
      setSimulationType(type);
      setResult(null);
  }

  const handleExtractSuspensions = () => {
    const sourceData = form.getValues('budgetSourceData') || '';
    const lines = sourceData.trim().split('\n');
    const suspensionCounts: { [key: number]: number } = {};
    
    lines.forEach(line => {
        const parts = line.trim().split(/[\s,]+/);
        if (parts.length === 2) {
            const time = parseFloat(parts[0]);
            const status = parts[1].toUpperCase();
            if (!isNaN(time) && status === 'S') {
                suspensionCounts[time] = (suspensionCounts[time] || 0) + 1;
            }
        }
    });

    const existingPopulationData = form.getValues('budgetPopulationData') || '';
    const existingLines = existingPopulationData.trim().split('\n').filter(l => l.trim() !== '');

    const populationString = Object.entries(suspensionCounts)
        .map(([age, quantity]) => `${age} ${quantity}`)
        .join('\n');
        
    form.setValue('budgetPopulationData', existingLines.concat(populationString.split('\n')).join('\n'));
    toast({
      title: 'População Extraída',
      description: 'Os itens de suspensão foram adicionados à população em serviço.'
    })
  };

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
        confidenceLevel: data.confidenceLevel,
        tValue: data.timeForCalc
    });

    if (!boundsData || boundsData.error) {
        throw new Error(boundsData?.error || "Não foi possível calcular os limites de confiança.");
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
      const originalPlot: PlotData = { points: {median: []}, line: trueLine, rSquared: 1 };

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
  
  const runBudgetSimulation = (data: FormData) => {
    const { budgetSourceData, budgetPopulationData, budgetPeriod, budgetItemCost, confidenceLevel } = data;
    if (!budgetSourceData || !budgetPeriod || !budgetItemCost || !confidenceLevel || !budgetPopulationData) {
        toast({ variant: 'destructive', title: 'Parâmetros Faltando', description: 'Por favor, preencha todos os campos para o cálculo do orçamento.' });
        return;
    }

    const sourceLines = budgetSourceData.trim().split('\n');
    const censoredData: CensoredData[] = [];
    const failureTimes: number[] = [];
    sourceLines.forEach(line => {
        const parts = line.trim().split(/[\s,]+/);
        if (parts.length === 2) {
            const time = parseFloat(parts[0]);
            const status = parts[1].toUpperCase();
            if (!isNaN(time) && (status === 'F' || status === 'S')) {
                censoredData.push({ time, event: status === 'F' ? 1 : 0 });
                if (status === 'F') {
                  failureTimes.push(time);
                }
            }
        }
    });

    if (censoredData.filter(d => d.event === 1).length < 2) {
        toast({ variant: 'destructive', title: 'Dados de Origem Insuficientes', description: 'São necessários pelo menos 2 pontos de falha (F) para calcular os parâmetros Beta e Eta.' });
        return;
    }

    const mleParams = fitWeibullMLE(censoredData);
    if (!mleParams?.beta || !mleParams?.eta) {
        toast({ variant: 'destructive', title: 'Erro de Cálculo de Parâmetros', description: 'Não foi possível estimar Beta e Eta a partir dos dados de origem.' });
        return;
    }

    const populationLines = budgetPopulationData.trim().split('\n');
    const items: { age: number, quantity: number }[] = [];
    populationLines.forEach(line => {
        const parts = line.trim().split(/[\s,]+/);
        if (parts.length === 2) {
            const age = parseInt(parts[0], 10);
            const quantity = parseInt(parts[1], 10);
            if (!isNaN(age) && !isNaN(quantity)) {
                items.push({ age, quantity });
            }
        }
    });
    
    if (items.length === 0) {
        toast({ variant: 'destructive', title: 'População Vazia', description: 'Nenhum item na população em serviço para calcular o orçamento.' });
        return;
    }

    const budgetInput: BudgetInput = {
        beta: mleParams.beta,
        eta: mleParams.eta,
        items,
        period: budgetPeriod,
        confidenceLevel: confidenceLevel / 100,
        failureTimes: failureTimes,
    };

    const budgetResult = calculateExpectedFailures(budgetInput);
    setResult({ budgetResult, budgetParams: { beta: mleParams.beta, eta: mleParams.eta } });
  };
  
    const runCompetingModesSimulation = (data: FormData) => {
        const { competingModes, competingModesPeriod } = data;
        if (!competingModes || competingModes.length === 0 || !competingModesPeriod) {
            toast({ variant: 'destructive', title: 'Dados Incompletos', description: 'Adicione pelo menos um modo de falha e preencha o período de previsão.' });
            return;
        }

        const modes: CompetingFailureMode[] = competingModes.map(mode => ({
            name: mode.name,
            times: mode.times.replace(/\./g, '').split(/[\s,]+/).map(v => parseFloat(v.trim())).filter(v => !isNaN(v) && v > 0)
        }));

        if (modes.some(m => m.times.length === 0)) {
             toast({ variant: 'destructive', title: 'Modo de Falha Vazio', description: 'Todos os modos de falha devem ter pelo menos um tempo de falha.' });
            return;
        }

        const competingModesResult = analyzeCompetingFailureModes(modes, competingModesPeriod);
        if (!competingModesResult) {
            throw new Error("Não foi possível analisar os modos competitivos. Verifique os dados de entrada.");
        }
        setResult({ competingModesResult });
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
            } else if (simulationType === 'budget') {
                runBudgetSimulation(data);
            } else if (simulationType === 'competing') {
                runCompetingModesSimulation(data);
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
    if (isClient && (simulationType === 'budget' || simulationType === 'competing' || simulationType === 'confidence')) {
        const sourceData = form.getValues('budgetSourceData');
        const populationData = form.getValues('budgetPopulationData');
        const competingData = form.getValues('competingModes');
        const manualData = form.getValues('manualData');
        
        if(simulationType === 'budget' && sourceData && populationData){
            form.handleSubmit(onSubmit)();
        } else if (simulationType === 'competing' && competingData && competingData.length > 0) {
            form.handleSubmit(onSubmit)();
        } else if (simulationType === 'confidence' && manualData) {
            form.handleSubmit(onSubmit)();
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, simulationType]); 


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
                <RadioGroup defaultValue={simulationType} onValueChange={(v) => handleSimulationTypeChange(v as 'confidence' | 'dispersion' | 'contour' | 'budget' | 'competing')} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
                      <Label htmlFor="budget" className={`flex flex-col items-center justify-between rounded-md border-2 p-4 cursor-pointer ${simulationType === 'budget' ? 'border-primary' : 'border-muted'}`}>
                          <RadioGroupItem value="budget" id="budget" className="sr-only" />
                           <TestTube className="mb-3 h-6 w-6" />
                          Orçamento de Sobressalentes
                      </Label>
                       <Label htmlFor="competing" className={`flex flex-col items-center justify-between rounded-md border-2 p-4 cursor-pointer ${simulationType === 'competing' ? 'border-primary' : 'border-muted'}`}>
                          <RadioGroupItem value="competing" id="competing" className="sr-only" />
                           <TestTube className="mb-3 h-6 w-6" />
                          Modos Competitivos
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
                 {simulationType === 'budget' &&
                    <BudgetControls form={form} isSimulating={isSimulating} onSubmit={onSubmit} onExtract={handleExtractSuspensions} />
                }
                 {simulationType === 'competing' &&
                    <CompetingModesControls form={form} isSimulating={isSimulating} onSubmit={onSubmit} />
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
                
                {result?.competingModesResult && simulationType === 'competing' && (
                  <CompetingModesResultsDisplay result={result} />
                )}

                {result?.budgetResult && simulationType === 'budget' && budgetItemCost && confidenceLevel && (
                  <BudgetResultsDisplay result={result} itemCost={budgetItemCost} confidenceLevel={confidenceLevel} />
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
