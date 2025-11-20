'use client';

import { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { calculateReliabilityData, estimateParameters } from '@/lib/reliability';
import type { Supplier } from '@/lib/types';
import SupplierManager from './supplier-manager';
import ReliabilityCharts from './reliability-charts';
import AiRiskPredictor from './ai-risk-predictor';
import { Bot, LineChart as LineChartIcon, BrainCircuit } from '@/components/icons';
import AiComprehensiveAnalysis from './ai-comprehensive-analysis';
import WeibullParameterAnalysis from './weibull-parameter-analysis';
import BathtubCurveAnalysis from './bathtub-curve-analysis';
import ProbabilityPaper from './probability-paper';

const initialSuppliersData = [
  { 
    id: '1', 
    name: 'Fornecedor A', 
    failureTimes: [105, 213, 332, 351, 365, 397, 400, 397, 437, 1014, 1126, 1132, 3944, 5042],
    suspensionTimes: [] as number[],
    color: 'hsl(var(--chart-1))', 
    distribution: 'Weibull' as const, 
    units: 'Hora (h)',
    dataType: { hasSuspensions: false, hasIntervals: false, isGrouped: false } 
  },
  { 
    id: '2', 
    name: 'Fornecedor B', 
    failureTimes: [120, 180, 250, 300, 380, 420, 500, 580, 650, 700], 
    suspensionTimes: [] as number[],
    color: 'hsl(var(--chart-2))', 
    distribution: 'Weibull' as const,
    units: 'Hora (h)',
    dataType: { hasSuspensions: false, hasIntervals: false, isGrouped: false } 
  },
];

const initialSuppliers: Supplier[] = initialSuppliersData.map(s => ({
  ...s,
  params: estimateParameters(s.failureTimes, s.distribution, s.suspensionTimes),
}));


export default function ReliabilityDashboard() {
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);

  const handleSetSuppliers = (updater: (prev: Supplier[]) => Supplier[]) => {
    setSuppliers(prev => {
        const updatedSuppliers = updater(prev);
        
        return updatedSuppliers.map(s => {
            const originalSupplier = prev.find(ps => ps.id === s.id);
            if (
              !originalSupplier || 
              JSON.stringify(originalSupplier.failureTimes) !== JSON.stringify(s.failureTimes) ||
              JSON.stringify(originalSupplier.suspensionTimes) !== JSON.stringify(s.suspensionTimes) ||
              originalSupplier.distribution !== s.distribution
            ) {
                return { ...s, params: estimateParameters(s.failureTimes, s.distribution, s.suspensionTimes) };
            }

            if (JSON.stringify(s.params) !== JSON.stringify(originalSupplier.params)) {
              return s; // Keep manual overrides for params
            }

            return originalSupplier;
        });
    });
  };

  const chartData = useMemo(() => calculateReliabilityData(suppliers), [suppliers]);
  const weibullSuppliers = useMemo(() => suppliers.filter(s => s.distribution === 'Weibull' && s.params.beta != null && s.params.eta != null), [suppliers]);
  const allFailureTimes = useMemo(() => suppliers.flatMap(s => s.failureTimes), [suppliers]);

  return (
    <div className="flex-1 space-y-4 p-4 sm:p-6 md:p-8">
      <div className="flex items-center justify-between space-y-2">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-headline font-bold tracking-tight">
            Reliability RCM
          </h1>
        </div>
      </div>
      <Tabs defaultValue="analysis" className="space-y-4">
        <TabsList className="grid w-full grid-cols-1 sm:w-auto sm:grid-cols-3">
          <TabsTrigger value="analysis"><LineChartIcon />Análise de Confiabilidade</TabsTrigger>
          <TabsTrigger value="ai_analysis"><Bot />Análise com IA</TabsTrigger>
          <TabsTrigger value="probability_paper"><BrainCircuit />Papéis de Probabilidade</TabsTrigger>
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
              <BathtubCurveAnalysis failureTimes={allFailureTimes} />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="ai_analysis" className="space-y-4">
          <AiRiskPredictor suppliers={suppliers} />
          <AiComprehensiveAnalysis suppliers={suppliers} chartData={chartData} />
        </TabsContent>
        <TabsContent value="probability_paper" className="space-y-4">
          <ProbabilityPaper />
        </TabsContent>
      </Tabs>
    </div>
  );
}
