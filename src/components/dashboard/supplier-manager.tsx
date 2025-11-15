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

const formSchema = z.object({
  name: z.string().min(1, { message: 'Supplier name is required.' }),
  failureTimes: z.string().min(1, { message: 'Please enter failure times.' }).refine(
    (val) => {
      const nums = val.split(',').map(v => v.trim()).filter(v => v !== '');
      return nums.every(num => !isNaN(parseFloat(num)) && parseFloat(num) >= 0);
    },
    { message: 'Must be a comma-separated list of non-negative numbers.' }
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
  setSuppliers: (suppliers: Supplier[] | ((prev: Supplier[]) => Supplier[])) => void;
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
        title: 'Limit Reached',
        description: 'You can compare a maximum of 5 suppliers at a time.',
      });
      return;
    }
    
    const failureTimes = values.failureTimes.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
    const newSupplier: Supplier = {
      id: new Date().getTime().toString(),
      name: values.name,
      failureTimes: failureTimes,
      color: chartColors[suppliers.length % chartColors.length],
    };
    setSuppliers(prev => [...prev, newSupplier]);
    form.reset();
  }

  function removeSupplier(id: string) {
    setSuppliers(prev => prev.filter(s => s.id !== id));
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
                    <FormLabel>Supplier Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Supplier D" {...field} />
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
                    <FormLabel>Failure Times (TTF)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., 150, 200, 210, 300"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full">Add Supplier</Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">Current Suppliers</h3>
        <div className="space-y-2">
        {suppliers.length === 0 && <p className="text-sm text-center text-muted-foreground py-4">No suppliers added yet.</p>}
        {suppliers.map(supplier => (
          <div key={supplier.id} className="flex items-center justify-between rounded-md border p-3">
            <div className="flex items-center gap-3">
              <div className="w-2 h-8 rounded-full" style={{ backgroundColor: supplier.color }} />
              <span className="font-medium">{supplier.name}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => removeSupplier(supplier.id)} aria-label={`Remove ${supplier.name}`}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        </div>
      </div>
    </div>
  );
}
