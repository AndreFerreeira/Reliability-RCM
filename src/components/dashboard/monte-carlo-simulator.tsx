'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { TestTube } from '@/components/icons';
import ReactECharts from 'echarts-for-react';
import { estimateParametersByRankRegression, calculateReliabilityData } from '@/lib/reliability';
import type { Supplier, Parameters, PlotData } from '@/lib/types';

const formSchema = z.object({
  beta: z.coerce.number().gt(0, { message: 'Beta (β) deve ser maior que zero.' }),
  eta: z.coerce.number().gt(0, { message: 'Eta (η) deve ser maior que zero.' }),
  simulations: z.coerce.number().int().min(100, { message: 'Mínimo de 100 simulações.' }).max(10000, { message: 'Máximo de 100.000 simulações.' }),
  failureCost: z.coerce.number().min(0, { message: 'O custo não pode ser negativo.' }),
});

type FormData = z.infer<typeof formSchema>;

interface SimulationResult {
  mttf: number;
  totalCost: number;
  failureTimes: number[];
  histogramData: { time: string; failures: number }[];
  simulatedSuppliers: Supplier[];
  originalSupplier: Supplier;
}

const generateWeibullFailureTime = (beta: number, eta: number): number => {
  const u = Math.random();
  return eta * Math.pow(-Math.log(1 - u), 1 / beta);
};

const MonteCarloProbabilityPlot = ({ suppliers }: { suppliers: Supplier[] }) => {
    if (!suppliers || suppliers.length === 0) {
        return (
            <Card className="h-[450px]">
                <CardContent className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">O gráfico de probabilidade aparecerá aqui.</p>
                </CardContent>
            </Card>
        );
    }
    
    const series = suppliers.map(supplier => {
        if (!supplier.plotData?.points || !supplier.plotData?.line) return null;
        return [
            {
                name: supplier.name,
                type: 'line',
                data: supplier.plotData.line.map(p => [p.x, p.y]),
                showSymbol: false,
                lineStyle: {
                    width: supplier.id === 'original' ? 3 : 1,
                    color: supplier.id === 'original' ? 'hsl(var(--foreground))' : 'hsl(var(--primary))',
                    opacity: supplier.id === 'original' ? 1 : 0.5,
                }
            }
        ];
    }).filter(Boolean).flat();
    
    const probabilityTicks = [0.01, 0.1, 1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99, 99.9];

    const option = {
        backgroundColor: "transparent",
        grid: { left: 80, right: 40, top: 50, bottom: 60 },
        tooltip: { trigger: 'axis' },
        xAxis: {
            type: 'log',
            name: 'Tempo (h)',
            nameLocation: 'middle',
            nameGap: 30,
            min: 100,
            axisLabel: { color: "hsl(var(--foreground))" },
            splitLine: { show: true, lineStyle: { type: 'dashed', color: "hsl(var(--border))", opacity: 0.5 } },
        },
        yAxis: {
            type: 'log',
            name: 'Probabilidade de Falha, F(t)%',
            nameLocation: 'middle',
            nameGap: 60,
            axisLabel: {
                formatter: (value: number) => {
                    if (value < 1) return value.toFixed(2);
                    return value.toFixed(0);
                },
                color: "hsl(var(--foreground))",
            },
            splitLine: { show: true, lineStyle: { type: 'dashed', color: "hsl(var(--border))", opacity: 0.5 } },
        },
        legend: {
            data: [{name: 'Curva Original', icon: 'rect'}, {name: 'Simulações', icon: 'rect'}],
            bottom: 0,
            textStyle: { color: 'hsl(var(--muted-foreground))' }
        },
        // @ts-ignore
        series: [
            ...suppliers.filter(s => s.id !== 'original').map(s => ({
                name: 'Simulações',
                type: 'line',
                data: s.plotData?.line.map(p => [Math.exp(p.x), (1 - Math.exp(-Math.exp(p.y)))*100]),
                showSymbol: false,
                lineStyle: { width: 1, color: 'hsl(var(--primary))', opacity: 0.2 },
            })),
            ...suppliers.filter(s => s.id === 'original').map(s => ({
                name: 'Curva Original',
                type: 'line',
                data: s.plotData?.line.map(p => [Math.exp(p.x), (1 - Math.exp(-Math.exp(p.y)))*100]),
                showSymbol: false,
                lineStyle: { width: 3, color: 'hsl(var(--foreground))' },
            })),
        ]
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle>Gráfico de Probabilidade Weibull (Simulado)</CardTitle>
          <CardDescription>Visualização da incerteza dos parâmetros Beta e Eta.</CardDescription>
        </CardHeader>
        <CardContent>
          <ReactECharts option={option} style={{ height: '450px', width: '100%' }} notMerge={true} />
        </CardContent>
      </Card>
    )
};


export default function MonteCarloSimulator() {
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      beta: 1.85,
      eta: 1500,
      simulations: 10000,
      failureCost: 1,
    },
  });

  const onSubmit = (data: FormData) => {
    setIsSimulating(true);
    setResult(null);

    setTimeout(() => {
      const allFailureTimes: number[] = [];
      const simulatedSuppliers: Supplier[] = [];
      const MAX_LINES_TO_PLOT = 200;

      for(let i = 0; i < data.simulations; i++) {
        // Para cada simulação, criamos um novo conjunto de dados de falha
        // O tamanho da amostra pode ser fixo ou aleatório. Vamos usar 20 como exemplo.
        const sampleSize = 20;
        const simulatedFailures = Array.from({ length: sampleSize }, () =>
            generateWeibullFailureTime(data.beta, data.eta)
        ).sort((a, b) => a - b);
        
        allFailureTimes.push(...simulatedFailures);
        
        // Plotamos apenas um subconjunto para performance
        if (i < MAX_LINES_TO_PLOT) {
           const analysisResult = estimateParametersByRankRegression('Weibull', simulatedFailures, [], 'SRM');
           if(analysisResult?.params && analysisResult?.plotData) {
               simulatedSuppliers.push({
                   id: `sim-${i}`,
                   name: `Simulação ${i+1}`,
                   failureTimes: simulatedFailures,
                   suspensionTimes: [],
                   color: 'hsl(var(--chart-2))',
                   distribution: 'Weibull',
                   params: analysisResult.params,
                   plotData: analysisResult.plotData,
                   units: 'h',
                   dataType: { hasSuspensions: false, hasIntervals: false, isGrouped: false },
               });
           }
        }
      }

      const sumOfFailureTimes = allFailureTimes.reduce((acc, time) => acc + time, 0);
      const mttf = sumOfFailureTimes / allFailureTimes.length;
      const totalCost = allFailureTimes.length * data.failureCost;

      // Gerar dados para o histograma
      const maxTime = Math.max(...allFailureTimes);
      const binCount = 20;
      const binSize = maxTime / binCount;
      const bins = Array(binCount).fill(0);

      for (const time of allFailureTimes) {
        const binIndex = Math.min(Math.floor(time / binSize), binCount - 1);
        bins[binIndex]++;
      }

      const histogramData = bins.map((count, index) => ({
        time: `${Math.round(index * binSize)} - ${Math.round((index + 1) * binSize)}`,
        failures: count,
      }));
      
      // Criar um "supplier" para a curva original
      const originalParams: Parameters = { beta: data.beta, eta: data.eta };
      const timeForPlot = Array.from({ length: 100 }, (_, i) => (i + 1) * (data.eta * 2 / 100));
      const plotResult = estimateParametersByRankRegression('Weibull', timeForPlot.map(t => generateWeibullFailureTime(data.beta, data.eta)), [], 'SRM');

      const originalSupplier: Supplier = {
        id: 'original',
        name: 'Curva Original',
        failureTimes: [],
        suspensionTimes: [],
        color: 'hsl(var(--foreground))',
        distribution: 'Weibull',
        params: originalParams,
        // Gerar plotData para a linha original
        plotData: plotResult?.plotData,
        units: 'h',
        dataType: { hasSuspensions: false, hasIntervals: false, isGrouped: false },
      };

      setResult({
        mttf,
        totalCost,
        failureTimes: allFailureTimes,
        histogramData,
        simulatedSuppliers,
        originalSupplier
      });

      setIsSimulating(false);
    }, 50);
  };

  const suppliersForPlot = result ? [result.originalSupplier, ...result.simulatedSuppliers] : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Simulador Monte Carlo</CardTitle>
          <CardDescription>
            Preveja o comportamento de falhas e custos com base nos parâmetros de Weibull.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="beta"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Beta (β - Parâmetro de Forma)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
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
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="simulations"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número de Simulações</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="failureCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custo por Falha (R$)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isSimulating} className="w-full">
                {isSimulating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Simulando...
                  </>
                ) : (
                  'Iniciar Simulação'
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <div className="lg:col-span-2 space-y-6">
        {isSimulating && (
            <Card className="flex flex-col items-center justify-center min-h-[400px]">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="mt-4 text-lg text-muted-foreground">Executando simulação Monte Carlo...</p>
            </Card>
        )}

        {!isSimulating && !result && (
             <Card className="flex flex-col items-center justify-center min-h-[400px]">
                <TestTube className="h-16 w-16 text-muted-foreground/50" />
                <p className="mt-4 text-lg text-center text-muted-foreground">Aguardando parâmetros para iniciar a simulação.</p>
            </Card>
        )}

        {result && (
          <div className="grid grid-cols-1 gap-6">
             <MonteCarloProbabilityPlot suppliers={suppliersForPlot} />
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Resultados da Simulação</CardTitle>
                         <CardDescription>
                            Baseado em {form.getValues('simulations').toLocaleString()} simulações.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4 text-center">
                        <Alert>
                        <AlertTitle className="text-sm font-semibold">Tempo Médio Para Falha (MTTF)</AlertTitle>
                        <AlertDescription className="text-2xl font-bold text-primary">
                            {result.mttf.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </AlertDescription>
                        </Alert>
                        <Alert>
                        <AlertTitle className="text-sm font-semibold">Custo Total Esperado</AlertTitle>
                        <AlertDescription className="text-2xl font-bold text-primary">
                            R$ {result.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>

                <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Histograma de Falhas</CardTitle>
                    <CardDescription>
                    Distribuição dos tempos de falha simulados.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={result.histogramData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="time" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} angle={-45} textAnchor="end" height={60} />
                        <YAxis allowDecimals={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                        <Tooltip
                        cursor={{ fill: 'hsl(var(--accent))', opacity: 0.1 }}
                        contentStyle={{
                            background: 'hsl(var(--background))',
                            borderColor: 'hsl(var(--border))',
                        }}
                        />
                        <Bar dataKey="failures" name="Falhas" fill="hsl(var(--primary))" />
                    </BarChart>
                    </ResponsiveContainer>
                </CardContent>
                </Card>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
