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
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { TestTube } from '@/components/icons';
import ReactECharts from 'echarts-for-react';
import { calculateFisherConfidenceBounds } from '@/lib/reliability';
import type { Supplier, FisherBoundsData, PlotData } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '../ui/separator';

const formSchema = z.object({
  beta: z.coerce.number().gt(0, { message: 'Beta (β) deve ser maior que zero.' }),
  eta: z.coerce.number().gt(0, { message: 'Eta (η) deve ser maior que zero.' }),
  sampleSize: z.coerce.number().int().min(2, { message: 'Mínimo de 2 amostras.' }).max(100, { message: 'Máximo de 100 amostras.'}),
  confidenceLevel: z.coerce.number().min(1).max(99),
  confidenceMethod: z.enum(['Fisher', 'Likelihood']),
  useRsMethod: z.boolean(),
  sortByTime: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

interface SimulationResult {
  boundsData?: FisherBoundsData;
}

const generateWeibullFailureTime = (beta: number, eta: number): number => {
  const u = Math.random();
  return eta * Math.pow(-Math.log(1 - u), 1 / beta);
};

const FisherMatrixPlot = ({ data }: { data?: FisherBoundsData }) => {
    if (!data) {
        return (
            <Card className="h-[450px]">
                <CardContent className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">O gráfico de probabilidade com limites de confiança aparecerá aqui.</p>
                </CardContent>
            </Card>
        );
    }

    const { points, line, lower, upper, rSquared, angle, beta, eta, confidenceLevel } = data;

    const allX = [...points.map(p => p.x), ...line.map(p => p.x)];
    const allY = [...points.map(p => p.y), ...line.map(p => p.y)];
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

    const probabilityTicks = [0.1, 1, 5, 10, 20, 30, 50, 70, 90, 99, 99.9];

    const option = {
        backgroundColor: "transparent",
        grid: { left: 80, right: 40, top: 70, bottom: 60 },
        title: {
            text: 'Simulado de monte Carlo',
            subtext: `β: ${beta.toFixed(2)} | η: ${eta.toFixed(0)} | R²: ${rSquared.toFixed(3)} | N: ${points.length}`,
            left: 'center',
            textStyle: { color: 'hsl(var(--foreground))' },
            subtextStyle: { color: 'hsl(var(--muted-foreground))' },
        },
        tooltip: { trigger: 'axis' },
        legend: {
            data: ['Dados', 'Linha de Ajuste', `Limites ${confidenceLevel}%`],
            bottom: 0,
            textStyle: { color: 'hsl(var(--muted-foreground))' }
        },
        xAxis: {
            type: 'log',
            name: 'Tempo',
            nameLocation: 'middle',
            nameGap: 30,
            axisLabel: { color: "hsl(var(--muted-foreground))" },
            splitLine: { show: true, lineStyle: { type: 'dashed', color: "hsl(var(--border))", opacity: 0.5 } },
        },
        yAxis: {
            type: 'value',
            min: finalMinY,
            max: finalMaxY,
            name: 'Probabilidade de Falha, F(t)%',
            nameLocation: 'middle',
            nameGap: 60,
            axisLabel: {
                formatter: (value: number) => {
                    const prob = (1 - Math.exp(-Math.exp(value))) * 100;
                    if (prob < 1) return prob.toFixed(2);
                    if (prob > 99) return prob.toFixed(1);
                    return Math.round(prob);
                },
                color: "hsl(var(--muted-foreground))",
            },
            splitLine: { show: true, lineStyle: { type: 'dashed', color: "hsl(var(--border))", opacity: 0.5 } },
            // @ts-ignore
            data: probabilityTicks.map(p => Math.log(Math.log(1 / (1 - p/100))))
        },
        // @ts-ignore
        series: [
            {
                name: 'Dados',
                type: 'scatter',
                data: points.map(p => [Math.exp(p.x), p.y]),
                symbolSize: 8,
                itemStyle: { color: 'hsl(var(--primary))' }
            },
            {
                name: 'Linha de Ajuste',
                type: 'line',
                data: line.map(p => [Math.exp(p.x), p.y]),
                showSymbol: false,
                lineStyle: { width: 2, color: 'hsl(var(--primary))' },
            },
            {
                name: `Limites ${confidenceLevel}%`,
                type: 'line',
                data: lower.map(p => [Math.exp(p.x), p.y]),
                showSymbol: false,
                lineStyle: { width: 1.5, color: 'hsl(var(--destructive))', type: 'dashed' },
            },
            {
                name: `Limites ${confidenceLevel}%`,
                type: 'line',
                data: upper.map(p => [Math.exp(p.x), p.y]),
                showSymbol: false,
                lineStyle: { width: 1.5, color: 'hsl(var(--destructive))', type: 'dashed' },
            },
        ]
    };

    return (
      <Card>
        <CardContent className="pt-6">
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
      sampleSize: 20,
      confidenceLevel: 90,
      confidenceMethod: 'Fisher',
      useRsMethod: false,
      sortByTime: true,
    },
  });

  const onSubmit = (data: FormData) => {
    setIsSimulating(true);
    setResult(null);

    setTimeout(() => {
      const simulatedSample = Array.from({ length: data.sampleSize }, () =>
        generateWeibullFailureTime(data.beta, data.eta)
      ).sort((a,b) => a-b);
      
      const boundsData = calculateFisherConfidenceBounds(simulatedSample, data.confidenceLevel);
      
      setResult({
        boundsData,
      });

      setIsSimulating(false);
    }, 50);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Simulador Monte Carlo</CardTitle>
          <CardDescription>
            Preveja o comportamento de falhas com base nos parâmetros de Weibull.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              {/* Simulation Parameters Block */}
              <div className="space-y-4 rounded-md border p-4">
                <h3 className="text-sm font-medium text-muted-foreground">Parâmetros da Simulação</h3>
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
                  name="sampleSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tamanho da Amostra (N)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Analysis Settings Block */}
              <div className="space-y-4 rounded-md border p-4">
                <h3 className="text-sm font-medium text-muted-foreground">Configurações de Análise</h3>
                 <FormField
                  control={form.control}
                  name="useRsMethod"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Usar Método de Regressão RS</FormLabel>
                      </div>
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

               {/* Confidence Settings Block */}
               <div className="space-y-4 rounded-md border p-4">
                 <h3 className="text-sm font-medium text-muted-foreground">Configurações de Confiança</h3>
                 <FormField
                    control={form.control}
                    name="confidenceLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nível de Confiança (%)</FormLabel>
                        <Select onValueChange={(v) => field.onChange(parseInt(v))} defaultValue={field.value.toString()}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um nível" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="80">80%</SelectItem>
                            <SelectItem value="90">90%</SelectItem>
                            <SelectItem value="95">95%</SelectItem>
                            <SelectItem value="99">99%</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                 <FormField
                    control={form.control}
                    name="confidenceMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Método dos Limites de Confiança</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um método" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Fisher">Matriz de Fisher</SelectItem>
                            <SelectItem value="Likelihood">Razão da Verossimilhança</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                 <FormField
                    control={form.control}
                    name="sortByTime"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>Ordenar antes dos Cálculos</FormLabel>
                        </div>
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
               </div>

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
             <FisherMatrixPlot data={result.boundsData} />
          </div>
        )}
      </div>
    </div>
  );
}
