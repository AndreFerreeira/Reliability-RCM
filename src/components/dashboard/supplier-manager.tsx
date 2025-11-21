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
import type { Supplier, Distribution, EstimationMethod } from '@/lib/types';
import { X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { estimateParameters } from '@/lib/reliability';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import React from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const formSchema = z.object({
  name: z.string().min(1, { message: 'O nome do fornecedor é obrigatório.' }),
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

const DataInputInstructions = ({ isGrouped, hasSuspensions }: { isGrouped: boolean, hasSuspensions: boolean }) => {
    let title = "Tempos até a Falha (TTF)";
    let placeholder = "Ex: 150, 200, 210, 300";
    let description = "Insira um valor por linha ou separe por vírgula/espaço.";

    if (isGrouped) {
        title = "Dados Agrupados (Tempo e Quantidade)";
        placeholder = "Ex:\n150 2\n210 5\n300 1";
        description = "Insira em duas colunas: [Tempo] [Quantidade].";
    } else if (hasSuspensions) {
        title = "Dados com Suspensão (Tempo e Status)";
        placeholder = "Ex:\n150 F\n210 S\n300 F";
        description = "Insira em duas colunas: [Tempo] [F para Falha, S para Suspensão].";
    }
    
    return { title, placeholder, description };
};


export default function SupplierManager({ suppliers, setSuppliers, estimationMethod, setEstimationMethod }: SupplierManagerProps) {
  const { toast } = useToast();
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
  const { title: inputTitle, placeholder: inputPlaceholder, description: inputDescription } = DataInputInstructions({ isGrouped, hasSuspensions });

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (suppliers.length >= 5) {
      toast({
        variant: 'destructive',
        title: 'Limite Atingido',
        description: 'Você pode comparar um máximo de 5 fornecedores por vez.',
      });
      return;
    }
    
    let failureTimes: number[] = [];
    let suspensionTimes: number[] = [];

    const rawInput = values.failureTimes.trim();

    try {
        if (values.hasSuspensions) {
            const lines = rawInput.split('\n');
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
                       throw new Error(`Linha inválida encontrada: "${line}". Use o formato [Tempo] [Status].`);
                    }
                } else {
                    throw new Error(`Linha inválida encontrada: "${line}". Use o formato [Tempo] [Status].`);
                }
            });
        } else {
             // Logic for simple or grouped data
             // Remove dots as thousand separators before parsing
             failureTimes = rawInput.replace(/\./g, '').split(/[\s,]+/).map(v => parseFloat(v.trim())).filter(v => !isNaN(v) && v > 0);
        }

        if (failureTimes.length === 0) {
            throw new Error('Pelo menos um ponto de falha válido é necessário para a análise.');
        }

    } catch (e: any) {
        toast({
            variant: 'destructive',
            title: 'Erro ao Processar Dados',
            description: e.message || 'Verifique o formato dos dados de entrada.'
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
    form.reset();
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
              <Label htmlFor={`beta-${supplier.id}`} className="text-xs text-muted-foreground">β (Beta)</Label>
              <Input id={`beta-${supplier.id}`} type="number" step="0.01" className="h-8 text-sm" value={supplier.params.beta?.toFixed(2) ?? ''} onChange={(e) => handleParamChange(supplier.id, 'beta', e.target.value)} />
            </div>
            <div>
              <Label htmlFor={`eta-${supplier.id}`} className="text-xs text-muted-foreground">η (Eta)</Label>
              <Input id={`eta-${supplier.id}`} type="number" step="0.01" className="h-8 text-sm" value={supplier.params.eta?.toFixed(2) ?? ''} onChange={(e) => handleParamChange(supplier.id, 'eta', e.target.value)} />
            </div>
            <div>
                <Label htmlFor={`rho-${supplier.id}`} className="text-xs text-muted-foreground">ρ (R²)</Label>
                <Input id={`rho-${supplier.id}`} type="number" step="0.01" className="h-8 text-sm" value={supplier.params.rho?.toFixed(2) ?? ''} onChange={(e) => handleParamChange(supplier.id, 'rho', e.target.value)} disabled />
            </div>
          </>
        );
      case 'Normal':
      case 'Lognormal':
        return (
          <>
            <div>
              <Label htmlFor={`mean-${supplier.id}`} className="text-xs text-muted-foreground">{supplier.distribution === 'Lognormal' ? 'μ (Log-Média)' : 'μ (Média)'}</Label>
              <Input id={`mean-${supplier.id}`} type="number" step="0.01" className="h-8 text-sm" value={supplier.params.mean?.toFixed(2) ?? ''} onChange={(e) => handleParamChange(supplier.id, 'mean', e.target.value)} />
            </div>
            <div>
              <Label htmlFor={`stdDev-${supplier.id}`} className="text-xs text-muted-foreground">{supplier.distribution === 'Lognormal' ? 'σ (Log-DP)' : 'σ (DP)'}</Label>
              <Input id={`stdDev-${supplier.id}`} type="number" step="0.01" className="h-8 text-sm" value={supplier.params.stdDev?.toFixed(2) ?? ''} onChange={(e) => handleParamChange(supplier.id, 'stdDev', e.target.value)} />
            </div>
          </>
        );
      case 'Exponential':
        return (
          <div className="col-span-2">
            <Label htmlFor={`lambda-${supplier.id}`} className="text-xs text-muted-foreground">λ (Taxa)</Label>
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
            <CardTitle>Entrada de Dados</CardTitle>
            <CardDescription>Adicione um novo fornecedor para análise.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Fornecedor</FormLabel>
                    <FormControl>
                      <Input placeholder="ex: Fornecedor D" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Card className="bg-muted/30">
                  <CardHeader className="pb-4">
                      <CardTitle className="text-base">Configurações da Análise</CardTitle>
                  </CardHeader>
                  <CardContent>
                      <RadioGroup
                          defaultValue={estimationMethod}
                          onValueChange={(value: EstimationMethod) => setEstimationMethod(value)}
                          className="grid grid-cols-2 gap-4"
                      >
                          <Label
                              htmlFor="srm"
                              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                          >
                              <RadioGroupItem value="SRM" id="srm" className="sr-only" />
                              SRM
                              <span className="text-xs text-muted-foreground">Regressão</span>
                          </Label>
                          <Label
                              htmlFor="mle"
                              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                          >
                              <RadioGroupItem value="MLE" id="mle" className="sr-only" />
                              MLE
                              <span className="text-xs text-muted-foreground">Verossimilhança</span>
                          </Label>
                      </RadioGroup>
                  </CardContent>
              </Card>

              <Card className="bg-muted/30">
                <CardHeader className="pb-4">
                    <CardTitle className="text-base">Configuração dos Dados</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="units"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unidades</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Hora (h)">Hora (h)</SelectItem>
                              <SelectItem value="Dia">Dia</SelectItem>
                              <SelectItem value="Ciclo">Ciclo</SelectItem>
                              <SelectItem value="Km">Km</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="space-y-2 pt-2">
                        <Label className="text-sm font-medium">Opções para Dados</Label>
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
                                                if (checked) {
                                                    form.setValue('hasIntervals', false);
                                                    form.setValue('isGrouped', false);
                                                }
                                            }} 
                                        />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel>O conjunto de dados contém suspensões</FormLabel>
                                        <FormDescription>Dados censurados à direita (itens que não falharam).</FormDescription>
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
                                                if (checked) {
                                                    form.setValue('hasIntervals', false);
                                                    form.setValue('hasSuspensions', false);
                                                }
                                            }}
                                        />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel>Entrar com dados agrupados</FormLabel>
                                        <FormDescription>Múltiplos itens com o mesmo tempo de falha.</FormDescription>
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
                                        <FormLabel>O conjunto de dados contém intervalos (Em breve)</FormLabel>
                                        <FormDescription>Dados censurados por intervalo e/ou à esquerda.</FormDescription>
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
                    <FormLabel>Distribuição de Probabilidade</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma distribuição" />
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
              <Button type="submit" className="w-full">Adicionar Fornecedor</Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">Fornecedores Atuais</h3>
        <div className="space-y-2">
        {suppliers.length === 0 && <p className="text-sm text-center text-muted-foreground py-4">Nenhum fornecedor adicionado ainda.</p>}
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
                <Button variant="ghost" size="icon" onClick={() => removeSupplier(supplier.id)} aria-label={`Remover ${supplier.name}`}>
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
          </div>
        ))}
        </div>
      </div>
    </div>
  );
}
