'use client';

import { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { calculateReliabilityData, estimateParameters } from '@/lib/reliability';
import type { Supplier } from '@/lib/types';
import SupplierManager from './supplier-manager';
import ReliabilityCharts from './reliability-charts';
import AiRiskPredictor from './ai-risk-predictor';
import { Logo, Bot, LineChart as LineChartIcon } from '@/components/icons';
import AiComprehensiveAnalysis from './ai-comprehensive-analysis';
import WeibullParameterAnalysis from './weibull-parameter-analysis';
import BathtubCurveAnalysis from './bathtub-curve-analysis';

const initialSuppliersData = [
  { id: '1', name: 'Fornecedor A', failureTimes: [6, 105, 213, 332, 351, 365, 397, 400, 397, 437, 1014, 1126, 1132, 3944, 5042], color: 'hsl(var(--chart-1))', distribution: 'Weibull' as const },
  { id: '2', name: 'Fornecedor B', failureTimes: [120, 180, 250, 300, 380, 420, 500, 580, 650, 700], color: 'hsl(var(--chart-2))', distribution: 'Weibull' as const },
  { id: '3', name: 'Fornecedor C', failureTimes: [80, 110, 160, 200, 230, 290, 330, 380, 450, 520], color: 'hsl(var(--chart-3))', distribution: 'Weibull' as const },
];

const initialSuppliers: Supplier[] = initialSuppliersData.map(s => ({
  ...s,
  params: estimateParameters(s.failureTimes, s.distribution),
}));


export default function ReliabilityDashboard() {
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);

  const handleSetSuppliers = (updater: (prev: Supplier[]) => Supplier[]) => {
    setSuppliers(prev => {
        const updatedSuppliers = updater(prev);
        
        return updatedSuppliers.map(s => {
            const originalSupplier = prev.find(ps => ps.id === s.id);
            // Recalculate if failure times or distribution have changed
            if (
              !originalSupplier || 
              JSON.stringify(originalSupplier.failureTimes) !== JSON.stringify(s.failureTimes) ||
              originalSupplier.distribution !== s.distribution
            ) {
                return { ...s, params: estimateParameters(s.failureTimes, s.distribution) };
            }

            // Also check for manual param overrides. THIS IS A COMPLEX PART.
            // For simplicity, we can assume manual edits are not the primary flow for now
            // and recalculation is okay. Or we add more complex logic to detect manual changes.
            // Let's stick with the simpler recalculation logic.
            if (JSON.stringify(s.params) !== JSON.stringify(originalSupplier.params)) {
              return s; // Keep manual overrides for params
            }

            return originalSupplier;
        });
    });
  };

  const chartData = useMemo(() => calculateReliabilityData(suppliers), [suppliers]);
  const weibullSuppliers = useMemo(() => suppliers.filter(s => s.distribution === 'Weibull' && s.params.beta != null && s.params.eta != null), [suppliers]);

  return (
    <div className="flex-1 space-y-4 p-4 sm:p-6 md:p-8">
      <div className="flex items-center justify-between space-y-2">
        <div className="flex items-center gap-4">
          <Logo className="h-10 w-10 text-accent" />
          <h1 className="text-3xl font-headline font-bold tracking-tight">
            Analisador de Confiabilidade
          </h1>
        </div>
      </div>
      <Tabs defaultValue="analysis" className="space-y-4">
        <TabsList className="grid w-full grid-cols-1 sm:w-auto sm:grid-cols-2">
          <TabsTrigger value="analysis"><LineChartIcon />Análise de Confiabilidade</TabsTrigger>
          <TabsTrigger value="ai_analysis"><Bot />Análise com IA</TabsTrigger>
        </TabsList>
        <TabsContent value="analysis" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-full lg:col-span-2">
              <CardHeader>
                <CardTitle>Dados dos Fornecedores</CardTitle>
                <CardDescription>
                  Gerencie os dados de tempo até a falha para cada fornecedor.
                </CardDescription>
              </CardHeader>
              <CardContent className="pl-2 pr-2 sm:pl-6 sm:pr-6">
                <SupplierManager suppliers={suppliers} setSuppliers={handleSetSuppliers} />
              </CardContent>
            </Card>
            <div className="col-span-full lg:col-span-5 space-y-4">
              <ReliabilityCharts chartData={chartData} suppliers={suppliers} />
              <WeibullParameterAnalysis suppliers={weibullSuppliers} />
              <BathtubCurveAnalysis suppliers={weibullSuppliers} />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="ai_analysis" className="space-y-4">
          <AiRiskPredictor suppliers={suppliers} />
          <AiComprehensiveAnalysis suppliers={suppliers} chartData={chartData} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
