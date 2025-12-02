
'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { TestTube } from '@/components/icons';
import ReactECharts from 'echarts-for-react';
import { calculateFisherConfidenceBounds, estimateParametersByRankRegression } from '@/lib/reliability';
import type { Supplier, FisherBoundsData, PlotData } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';
import { Slider } from '@/components/ui/slider';

const formSchema = z.object({
  beta: z.coerce.number().gt(0, { message: 'Beta (β) deve ser maior que zero.' }).optional(),
  eta: z.coerce.number().gt(0, { message: 'Eta (η) deve ser maior que zero.' }).optional(),
  sampleSize: z.coerce.number().int().min(2, { message: 'Mínimo de 2 amostras.' }).max(100, { message: 'Máximo de 100 amostras.'}).optional(),
  simulationCount: z.coerce.number().int().min(10, { message: "Mínimo de 10 simulações." }).max(1000, { message: "Máximo de 1000 simulações." }).optional(),
  confidenceLevel: z.coerce.number().min(1).max(99.9),
  manualData: z.string().optional(),
}).refine(data => {
    // Se a dispersão for selecionada, beta, eta, sampleSize e simulationCount são necessários
    if (!data.manualData) {
        return data.beta != null && data.eta != null && data.sampleSize != null && data.simulationCount != null;
    }
    // Se os dados manuais forem fornecidos, os outros não são
    if (data.manualData) {
        return data.manualData.trim().length > 0
    }
    return true;
}, {
    message: "Preencha os campos necessários para o tipo de simulação.",
    path: ["beta"], // Pode associar o erro a um campo específico
});


type FormData = z.infer<typeof formSchema>;
type BoundType = 'bilateral' | 'unilateral' | 'none';


interface SimulationResult {
  boundsData?: FisherBoundsData;
  dispersionData?: PlotData[];
  originalPlot?: PlotData;
}

const generateWeibullFailureTime = (beta: number, eta: number): number => {
  const u = Math.random();
  return eta * Math.pow(-Math.log(1 - u), 1 / beta);
};

const FisherMatrixPlot = ({ data, showLower, showUpper }: { data?: FisherBoundsData, showLower: boolean, showUpper: boolean }) => {
    if (!data) return null;

    const { points, line, lower, upper, rSquared, beta, eta, confidenceLevel } = data;

    const probabilityTicks = [0.1, 1, 5, 10, 20, 30, 50, 70, 90, 99, 99.9];
    
    const transformedY = (prob: number) => Math.log(Math.log(1 / (1 - prob)));
    
    const series = [
        {
            name: 'Dados',
            type: 'scatter',
            data: points.map(p => [Math.exp(p.x), transformedY(p.prob)]),
            symbolSize: 8,
            itemStyle: { color: 'hsl(var(--primary))' }
        },
        {
            name: 'Linha de Ajuste',
            type: 'line',
            data: line.map(p => [Math.exp(p.x), p.y]),
            showSymbol: false,
            lineStyle: { width: 2, color: 'hsl(var(--accent))' },
        },
    ];

    if (showLower) {
        series.push({
            name: `Limite Inferior ${confidenceLevel}%`,
            type: 'line',
            data: lower.map(p => [p.time, p.y]),
            showSymbol: false,
            lineStyle: { width: 1.5, type: 'dashed', color: 'hsl(var(--chart-2))' },
        });
    }
     if (showUpper) {
        series.push({
            name: `Limite Superior ${confidenceLevel}%`,
            type: 'line',
            data: upper.map(p => [p.time, p.y]),
            showSymbol: false,
            lineStyle: { width: 1.5, type: 'dashed', color: 'hsl(var(--chart-2))' },
        });
    }

    const option = {
        backgroundColor: "transparent",
        grid: { left: 80, right: 40, top: 70, bottom: 60 },
        dataZoom: [
            { type: 'inside', filterMode: 'none', xAxisIndex: [0] },
            { type: 'inside', filterMode: 'none', yAxisIndex: [0] },
        ],
        title: {
            text: 'Limites de Confiança (Matriz de Fisher)',
            subtext: `β: ${beta.toFixed(2)} | η: ${eta.toFixed(0)} | R²: ${rSquared.toFixed(3)} | N: ${points.length}`,
            left: 'center',
            textStyle: { color: 'hsl(var(--foreground))' },
            subtextStyle: { color: 'hsl(var(--muted-foreground))' },
        },
        tooltip: { 
            trigger: 'axis',
             axisPointer: {
                label: {
                     formatter: ({ axisDimension, value }: { axisDimension: string, value: number }) => {
                        if (axisDimension === 'y') {
                            const prob = (1 - Math.exp(-Math.exp(value))) * 100;
                            return `${prob.toFixed(2)}%`;
                        }
                        return `Tempo: ${Math.round(value)}`;
                     }
                }
            },
        },
        legend: {
            data: series.map(s => s.name).filter(name => name !== 'Dados'),
            bottom: 0,
            textStyle: { color: 'hsl(var(--muted-foreground))' }
        },
        xAxis: {
            type: 'log',
            name: 'Tempo (t)',
            nameLocation: 'middle',
            nameGap: 30,
            axisLabel: { color: "hsl(var(--muted-foreground))" },
            splitLine: { show: true, lineStyle: { type: 'dashed', color: "hsl(var(--border))", opacity: 0.5 } },
        },
        yAxis: {
            type: 'value',
            name: 'Probabilidade de Falha, F(t)%',
            nameLocation: 'middle',
            nameGap: 60,
            axisLabel: {
                formatter: (value: number) => {
                    const prob = (1 - Math.exp(-Math.exp(value))) * 100;
                    const roundedProb = Math.round(prob);
                    // Show labels only for the ticks we want to display
                    if (probabilityTicks.some(tick => Math.abs(tick - prob) < 0.1 || Math.abs(tick - roundedProb) < 0.1)) {
                         if (prob < 1) return prob.toFixed(1);
                         return roundedProb;
                    }
                    return '';
                },
                color: "hsl(var(--foreground))",
            },
            splitLine: { show: true, lineStyle: { type: 'dashed', color: 'hsl(var(--border))', opacity: 0.5 } },
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


const DispersionPlot = ({ original, simulations }: { original?: PlotData; simulations?: PlotData[] }) => {
    if (!original || !simulations) return null;

    const simulationSeries = simulations.map(() => ({
        type: 'line',
        showSymbol: false,
        lineStyle: {
            width: 1,
            color: 'hsl(var(--chart-3))',
            opacity: 0.1
        },
        z: 1,
    }));
    
    simulationSeries.forEach((s, i) => {
      s.data = simulations[i].line.map(p => [Math.exp(p.x), p.y]);
    });
    
    const originalSeries = {
        name: 'Curva Original',
        type: 'line',
        data: original.line.map(p => [Math.exp(p.x), p.y]),
        showSymbol: false,
        lineStyle: {
            width: 2.5,
            color: 'hsl(var(--accent))',
            opacity: 1
        },
        z: 10,
    };

    const probabilityTicks = [0.1, 1, 10, 50, 90, 99, 99.9];
    const transformedTicks = probabilityTicks.map(p => Math.log(Math.log(1 / (1 - p/100))));
    
    const option = {
        backgroundColor: 'transparent',
        grid: { left: 80, right: 40, top: 70, bottom: 60 },
        dataZoom: [
            { type: 'inside', filterMode: 'none', xAxisIndex: [0] },
            { type: 'inside', filterMode: 'none', yAxisIndex: [0] },
        ],
        title: {
            text: 'Gráfico de Dispersão de Parâmetros',
            subtext: 'Visualização da incerteza dos parâmetros Beta e Eta',
            left: 'center',
            textStyle: { color: 'hsl(var(--foreground))' },
            subtextStyle: { color: 'hsl(var(--muted-foreground))' },
        },
        tooltip: { 
            trigger: 'axis',
             axisPointer: {
                label: {
                     formatter: ({ axisDimension, value }: { axisDimension: string, value: number }) => {
                        if (axisDimension === 'y') {
                            const prob = (1 - Math.exp(-Math.exp(value))) * 100;
                            return `${prob.toFixed(2)}%`;
                        }
                        return `Tempo: ${Math.round(value)}`;
                     }
                }
            },
        },
        legend: {
            data: ['Curva Original', 'Simulações'],
            bottom: 0,
            textStyle: { color: 'hsl(var(--muted-foreground))' }
        },
        xAxis: {
            type: 'log',
            name: 'Tempo',
            nameLocation: 'middle',
            nameGap: 30,
            axisLabel: { color: 'hsl(var(--muted-foreground))' },
            splitLine: { show: true, lineStyle: { type: 'dashed', color: 'hsl(var(--border))', opacity: 0.5 } },
        },
        yAxis: {
            type: 'value',
            name: 'Probabilidade de Falha, F(t)%',
            nameLocation: 'middle',
            nameGap: 60,
            axisLabel: {
                formatter: (value: number) => {
                    const prob = (1 - Math.exp(-Math.exp(value))) * 100;
                    if (prob > 99.9) return "99.9";
                    if (prob < 0.1) return "0.1";
                     const closestTick = probabilityTicks.reduce((prev, curr) => 
                        (Math.abs(curr - prob) < Math.abs(prev - prob) ? curr : prev)
                    );
                    if (Math.abs(closestTick - prob) < 0.5) {
                        return closestTick.toString();
                    }
                    return '';
                },
                color: "hsl(var(--foreground))"
            },
            splitLine: { show: true, lineStyle: { type: 'dashed', color: 'hsl(var(--border))', opacity: 0.5 } },
        },
        series: [originalSeries, ...simulationSeries]
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

const ConfidenceControls = ({ form, isSimulating, onSubmit, boundType, setBoundType, showUpper, setShowUpper, showLower, setShowLower }: { form: any, isSimulating: boolean, onSubmit: (data: FormData) => void, boundType: BoundType, setBoundType: (t: BoundType) => void, showUpper: boolean, setShowUpper: (b: boolean) => void, showLower: boolean, setShowLower: (b: boolean) => void }) => (
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
                                <FormDescription>
                                    Insira valores separados por vírgula, espaço ou nova linha.
                                </FormDescription>
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
                        {isSimulating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Calculando...</> : 'Calcular Limites'}
                    </Button>
                </form>
            </Form>

            <div className="space-y-4 rounded-md border p-4 mt-6">
                <Label className="font-semibold">Lados</Label>
                <RadioGroup value={boundType} onValueChange={(v) => setBoundType(v as BoundType)} className="space-y-2">
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="none" id="none" />
                        <Label htmlFor="none">Nenhum</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="bilateral" id="bilateral" />
                        <Label htmlFor="bilateral">Bilateral</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="unilateral" id="unilateral" />
                        <Label htmlFor="unilateral">Unilateral</Label>
                    </div>
                </RadioGroup>
                {boundType === 'unilateral' && (
                    <div className="pl-6 space-y-3 pt-2">
                        <div className="flex items-center space-x-2">
                            <Checkbox id="showUpper" checked={showUpper} onCheckedChange={(checked) => setShowUpper(checked as boolean)} />
                            <label htmlFor="showUpper" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Mostrar Superior
                            </label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox id="showLower" checked={showLower} onCheckedChange={(checked) => setShowLower(checked as boolean)} />
                            <label htmlFor="showLower" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Mostrar Inferior
                            </label>
                        </div>
                    </div>
                )}
            </div>
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
                    <FormField control={form.control} name="beta" render={({ field }) => ( <FormItem> <FormLabel>Beta (β - Parâmetro de Forma)</FormLabel> <FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl> <FormMessage /> </FormItem>)} />
                    <FormField control={form.control} name="eta" render={({ field }) => ( <FormItem> <FormLabel>Eta (η - Vida Característica)</FormLabel> <FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl> <FormMessage /> </FormItem>)} />
                    <FormField control={form.control} name="sampleSize" render={({ field }) => ( <FormItem> <FormLabel>Tamanho da Amostra (N)</FormLabel> <FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl> <FormMessage /> </FormItem>)} />
                    <FormField control={form.control} name="simulationCount" render={({ field }) => ( <FormItem> <FormLabel>Número de Simulações</FormLabel> <FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl> <FormMessage /> </FormItem>)} />

                    <Button type="submit" disabled={isSimulating} className="w-full">
                        {isSimulating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Simulando...</> : 'Iniciar Simulação'}
                    </Button>
                </form>
            </Form>
        </CardContent>
    </Card>
)


export default function MonteCarloSimulator() {
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationType, setSimulationType] = useState<'confidence' | 'dispersion'>('confidence');
  const { toast } = useToast();
  
  // State for confidence bound visibility
  const [boundType, setBoundType] = useState<BoundType>('bilateral');
  const [showUpper, setShowUpper] = useState(true);
  const [showLower, setShowLower] = useState(true);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      beta: 1.85,
      eta: 1500,
      sampleSize: 20,
      simulationCount: 200,
      confidenceLevel: 90,
      manualData: '105, 213, 332, 351, 365, 397, 400, 397, 437, 1014, 1126, 1132, 3944, 5042',
    },
  });
  
  const handleSimulationTypeChange = (type: 'confidence' | 'dispersion') => {
      setSimulationType(type);
      setResult(null); // Limpa os resultados ao trocar de modo
      form.reset({ // Reseta o formulário para os valores padrão do modo selecionado
        beta: 1.85,
        eta: 1500,
        sampleSize: 20,
        simulationCount: 200,
        confidenceLevel: 90,
        manualData: type === 'confidence' ? '105, 213, 332, 351, 365, 397, 400, 397, 437, 1014, 1126, 1132, 3944, 5042' : '',
    });
  }

  // Update showUpper/showLower based on boundType
  useEffect(() => {
    if (boundType === 'bilateral') {
      setShowUpper(true);
      setShowLower(true);
    } else if (boundType === 'none') {
      setShowUpper(false);
      setShowLower(false);
    }
  }, [boundType]);

  const onSubmit = (data: FormData) => {
    setIsSimulating(true);
    setResult(null);

    // Usar um pequeno timeout para permitir a atualização da UI antes do processamento pesado
    setTimeout(() => {
        try {
            if (simulationType === 'confidence') {
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

                const boundsData = calculateFisherConfidenceBounds(failureTimes, data.confidenceLevel);
                
                if (!boundsData) {
                    throw new Error("Não foi possível calcular os limites de confiança.");
                }

                setResult({ boundsData });

            } else { // dispersion
                const { beta, eta, sampleSize, simulationCount } = data;
                if (!beta || !eta || !sampleSize || !simulationCount) {
                    toast({ variant: 'destructive', title: 'Parâmetros Faltando', description: 'Por favor, preencha todos os campos para a simulação de dispersão.' });
                    setIsSimulating(false);
                    return;
                }
                
                // 1. Calcular a linha "verdadeira"
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

                // 2. Executar simulações
                const dispersionData = Array.from({ length: simulationCount }, () => {
                    const sample = Array.from({ length: sampleSize }, () =>
                        generateWeibullFailureTime(beta, eta)
                    );
                    return estimateParametersByRankRegression('Weibull', sample, [], 'SRM')?.plotData;
                }).filter((d): d is PlotData => !!d);
                
                setResult({ originalPlot, dispersionData });
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

  return (
    <div className="space-y-6">
        <Card>
            <CardHeader>
                <CardTitle>Simulador Monte Carlo</CardTitle>
                <CardDescription>Selecione o tipo de simulação que deseja realizar.</CardDescription>
            </CardHeader>
             <CardContent>
                <RadioGroup defaultValue={simulationType} onValueChange={(v) => handleSimulationTypeChange(v as 'confidence' | 'dispersion')} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              </RadioGroup>
            </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
                {simulationType === 'confidence' 
                    ? <ConfidenceControls form={form} isSimulating={isSimulating} onSubmit={onSubmit} boundType={boundType} setBoundType={setBoundType} showUpper={showUpper} setShowUpper={setShowUpper} showLower={showLower} setShowLower={setShowLower} />
                    : <DispersionControls form={form} isSimulating={isSimulating} onSubmit={onSubmit} />
                }
            </div>

            <div className="lg:col-span-2">
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
                    <FisherMatrixPlot data={result.boundsData} showLower={showLower} showUpper={showUpper} />
                )}

                {result?.dispersionData && simulationType === 'dispersion' && (
                    <DispersionPlot original={result.originalPlot} simulations={result.dispersionData} />
                )}
            </div>
        </div>
    </div>
  );
}
