'use client';

import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { Supplier, Distribution, EstimationMethod, DistributionAnalysisResult } from '@/lib/types';
import { X, Wand2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { estimateParameters, findBestDistribution } from '@/lib/reliability';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import React, { useState } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { useI18n } from '@/i18n/i18n-provider';

const formSchema = z.object({
  name: z.string().min(1, { message: 'O nome do equipamento é obrigatório.' }),
  failureTimes: z.string().min(1, { message: 'Por favor, insira os dados de falha.' }).refine(
    (val) => {
      return val.trim().length > 0;
    },
    { message: 'A entrada de dados não pode estar vazia.' }
  ),
  distribution: z.enum(['Weibull', 'Normal', 'Lognormal', 'Exponential']),
  units: z.string().min(1, { message: 'A unidade é obrigatória.' }),
  hasSuspensions: z.boolean(),
  hasIntervals: z.boolean(),
  isGrouped: z.boolean(),
});

const chartColors = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const distributionOptions: Distribution[] = ['Weibull', 'Normal', 'Lognormal', 'Exponential'];

interface SupplierManagerProps {
  suppliers: Supplier[];
  setSuppliers: (updater: (prev: Supplier[]) => Supplier[]) => void;
  estimationMethod: EstimationMethod;
  setEstimationMethod: (method: EstimationMethod) => void;
}

const DataInputInstructions = ({ isGrouped, hasSuspensions, t }: { isGrouped: boolean, hasSuspensions: boolean, t: (key: string) => string }) => {
    let title = t('dataInstructions.simple.title');
    let placeholder = t('dataInstructions.simple.placeholder');
    let description = t('dataInstructions.simple.description');

    if (isGrouped && hasSuspensions) {
        title = t('dataInstructions.groupedSuspensions.title');
        placeholder = t('dataInstructions.groupedSuspensions.placeholder');
        description = t('dataInstructions.groupedSuspensions.description');
    } else if (isGrouped) {
        title = t('dataInstructions.grouped.title');
        placeholder = t('dataInstructions.grouped.placeholder');
        description = t('dataInstructions.grouped.description');
    } else if (hasSuspensions) {
        title = t('dataInstructions.suspensions.title');
        placeholder = t('dataInstructions.suspensions.placeholder');
        description = t('dataInstructions.suspensions.description');
    }
    
    return { title, placeholder, description };
};


const DistributionWizardDialog = ({ supplier, onApply, t }: { supplier: Supplier, onApply: (dist: Distribution) => void, t: (key: string, args?: any) => string }) => {
    const [analysisResults, setAnalysisResults] = useState<DistributionAnalysisResult[]>([]);
    const [bestDist, setBestDist] = useState<Distribution | null>(null);
    const [bestDistExplanation, setBestDistExplanation] = useState('');
    
    const handleAnalyze = () => {
        const { results, best } = findBestDistribution(supplier.failureTimes, supplier.suspensionTimes);
        setAnalysisResults(results);
        setBestDist(best);

        const bestResult = results.find(r => r.distribution === best);
        if (best === "Lognormal" && bestResult?.params.lkv) {
          setBestDistExplanation(t('distributionWizard.explanationLognormal', { lkv: bestResult.logLikelihood.toFixed(2) }));
        } else if (best === "Weibull" && bestResult?.params.lkv) {
            setBestDistExplanation(t('distributionWizard.explanationWeibull', { lkv: bestResult.logLikelihood.toFixed(2) }));
        } else {
            setBestDistExplanation('');
        }
    };

    return (
        <Dialog onOpenChange={(open) => { if(!open) { setAnalysisResults([]); setBestDist(null); setBestDistExplanation('') }}}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full mt-2">
                    <Wand2 className="mr-2 h-4 w-4" />
                    {t('distributionWizard.button')}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{t('distributionWizard.title', { supplierName: supplier.name })}</DialogTitle>
                     <DialogDescription>
                        {t('distributionWizard.description')}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <Button onClick={handleAnalyze}>{t('distributionWizard.analyzeButton')}</Button>
                    
                    {analysisResults.length > 0 && (
                        <>
                            <Card>
                                <CardHeader className="pb-4">
                                     <CardTitle className="text-lg">{t('distributionWizard.howTitle')}</CardTitle>
                                </CardHeader>
                                <CardContent className="text-sm text-foreground/80 space-y-2">
                                    <p>{t('distributionWizard.howIntro')}</p>
                                    <p className="font-semibold text-foreground">{t('distributionWizard.howCriterion')}</p>
                                    <p>{t('distributionWizard.howLkv')}</p>
                                    <p className="text-xs pt-1">{t('distributionWizard.howR2')}</p>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="pt-6">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>{t('distributionWizard.table.distribution')}</TableHead>
                                                <TableHead className="text-right">{t('distributionWizard.table.lkv')}</TableHead>
                                                <TableHead className="text-right">{t('distributionWizard.table.r2')}</TableHead>
                                                <TableHead className="text-right">{t('distributionWizard.table.action')}</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {analysisResults.map(result => (
                                                <TableRow key={result.distribution} className={cn(result.distribution === bestDist && 'bg-primary/10')}>
                                                    <TableCell className="font-medium">
                                                        {result.distribution}
                                                        {result.distribution === bestDist && <Badge variant="secondary" className="ml-2">{t('distributionWizard.table.best')}</Badge>}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono">{result.logLikelihood.toFixed(2)}</TableCell>
                                                    <TableCell className="text-right font-mono">{result.rSquared.toFixed(4)}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="sm" onClick={() => onApply(result.distribution)}>
                                                            {result.distribution === bestDist ? t('distributionWizard.table.applyBest') : t('distributionWizard.table.apply')}
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>

                            {bestDist && (
                                 <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg">{t('distributionWizard.bestDistribution', { bestDist: bestDist })}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-muted-foreground">{bestDistExplanation}</p>
                                    </CardContent>
                                </Card>
                            )}
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};


export default function SupplierManager({ suppliers, setSuppliers, estimationMethod, setEstimationMethod }: SupplierManagerProps) {
  const { toast } = useToast();
  const { t } = useI18n();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { 
      name: '', 
      failureTimes: '', 
      distribution: 'Weibull',
      units: 'Hora (h)',
      hasSuspensions: false,
      hasIntervals: false,
      isGrouped: false,
    },
  });

  const isGrouped = useWatch({ control: form.control, name: 'isGrouped' });
  const hasSuspensions = useWatch({ control: form.control, name: 'hasSuspensions' });
  const { title: inputTitle, placeholder: inputPlaceholder, description: inputDescription } = DataInputInstructions({ isGrouped, hasSuspensions, t });

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (suppliers.length >= 5) {
      toast({
        variant: 'destructive',
        title: t('toasts.limitReached.title'),
        description: t('toasts.limitReached.description'),
      });
      return;
    }
    
    let failureTimes: number[] = [];
    let suspensionTimes: number[] = [];

    const rawInput = values.failureTimes.trim();

    try {
        const lines = rawInput.split('\n').filter(line => line.trim() !== '');

        if (values.isGrouped && values.hasSuspensions) {
            lines.forEach(line => {
                const parts = line.trim().split(/[\s,]+/);
                if (parts.length === 3) {
                    const time = parseFloat(parts[0].replace(/\./g, ''));
                    const numFailures = parseInt(parts[1], 10);
                    const numSuspensions = parseInt(parts[2], 10);
                    if (!isNaN(time) && !isNaN(numFailures) && !isNaN(numSuspensions)) {
                        for (let i = 0; i < numFailures; i++) failureTimes.push(time);
                        for (let i = 0; i < numSuspensions; i++) suspensionTimes.push(time);
                    } else {
                        throw new Error(t('toasts.invalidData.groupedSuspensions', { line }));
                    }
                } else {
                    throw new Error(t('toasts.invalidData.groupedSuspensions', { line }));
                }
            });
        } else if (values.hasSuspensions) {
            lines.forEach(line => {
                const parts = line.trim().split(/[\s,]+/);
                if (parts.length === 2) {
                    const part1 = parts[0].toUpperCase().replace(/\./g, '');
                    const part2 = parts[1].toUpperCase().replace(/\./g, '');
                    
                    const time = parseFloat(part1) || parseFloat(part2);
                    const status = (part1 === 'F' || part2 === 'F') ? 'F' : ((part1 === 'S' || part2 === 'S') ? 'S' : null);

                    if (!isNaN(time) && status) {
                        if (status === 'F') {
                            failureTimes.push(time);
                        } else {
                            suspensionTimes.push(time);
                        }
                    } else {
                       throw new Error(t('toasts.invalidData.suspensions', { line }));
                    }
                } else {
                    throw new Error(t('toasts.invalidData.suspensions', { line }));
                }
            });
        } else if (values.isGrouped) {
             lines.forEach(line => {
                const parts = line.trim().split(/[\s,]+/);
                if (parts.length === 2) {
                    const time = parseFloat(parts[0].replace(/\./g, ''));
                    const quantity = parseInt(parts[1], 10);
                    if (!isNaN(time) && !isNaN(quantity)) {
                        for (let i = 0; i < quantity; i++) {
                            failureTimes.push(time);
                        }
                    } else {
                         throw new Error(t('toasts.invalidData.grouped', { line }));
                    }
                } else {
                     throw new Error(t('toasts.invalidData.grouped', { line }));
                }
            });
        } else {
             failureTimes = rawInput.replace(/\./g, '').split(/[\s,]+/).map(v => parseFloat(v.trim())).filter(v => !isNaN(v) && v > 0);
        }

        if (failureTimes.length === 0 && suspensionTimes.length === 0) {
            throw new Error(t('toasts.invalidData.noData'));
        }

    } catch (e: any) {
        toast({
            variant: 'destructive',
            title: t('toasts.processingError.title'),
            description: e.message || t('toasts.processingError.description')
        });
        return;
    }

    const { params, plotData } = estimateParameters({
      dist: values.distribution,
      failureTimes,
      suspensionTimes,
      method: estimationMethod,
    });

    const newSupplier: Supplier = {
      id: new Date().getTime().toString(),
      name: values.name,
      failureTimes: failureTimes,
      suspensionTimes: suspensionTimes,
      color: chartColors[suppliers.length % chartColors.length],
      distribution: values.distribution as Distribution,
      params,
      units: values.units,
      dataType: {
        hasSuspensions: values.hasSuspensions,
        hasIntervals: values.hasIntervals,
        isGrouped: values.isGrouped,
      },
      plotData: plotData,
    };
    setSuppliers(prev => [...prev, newSupplier]);
    form.reset({ 
      name: '', 
      failureTimes: '', 
      distribution: 'Weibull',
      units: 'Hora (h)',
      hasSuspensions: false,
      hasIntervals: false,
      isGrouped: false,
    });
  }

  function removeSupplier(id: string) {
    setSuppliers(prev => {
      const updated = prev.filter(s => s.id !== id);
      return updated.map((s, i) => ({ ...s, color: chartColors[i % chartColors.length] }));
    });
  }
  
  function handleDistributionChange(id: string, newDistribution: Distribution) {
    setSuppliers(prev => 
      prev.map(s => {
        if (s.id === id) {
          const { params, plotData } = estimateParameters({
            dist: newDistribution,
            failureTimes: s.failureTimes,
            suspensionTimes: s.suspensionTimes,
            method: estimationMethod,
          });
          return { ...s, distribution: newDistribution, params, plotData };
        }
        return s;
      })
    );
  }

  function handleParamChange(id: string, paramName: string, value: string) {
    const numericValue = parseFloat(value);
    if (!isNaN(numericValue)) {
      setSuppliers(prev => 
        prev.map(s => 
          s.id === id 
            ? { ...s, params: { ...s.params, [paramName]: numericValue } }
            : s
        )
      );
    }
  }

  const renderParams = (supplier: Supplier) => {
    switch (supplier.distribution) {
      case 'Weibull':
        return (
          <>
            <div>
              <Label htmlFor={`beta-${supplier.id}`} className="text-xs text-muted-foreground">{t('parameters.beta')}</Label>
              <Input id={`beta-${supplier.id}`} type="number" step="0.01" className="h-8 text-sm" value={supplier.params.beta?.toFixed(2) ?? ''} onChange={(e) => handleParamChange(supplier.id, 'beta', e.target.value)} />
            </div>
            <div>
              <Label htmlFor={`eta-${supplier.id}`} className="text-xs text-muted-foreground">{t('parameters.eta')}</Label>
              <Input id={`eta-${supplier.id}`} type="number" step="0.01" className="h-8 text-sm" value={supplier.params.eta?.toFixed(2) ?? ''} onChange={(e) => handleParamChange(supplier.id, 'eta', e.target.value)} />
            </div>
            <div>
                <Label htmlFor={`rho-${supplier.id}`} className="text-xs text-muted-foreground">{t('parameters.rho')}</Label>
                <Input id={`rho-${supplier.id}`} type="number" step="0.01" className="h-8 text-sm" value={supplier.params.rho?.toFixed(2) ?? ''} onChange={(e) => handleParamChange(supplier.id, 'rho', e.target.value)} disabled />
            </div>
          </>
        );
      case 'Normal':
      case 'Lognormal':
        return (
          <>
            <div>
              <Label htmlFor={`mean-${supplier.id}`} className="text-xs text-muted-foreground">{supplier.distribution === 'Lognormal' ? t('parameters.logMean') : t('parameters.mean')}</Label>
              <Input id={`mean-${supplier.id}`} type="number" step="0.01" className="h-8 text-sm" value={supplier.params.mean?.toFixed(2) ?? ''} onChange={(e) => handleParamChange(supplier.id, 'mean', e.target.value)} />
            </div>
            <div>
              <Label htmlFor={`stdDev-${supplier.id}`} className="text-xs text-muted-foreground">{supplier.distribution === 'Lognormal' ? t('parameters.logStdDev') : t('parameters.stdDev')}</Label>
              <Input id={`stdDev-${supplier.id}`} type="number" step="0.01" className="h-8 text-sm" value={supplier.params.stdDev?.toFixed(2) ?? ''} onChange={(e) => handleParamChange(supplier.id, 'stdDev', e.target.value)} />
            </div>
          </>
        );
      case 'Exponential':
        return (
          <div className="col-span-2">
            <Label htmlFor={`lambda-${supplier.id}`} className="text-xs text-muted-foreground">{t('parameters.lambda')}</Label>
            <Input id={`lambda-${supplier.id}`} type="number" step="0.001" className="h-8 text-sm" value={supplier.params.lambda?.toPrecision(4) ?? ''} onChange={(e) => handleParamChange(supplier.id, 'lambda', e.target.value)} />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
            <CardTitle>{t('supplierManager.dataInputTitle')}</CardTitle>
            <CardDescription>{t('supplierManager.dataInputDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('supplierManager.equipmentLabel')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('supplierManager.equipmentPlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Card className="bg-muted/30">
                  <CardHeader className="pb-4">
                      <CardTitle className="text-base">{t('supplierManager.analysisSettingsTitle')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                      <RadioGroup
                          defaultValue={estimationMethod}
                          onValueChange={(value: EstimationMethod) => setEstimationMethod(value)}
                          className="grid grid-cols-3 gap-4"
                      >
                          <Label
                              htmlFor="srm"
                              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                          >
                              <RadioGroupItem value="SRM" id="srm" className="sr-only" />
                              SRM
                              <span className="text-xs text-muted-foreground">{t('supplierManager.srmLabel')}</span>
                          </Label>
                          <Label
                              htmlFor="mle"
                              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                          >
                              <RadioGroupItem value="MLE" id="mle" className="sr-only" />
                              MLE
                              <span className="text-xs text-muted-foreground">{t('supplierManager.mleLabel')}</span>
                          </Label>
                           <Label
                              htmlFor="rrx"
                              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                          >
                              <RadioGroupItem value="RRX" id="rrx" className="sr-only" />
                              RRX
                              <span className="text-xs text-muted-foreground">{t('supplierManager.rrxLabel')}</span>
                          </Label>
                      </RadioGroup>
                  </CardContent>
              </Card>

              <Card className="bg-muted/30">
                <CardHeader className="pb-4">
                    <CardTitle className="text-base">{t('supplierManager.dataConfigTitle')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="units"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('supplierManager.unitsLabel')}</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Hora (h)">{t('units.hour')}</SelectItem>
                              <SelectItem value="Dia">{t('units.day')}</SelectItem>
                              <SelectItem value="Ciclo">{t('units.cycle')}</SelectItem>
                              <SelectItem value="Km">{t('units.km')}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="space-y-2 pt-2">
                        <Label className="text-sm font-medium">{t('supplierManager.dataOptionsLabel')}</Label>
                        <FormField
                            control={form.control}
                            name="hasSuspensions"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                    <FormControl>
                                        <Checkbox 
                                            checked={field.value} 
                                            onCheckedChange={(checked) => {
                                                field.onChange(checked);
                                                if (checked) form.setValue('hasIntervals', false);
                                            }} 
                                        />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel>{t('supplierManager.hasSuspensionsLabel')}</FormLabel>
                                        <FormDescription>{t('supplierManager.hasSuspensionsDescription')}</FormDescription>
                                    </div>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="isGrouped"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                    <FormControl>
                                        <Checkbox 
                                            checked={field.value} 
                                            onCheckedChange={(checked) => {
                                                field.onChange(checked);
                                                if (checked) form.setValue('hasIntervals', false);
                                            }}
                                        />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel>{t('supplierManager.isGroupedLabel')}</FormLabel>
                                        <FormDescription>{t('supplierManager.isGroupedDescription')}</FormDescription>
                                    </div>
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="hasIntervals"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                    <FormControl>
                                        <Checkbox 
                                            checked={field.value} 
                                            onCheckedChange={(checked) => {
                                                field.onChange(checked);
                                                if (checked) {
                                                    form.setValue('hasSuspensions', false);
                                                    form.setValue('isGrouped', false);
                                                }
                                            }}
                                            disabled // Disabling until logic is implemented
                                        />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel>{t('supplierManager.hasIntervalsLabel')}</FormLabel>
                                        <FormDescription>{t('supplierManager.hasIntervalsDescription')}</FormDescription>
                                    </div>
                                </FormItem>
                            )}
                        />
                    </div>
                </CardContent>
              </Card>
              <FormField
                control={form.control}
                name="failureTimes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{inputTitle}</FormLabel>
                    <FormControl>
                      <Textarea placeholder={inputPlaceholder} {...field} rows={6} />
                    </FormControl>
                    <FormDescription>{inputDescription}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="distribution"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('supplierManager.distributionLabel')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('supplierManager.distributionPlaceholder')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {distributionOptions.map(dist => <SelectItem key={dist} value={dist}>{dist}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full">{t('supplierManager.addButton')}</Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">{t('supplierManager.currentEquipmentsTitle')}</h3>
        <div className="space-y-2">
        {suppliers.length === 0 && <p className="text-sm text-center text-muted-foreground py-4">{t('supplierManager.noEquipments')}</p>}
        {suppliers.map(supplier => (
          <div key={supplier.id} className="rounded-md border p-3">
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-8 rounded-full" style={{ backgroundColor: supplier.color }} />
                    <div className="flex flex-col">
                      <span className="font-medium">{supplier.name}</span>
                      <span className="text-xs text-muted-foreground">{`${supplier.distribution} / ${supplier.units}`}</span>
                    </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeSupplier(supplier.id)} aria-label={`${t('supplierManager.removeAriaLabel')} ${supplier.name}`}>
                    <X className="h-4 w-4" />
                </Button>
            </div>
             <div className="mt-2">
              <Select value={supplier.distribution} onValueChange={(val) => handleDistributionChange(supplier.id, val as Distribution)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {distributionOptions.map(dist => <SelectItem key={dist} value={dist}>{dist}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
                {renderParams(supplier)}
            </div>
             <DistributionWizardDialog supplier={supplier} onApply={(dist) => handleDistributionChange(supplier.id, dist)} t={t} />
          </div>
        ))}
        </div>
      </div>
    </div>
  );
}
