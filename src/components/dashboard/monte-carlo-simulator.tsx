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

const formSchema = z.object({
  beta: z.coerce.number().gt(0, { message: 'Beta (β) deve ser maior que zero.' }),
  eta: z.coerce.number().gt(0, { message: 'Eta (η) deve ser maior que zero.' }),
  simulations: z.coerce.number().int().min(100, { message: 'Mínimo de 100 simulações.' }).max(100000, { message: 'Máximo de 100.000 simulações.' }),
  failureCost: z.coerce.number().min(0, { message: 'O custo não pode ser negativo.' }),
});

type FormData = z.infer<typeof formSchema>;

interface SimulationResult {
  mttf: number;
  totalCost: number;
  failureTimes: number[];
  histogramData: { time: string; failures: number }[];
}

// Função para gerar um tempo de falha aleatório a partir de uma distribuição Weibull
const generateWeibullFailureTime = (beta: number, eta: number): number => {
  const u = Math.random();
  // Inversão da CDF de Weibull
  return eta * Math.pow(-Math.log(1 - u), 1 / beta);
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

    // Simulação em um worker ou timeout para não bloquear a UI
    setTimeout(() => {
      const failureTimes = Array.from({ length: data.simulations }, () =>
        generateWeibullFailureTime(data.beta, data.eta)
      );

      const sumOfFailureTimes = failureTimes.reduce((acc, time) => acc + time, 0);
      const mttf = sumOfFailureTimes / data.simulations;
      const totalCost = data.simulations * data.failureCost;

      // Gerar dados para o histograma
      const maxTime = Math.max(...failureTimes);
      const binCount = 20;
      const binSize = maxTime / binCount;
      const bins = Array(binCount).fill(0);

      for (const time of failureTimes) {
        const binIndex = Math.min(Math.floor(time / binSize), binCount - 1);
        bins[binIndex]++;
      }

      const histogramData = bins.map((count, index) => ({
        time: `${Math.round(index * binSize)} - ${Math.round((index + 1) * binSize)}`,
        failures: count,
      }));

      setResult({
        mttf,
        totalCost,
        failureTimes,
        histogramData,
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
          <>
            <Card>
              <CardHeader>
                <CardTitle>Resultados da Simulação</CardTitle>
                <CardDescription>
                  Com base em {form.getValues('simulations').toLocaleString()} simulações.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
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
                <CardTitle>Histograma de Falhas</CardTitle>
                <CardDescription>
                  Distribuição dos tempos de falha simulados.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
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
                    <Legend wrapperStyle={{fontSize: "0.8rem"}} />
                    <Bar dataKey="failures" name="Falhas" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
