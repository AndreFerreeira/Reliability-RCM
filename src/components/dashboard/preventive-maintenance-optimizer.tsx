'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, ReferenceDot } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { AssetData } from '@/lib/types';
import { useI18n } from '@/i18n/i18n-provider';
import { weibullSurvival } from '@/lib/reliability';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  costCp: z.coerce.number().min(1, 'O custo deve ser maior que zero.'),
  costCu: z.coerce.number().min(1, 'O custo deve ser maior que zero.'),
});

interface OptimizerProps {
  asset: AssetData;
}

interface CalculationResult {
  costCurve: { time: number; cost: number; }[];
  optimalInterval: number;
  minCost: number;
}

export default function PreventiveMaintenanceOptimizer({ asset }: OptimizerProps) {
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const { t } = useI18n();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { costCp: 1000, costCu: 5000 },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    setIsCalculating(true);
    setResult(null);

    setTimeout(() => {
        if (!asset.beta || !asset.eta) {
            toast({
                variant: 'destructive',
                title: t('toasts.estimationError.title'),
                description: t('assetDetail.optimizePM.noWeibull')
            });
            setIsCalculating(false);
            return;
        }

        const { costCp, costCu } = data;
        const { beta, eta } = asset;

        const maxTime = eta * 3;
        const steps = 200;
        const timePoints = Array.from({ length: steps + 1 }, (_, i) => (i / steps) * maxTime);
        const R_t_curve = timePoints.map(t => ({ time: t, value: weibullSurvival(t, beta, eta) }));

        const mttf_curve = [];
        let cumulativeIntegral = 0;
        for (let i = 1; i < R_t_curve.length; i++) {
            const dt = R_t_curve[i].time - R_t_curve[i - 1].time;
            const avg_R = (R_t_curve[i].value + R_t_curve[i - 1].value) / 2;
            cumulativeIntegral += avg_R * dt;
            mttf_curve.push({ time: R_t_curve[i].time, value: cumulativeIntegral });
        }

        const costCurve = [];
        for (let i = 0; i < mttf_curve.length; i++) {
            const t = mttf_curve[i].time;
            const mttf_t = mttf_curve[i].value;
            if (t < 1 || mttf_t < 1e-6) continue;

            const R_t = R_t_curve[i].value;
            const F_t = 1 - R_t;
            const cost_t = (costCp * R_t + costCu * F_t) / mttf_t;
            
            if (isFinite(cost_t)) {
                costCurve.push({ time: t, cost: cost_t });
            }
        }

        if (costCurve.length === 0) {
            toast({
                variant: 'destructive',
                title: t('toasts.simulationError.title'),
                description: 'Não foi possível calcular a curva de custo.'
            });
            setIsCalculating(false);
            return;
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
        setIsCalculating(false);
    }, 50);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        <div className="md:col-span-1">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                    <Button type="submit" disabled={isCalculating} className="w-full">
                        {isCalculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {isCalculating ? t('assetDetail.optimizePM.calculating') : t('assetDetail.optimizePM.calculateButton')}
                    </Button>
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
                </div>
            )}
        </div>
    </div>
  );
}
