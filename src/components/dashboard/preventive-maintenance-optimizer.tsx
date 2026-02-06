'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, ReferenceDot } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, Lightbulb, Target, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { AssetData } from '@/lib/types';
import { useI18n } from '@/i18n/i18n-provider';
import { weibullSurvival } from '@/lib/reliability';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

const formSchema = z.object({
  costCp: z.coerce.number().min(1, 'O custo deve ser maior que zero.'),
  costCu: z.coerce.number().min(1, 'O custo deve ser maior que zero.'),
});

interface OptimizerProps {
  asset: AssetData;
}

const BetaAnalysis = ({ beta, t }: { beta: number, t: (key: string) => string }) => {
    let interpretation, Icon, colorClass, phase;

    if (beta < 1) {
        interpretation = t('weibullAnalysis.beta.infantMortality.interpretation');
        Icon = TrendingDown;
        colorClass = "text-green-500";
        phase = t('weibullAnalysis.beta.infantMortality.phase');
    } else if (beta > 0.95 && beta < 1.05) {
        interpretation = t('weibullAnalysis.beta.usefulLife.interpretation');
        Icon = Minus;
        colorClass = "text-yellow-500";
        phase = t('weibullAnalysis.beta.usefulLife.phase');
    } else { // beta > 1
        interpretation = t('weibullAnalysis.beta.wearOut.interpretation');
        Icon = TrendingUp;
        colorClass = "text-red-500";
        phase = t('weibullAnalysis.beta.wearOut.phase');
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-muted ${colorClass}`}>
                    <Icon className="h-6 w-6" />
                </div>
                <div>
                    <p className="font-bold text-lg">{beta.toFixed(2)}</p>
                    <p className="text-sm font-medium text-muted-foreground">{t('parameters.beta')}</p>
                </div>
            </div>
            <p className="text-xs text-muted-foreground pl-1">
                <strong className={`font-semibold ${colorClass}`}>{phase}:</strong> {interpretation}
            </p>
        </div>
    );
};

const EtaAnalysis = ({ eta, t }: { eta: number, t: (key: string) => string }) => {
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-blue-500">
                    <Target className="h-6 w-6" />
                </div>
                <div>
                    <p className="font-bold text-lg">{Math.round(eta)}</p>
                    <p className="text-sm font-medium text-muted-foreground">{t('parameters.eta')}</p>
                </div>
            </div>
            <p className="text-xs text-muted-foreground pl-1">
                {t('weibullAnalysis.eta.description')}
            </p>
        </div>
    );
};


export default function PreventiveMaintenanceOptimizer({ asset }: OptimizerProps) {
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const { t } = useI18n();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { costCp: 1000, costCu: 5000 },
  });
  
  const costCp = form.watch('costCp');
  const costCu = form.watch('costCu');

  const runCalculation = useCallback(() => {
    if (!asset.beta || !asset.eta || !costCp || !costCu) {
      return;
    }
    
    setIsCalculating(true);
    setResult(null);

    setTimeout(() => {
        try {
            const { beta, eta } = asset;

            const maxTime = eta * 3;
            const steps = 200;
            const timePoints = Array.from({ length: steps + 1 }, (_, i) => (i / steps) * maxTime);

            const mttf_curve = [];
            let cumulativeIntegral = 0;
            for (let i = 1; i < timePoints.length; i++) {
                const t_i = timePoints[i];
                const t_prev = timePoints[i-1];
                const dt = t_i - t_prev;
                const R_avg = (weibullSurvival(t_i, beta, eta) + weibullSurvival(t_prev, beta, eta)) / 2;
                cumulativeIntegral += R_avg * dt;
                mttf_curve.push({ time: t_i, mttf: cumulativeIntegral });
            }

            const costCurve = mttf_curve.map(point => {
                const t_i = point.time;
                const mttf_t = point.mttf;
                if (t_i < 1 || mttf_t < 1e-9) return null;

                const R_t = weibullSurvival(t_i, beta, eta);
                const F_t = 1 - R_t;
                const cost_t = (costCp * R_t + costCu * F_t) / mttf_t;
                
                return isFinite(cost_t) ? { time: t_i, cost: cost_t } : null;
            }).filter((p): p is { time: number; cost: number } => p !== null);

            if (costCurve.length === 0) {
                throw new Error('Não foi possível calcular a curva de custo.');
            }

            let minCost = Infinity;
            let optimalInterval = 0;
            costCurve.forEach(point => {
                if (point.cost < minCost) {
                    minCost = point.cost;
                    optimalInterval = point.time;
                }
            });

            setResult({ costCurve, optimalInterval, minCost });
        } catch (error) {
             toast({
                variant: 'destructive',
                title: t('toasts.simulationError.title'),
                description: 'Cálculo de otimização falhou. Verifique os parâmetros do ativo.'
            });
        } finally {
            setIsCalculating(false);
        }
    }, 50);
  }, [asset.beta, asset.eta, costCp, costCu, t, toast]);
  
  useEffect(() => {
    if (asset.beta && asset.eta) {
      runCalculation();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset.beta, asset.eta, costCp, costCu]);
  
  if (!asset.beta || !asset.eta) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('assetDetail.weibullAndOptimize.title')}</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground">{t('assetDetail.optimizePM.noWeibull')}</p>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card>
        <CardHeader>
            <CardTitle>{t('assetDetail.weibullAndOptimize.title')}</CardTitle>
            <CardDescription>{t('assetDetail.weibullAndOptimize.description')}</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {asset.beta != null && <BetaAnalysis beta={asset.beta} t={t} />}
                {asset.eta != null && <EtaAnalysis eta={asset.eta} t={t} />}
            </div>

            <Separator className="my-6" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                <div className="md:col-span-1">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(runCalculation)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="costCp"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('assetDetail.optimizePM.costCpLabel')}</FormLabel>
                                        <FormControl><Input type="number" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="costCu"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('assetDetail.optimizePM.costCuLabel')}</FormLabel>
                                        <FormControl><Input type="number" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            {/* The button is removed as calculation is now automatic on value change */}
                        </form>
                    </Form>
                </div>
                <div className="md:col-span-2">
                    {isCalculating && (
                        <div className="flex items-center justify-center h-full min-h-[300px] bg-muted rounded-md">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    )}
                    {!isCalculating && !result && (
                        <div className="flex flex-col items-center justify-center h-full min-h-[300px] bg-muted rounded-md text-center p-4">
                            <p className="text-sm text-muted-foreground">{t('assetDetail.optimizePM.noWeibull')}</p>
                        </div>
                    )}
                    {result && (
                        <div className="space-y-4">
                            <Alert>
                                <AlertTitle>{t('assetDetail.optimizePM.resultTitle')}</AlertTitle>
                                <AlertDescription className="grid grid-cols-2 gap-4 mt-2">
                                    <div>
                                        <p className="text-xs text-muted-foreground">{t('assetDetail.optimizePM.optimalInterval')}</p>
                                        <p className="text-xl font-bold text-primary">{Math.round(result.optimalInterval).toLocaleString()} {asset.units}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">{t('assetDetail.optimizePM.minimumCost')}</p>
                                        <p className="text-xl font-bold text-primary">${result.minCost.toFixed(2)}</p>
                                    </div>
                                </AlertDescription>
                            </Alert>
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">{t('assetDetail.optimizePM.chartTitle')}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={250}>
                                        <LineChart data={result.costCurve} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']} tickFormatter={(tick) => tick.toLocaleString()} />
                                            <YAxis dataKey="cost" name={t('assetDetail.optimizePM.yAxis')} domain={['dataMin', 'dataMax']} tickFormatter={(tick) => `$${tick.toPrecision(2)}`} />
                                            <Tooltip
                                                formatter={(value: number, name, props) => [`$${value.toFixed(2)}`, t('assetDetail.optimizePM.yAxis')]}
                                                labelFormatter={(label) => `${t('charts.time')}: ${Math.round(label)}`}
                                            />
                                            <Line type="monotone" dataKey="cost" stroke="hsl(var(--primary))" dot={false} strokeWidth={2} />
                                            {result.optimalInterval > 0 && (
                                                <ReferenceLine x={result.optimalInterval} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
                                            )}
                                            <ReferenceDot x={result.optimalInterval} y={result.minCost} r={5} fill="hsl(var(--destructive))" stroke="white" />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                             <Alert>
                                <Lightbulb className="h-4 w-4" />
                                <AlertTitle>{t('assetDetail.optimizePM.interpretationTitle')}</AlertTitle>
                                <AlertDescription>
                                    <ul className="list-disc space-y-2 pl-5 mt-2">
                                        <li dangerouslySetInnerHTML={{ __html: t('assetDetail.optimizePM.interpretation1') }} />
                                        <li dangerouslySetInnerHTML={{ __html: t('assetDetail.optimizePM.interpretation2') }} />
                                        <li dangerouslySetInnerHTML={{ __html: t('assetDetail.optimizePM.interpretation3') }} />
                                    </ul>
                                </AlertDescription>
                            </Alert>
                        </div>
                    )}
                </div>
            </div>
        </CardContent>
    </Card>
  );
}
