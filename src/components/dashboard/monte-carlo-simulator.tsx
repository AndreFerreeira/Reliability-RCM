
'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { TestTube } from '@/components/icons';
import ReactECharts from 'echarts-for-react';
import { calculateFisherConfidenceBounds, estimateParametersByRankRegression } from '@/lib/reliability';
import type { Supplier, FisherBoundsData, PlotData } from '@/lib/types';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

const formSchema = z.object({
  beta: z.coerce.number().gt(0, { message: 'Beta (β) deve ser maior que zero.' }).optional(),
  eta: z.coerce.number().gt(0, { message: 'Eta (η) deve ser maior que zero.' }).optional(),
  sampleSize: z.coerce.number().int().min(2, { message: 'Mínimo de 2 amostras.' }).max(100, { message: 'Máximo de 100 amostras.'}).optional(),
  simulationCount: z.coerce.number().int().min(10, { message: "Mínimo de 10 simulações." }).max(1000, { message: "Máximo de 1000 simulações." }).optional(),
  confidenceLevel: z.coerce.number().min(1).max(99.9),
  manualData: z.string().optional(),
  timeForCalc: z.coerce.number().gt(0, "O tempo deve ser positivo").optional(),
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

interface CalculationResult {
    reliability: { median: number; lower: number; upper: number };
    failureProb: { median: number; lower: number; upper: number };
}

interface SimulationResult {
  boundsData?: FisherBoundsData;
  dispersionData?: PlotData[];
  originalPlot?: PlotData;
  calculation?: CalculationResult;
}

const generateWeibullFailureTime = (beta: number, eta: number): number => {
  const u = Math.random();
  return eta * Math.pow(-Math.log(1 - u), 1 / beta);
};

const FisherMatrixPlot = ({ data, showLower, showUpper, timeForCalc }: { data?: FisherBoundsData, showLower: boolean, showUpper: boolean, timeForCalc?: number }) => {
    if (!data) return null;

    const { points, line, lower, upper, rSquared, beta, eta, confidenceLevel, calculation } = data;

    const probabilityTicks = [0.1, 1, 5, 10, 20, 30, 50, 70, 90, 99, 99.9];
    
    const transformedY = (prob: number) => Math.log(Math.log(1 / (1 - prob)));
    const logTime = (time: number) => Math.log(time);
    
    let series = [
        {
            name: 'Dados',
            type: 'scatter',
            data: points.map(p => [logTime(p.time), transformedY(p.prob)]),
            symbolSize: 8,
            itemStyle: { color: 'hsl(var(--primary))' }
        },
        {
            name: `Ajuste Mediano`,
            type: 'line',
            data: line.map(p => [p.x, p.y]),
            showSymbol: false,
            smooth: true,
            lineStyle: { width: 2, color: 'hsl(var(--accent))' },
        },
    ];

    if (showLower) {
        series.push({
            name: `Limite Inferior ${confidenceLevel}%`,
            type: 'line',
            data: lower.map(p => [logTime(p.time), p.y]),
            showSymbol: false,
            smooth: true,
            lineStyle: { width: 1.5, type: 'dashed', color: 'hsl(var(--chart-2))' },
        });
    }
     if (showUpper) {
        series.push({
            name: `Limite Superior ${confidenceLevel}%`,
            type: 'line',
            data: upper.map(p => [logTime(p.time), p.y]),
            showSymbol: false,
            smooth: true,
            lineStyle: { width: 1.5, type: 'dashed', color: 'hsl(var(--chart-2))' },
        });
    }

    if (timeForCalc && calculation) {
        const { failureProb } = calculation;
        const logTimeForCalc = logTime(timeForCalc);
        const yLower = transformedY(failureProb.lower);
        const yMedian = transformedY(failureProb.median);
        const yUpper = transformedY(failureProb.upper);

        const yAxisMin = transformedY(0.001);
        const xAxisMin = Math.min(...points.map(p => logTime(p.time)));


        series.push({
            name: 'Projeção',
            type: 'line',
            data: [
                [logTimeForCalc, yAxisMin],
                [logTimeForCalc, yLower],
                [xAxisMin, yLower],
                [logTimeForCalc, yLower],
                [logTimeForCalc, yMedian],
                [xAxisMin, yMedian],
                [logTimeForCalc, yMedian],
                [logTimeForCalc, yUpper],
                [xAxisMin, yUpper],
            ],
            showSymbol: false,
            lineStyle: {
                type: 'dashed',
                color: 'hsl(var(--chart-5))',
                width: 1.5
            },
            z: 10,
            animation: false,
            label: {
                show: true,
                position: 'start',
                formatter: (params: any) => {
                    if (params.dataIndex === 2) return `F inf: ${(failureProb.lower * 100).toFixed(1)}%`;
                    if (params.dataIndex === 5) return `F med: ${(failureProb.median * 100).toFixed(1)}%`;
                    if (params.dataIndex === 8) return `F sup: ${(failureProb.upper * 100).toFixed(1)}%`;
                    return '';
                },
                color: 'hsl(var(--chart-5))',
                fontSize: 10,
                distance: 8
            }
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
                        return `Tempo: ${Math.round(Math.exp(value))}`;
                     }
                }
            },
        },
        legend: {
            data: series.map(s => s.name).filter(name => name !== 'Dados' && name !== 'Projeção'),
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
                    try {
                        const prob = (1 - Math.exp(-Math.exp(value))) * 100;
                        const roundedProb = Math.round(prob);
                        // Show labels only for the ticks we want to display
                        if (probabilityTicks.some(tick => Math.abs(tick - prob) < 0.1 || Math.abs(tick - roundedProb) < 0.1)) {
                             if (prob < 1) return prob.toFixed(1);
                             return roundedProb;
                        }
                    } catch (e) {
                        return '';
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

const ResultsDisplay = ({ result, timeForCalc }: { result: SimulationResult, timeForCalc?: number }) => {
    if (!result.calculation || timeForCalc === undefined) return null;
    
    const { reliability, failureProb } = result.calculation;

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
                                <TableHead className="text-right">Valor</TableHead>
                                <TableHead className="text-right">Lim. Inferior</TableHead>
                                <TableHead className="text-right">Lim. Superior</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell className="font-medium">Confiabilidade (R(t))</TableCell>
                                <TableCell className="text-right font-mono">{(reliability.median * 100).toFixed(2)}%</TableCell>
                                <TableCell className="text-right font-mono">{(reliability.lower * 100).toFixed(2)}%</TableCell>
                                <TableCell className="text-right font-mono">{(reliability.upper * 100).toFixed(2)}%</TableCell>
                            </TableRow>
                             <TableRow>
                                <TableCell className="font-medium">Prob. de Falha (F(t))</TableCell>
                                <TableCell className="text-right font-mono">{(failureProb.median * 100).toFixed(2)}%</TableCell>
                                <TableCell className="text-right font-mono">{(failureProb.lower * 100).toFixed(2)}%</TableCell>
                                <TableCell className="text-right font-mono">{(failureProb.upper * 100).toFixed(2)}%</TableCell>
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
                     {isFinite(reliability.median) && timeForCalc ? (
                        <>
                            <p>
                                Para um tempo de <strong className="text-foreground">{timeForCalc} horas</strong>, a confiabilidade estimada (melhor palpite) é de <strong className="text-primary">{(reliability.median * 100).toFixed(2)}%</strong>.
                            </p>
                            <p>
                                O intervalo de confiança de <strong className="text-foreground">{result.boundsData?.confidenceLevel}%</strong> significa que podemos afirmar com essa certeza que a <strong className="text-foreground">verdadeira confiabilidade</strong> do equipamento está entre <strong className="text-primary">{(reliability.lower * 100).toFixed(2)}%</strong> (pior cenário) e <strong className="text-primary">{(reliability.upper * 100).toFixed(2)}%</strong> (melhor cenário).
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
      timeForCalc: 700,
    },
  });

  const timeForCalc = form.watch('timeForCalc');
  
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
        timeForCalc: 700,
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

    const boundsData = calculateFisherConfidenceBounds(failureTimes, data.confidenceLevel, data.timeForCalc);
    
    if (!boundsData) {
        throw new Error("Não foi possível calcular os limites de confiança.");
    }
    setResult({ boundsData, calculation: boundsData.calculation });
  }

  const runDispersionSimulation = (data: FormData) => {
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

  const onSubmit = (data: FormData) => {
    setIsSimulating(true);
    setResult(null);

    // Usar um pequeno timeout para permitir a atualização da UI antes do processamento pesado
    setTimeout(() => {
        try {
            if (simulationType === 'confidence') {
                runConfidenceSimulation(data);
            } else { 
                runDispersionSimulation(data);
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

  // Function to perform linear interpolation
  const interpolateY = (points: { time: number; y: number }[], targetTime: number): number => {
    if (points.length < 2) return NaN;

    // Find the two points to interpolate between
    let p1 = null, p2 = null;
    for (let i = 0; i < points.length - 1; i++) {
        if (points[i].time <= targetTime && points[i+1].time >= targetTime) {
            p1 = points[i];
            p2 = points[i+1];
            break;
        }
    }
    // Handle edge cases where targetTime is outside the range
    if (!p1 || !p2) {
      if (targetTime < points[0].time) {
        p1 = points[0];
        p2 = points[1];
      } else {
        p1 = points[points.length - 2];
        p2 = points[points.length - 1];
      }
    }
    
    if (p2.time === p1.time) return p1.y; // Avoid division by zero

    const t = (targetTime - p1.time) / (p2.time - p1.time);
    return p1.y + t * (p2.y - p1.y);
  };


  // Recalculate table when timeForCalc changes, if data is available
  useEffect(() => {
    if (result?.boundsData && timeForCalc && simulationType === 'confidence') {
       const { beta, eta, lower: lowerBounds, upper: upperBounds } = result.boundsData;
       if (!beta || !eta) return;
       
       const logTimeCalc = Math.log(timeForCalc);
       const y_median = beta * logTimeCalc - beta * Math.log(eta);
       const prob_median = 1 - Math.exp(-Math.exp(y_median));

       const y_lower = interpolateY(lowerBounds, timeForCalc);
       const y_upper = interpolateY(upperBounds, timeForCalc);
        
       const prob_lower = 1 - Math.exp(-Math.exp(y_lower));
       const prob_upper = 1 - Math.exp(-Math.exp(y_upper));

        if (!isNaN(prob_median) && !isNaN(prob_lower) && !isNaN(prob_upper)) {
          const calculation: CalculationResult = {
              failureProb: { median: prob_median, lower: prob_lower, upper: prob_upper },
              reliability: { median: 1 - prob_median, upper: 1 - prob_upper, lower: 1 - prob_lower }
          };
          setResult(prev => prev ? ({ ...prev, calculation, boundsData: { ...prev.boundsData!, calculation } }) : null);
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeForCalc, result?.boundsData?.beta, result?.boundsData?.eta]);


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
                    <FisherMatrixPlot data={result.boundsData} showLower={showLower} showUpper={showUpper} timeForCalc={timeForCalc} />
                )}

                {result?.dispersionData && simulationType === 'dispersion' && (
                    <DispersionPlot original={result.originalPlot} simulations={result.dispersionData} />
                )}

                {!isSimulating && result?.boundsData && simulationType === 'confidence' && (
                    <ResultsDisplay result={result} timeForCalc={timeForCalc} />
                )}
            </div>
        </div>
    </div>
  );
}


