'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { Supplier } from '@/lib/types';
import { X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { estimateWeibullParameters } from '@/lib/reliability';
import { Label } from '@/components/ui/label';

const formSchema = z.object({
  name: z.string().min(1, { message: 'O nome do fornecedor é obrigatório.' }),
  failureTimes: z.string().min(1, { message: 'Por favor, insira os tempos até a falha.' }).refine(
    (val) => {
      // Allow comma, space, or newline as separators. Remove dots before parsing.
      const nums = val.split(/[\s,]+/).map(v => v.trim().replace(/\./g, '')).filter(v => v !== '');
      return nums.length > 1 && nums.every(num => !isNaN(parseFloat(num)) && parseFloat(num) >= 0);
    },
    { message: 'Deve ser uma lista de pelo menos 2 números não negativos, separados por vírgula, espaço ou nova linha.' }
  ),
});

const chartColors = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

interface SupplierManagerProps {
  suppliers: Supplier[];
  setSuppliers: (updater: (prev: Supplier[]) => Supplier[]) => void;
}

export default function SupplierManager({ suppliers, setSuppliers }: SupplierManagerProps) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', failureTimes: '' },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (suppliers.length >= 5) {
      toast({
        variant: 'destructive',
        title: 'Limite Atingido',
        description: 'Você pode comparar um máximo de 5 fornecedores por vez.',
      });
      return;
    }
    
    const failureTimes = values.failureTimes.split(/[\s,]+/).map(v => parseFloat(v.trim().replace(/\./g, ''))).filter(v => !isNaN(v));
    const weibullParams = estimateWeibullParameters(failureTimes);

    const newSupplier: Supplier = {
      id: new Date().getTime().toString(),
      name: values.name,
      failureTimes: failureTimes,
      color: chartColors[suppliers.length % chartColors.length],
      ...weibullParams,
    };
    setSuppliers(prev => [...prev, newSupplier]);
    form.reset();
  }

  function removeSupplier(id: string) {
    setSuppliers(prev => {
      const updated = prev.filter(s => s.id !== id);
      // Recolor remaining suppliers
      return updated.map((s, i) => ({ ...s, color: chartColors[i % chartColors.length] }));
    });
  }

  function handleParamChange(id: string, param: 'beta' | 'eta', value: string) {
    const numericValue = parseFloat(value);
    if (!isNaN(numericValue)) {
      setSuppliers(prev => 
        prev.map(s => s.id === id ? { ...s, [param]: numericValue } : s)
      );
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
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
              <FormField
                control={form.control}
                name="failureTimes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tempos até a Falha (TTF)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="ex: 150, 200, 210, 300"
                        {...field}
                      />
                    </FormControl>
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
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-8 rounded-full" style={{ backgroundColor: supplier.color }} />
                    <span className="font-medium">{supplier.name}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeSupplier(supplier.id)} aria-label={`Remover ${supplier.name}`}>
                    <X className="h-4 w-4" />
                </Button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor={`beta-${supplier.id}`} className="text-xs text-muted-foreground">β (Beta)</Label>
                  <Input 
                    id={`beta-${supplier.id}`}
                    type="number" 
                    step="0.01"
                    className="h-8 text-sm"
                    value={supplier.beta.toFixed(2)} 
                    onChange={(e) => handleParamChange(supplier.id, 'beta', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor={`eta-${supplier.id}`} className="text-xs text-muted-foreground">η (Eta)</Label>
                  <Input 
                    id={`eta-${supplier.id}`}
                    type="number" 
                    step="0.01"
                    className="h-8 text-sm"
                    value={supplier.eta.toFixed(2)}
                    onChange={(e) => handleParamChange(supplier.id, 'eta', e.target.value)}
                  />
                </div>
            </div>
          </div>
        ))}
        </div>
      </div>
    </div>
  );
}
