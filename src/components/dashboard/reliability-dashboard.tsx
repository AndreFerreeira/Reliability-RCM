'use client';

import { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { calculateReliabilityData, estimateParameters } from '@/lib/reliability';
import type { Supplier, EstimationMethod } from '@/lib/types';
import SupplierManager from './supplier-manager';
import ReliabilityCharts from './reliability-charts';
import AiRiskPredictor from './ai-risk-predictor';
import { Bot, LineChart as LineChartIcon, BrainCircuit, TestTube } from '@/components/icons';
import AiComprehensiveAnalysis from './ai-comprehensive-analysis';
import WeibullParameterAnalysis from './weibull-parameter-analysis';
import BathtubCurveAnalysis from './bathtub-curve-analysis';
import ProbabilityPaper from './probability-paper';
import ProbabilityPlot from './probability-plot';
import MonteCarloSimulator from './monte-carlo-simulator';

const initialSuppliersData = [
  { 
    id: '1', 
    name: 'Equipamento A', 
    failureTimes: [105, 213, 332, 351, 365, 397, 400, 397, 437, 1014, 1126, 1132, 3944, 5042],
    suspensionTimes: [] as number[],
    color: 'hsl(var(--chart-1))', 
    distribution: 'Weibull' as const, 
    units: 'Hora (h)',
    dataType: { hasSuspensions: false, hasIntervals: false, isGrouped: false } 
  },
];

const initialSuppliers: Supplier[] = initialSuppliersData.map(s => {
  const estimationResult = estimateParameters({
    dist: s.distribution, 
    failureTimes: s.failureTimes, 
    suspensionTimes: s.suspensionTimes, 
    method: 'SRM'
  });
  return {
    ...s,
    params: estimationResult.params,
    plotData: estimationResult.plotData
  };
});


export default function ReliabilityDashboard() {
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [estimationMethod, setEstimationMethod] = useState<EstimationMethod>('MLE');

  const handleSetSuppliers = (updater: (prev: Supplier[]) => Supplier[]) => {
    setSuppliers(prev => {
        const updatedSuppliers = updater(prev);
        
        return updatedSuppliers.map(s => {
            const originalSupplier = prev.find(ps => ps.id === s.id);
            const needsReEstimation = !originalSupplier || 
              JSON.stringify(originalSupplier.failureTimes) !== JSON.stringify(s.failureTimes) ||
              JSON.stringify(originalSupplier.suspensionTimes) !== JSON.stringify(s.suspensionTimes) ||
              originalSupplier.distribution !== s.distribution ||
              s.dataType.isGrouped !== originalSupplier.dataType.isGrouped ||
              s.dataType.hasSuspensions !== originalSupplier.dataType.hasSuspensions;

            if (needsReEstimation) {
                const newParamsAndPlotData = estimateParameters({ 
                    dist: s.distribution, 
                    failureTimes: s.failureTimes, 
                    suspensionTimes: s.suspensionTimes, 
                    method: estimationMethod,
                    isGrouped: s.dataType.isGrouped
                });
                return { 
                  ...s, 
                  params: newParamsAndPlotData.params,
                  plotData: newParamsAndPlotData.plotData
                };
            }
            
            // Keep manual overrides for params if data hasn't changed
            if (JSON.stringify(s.params) !== JSON.stringify(originalSupplier.params)) {
              return s; 
            }

            return { ...s, plotData: originalSupplier.plotData, params: originalSupplier.params };
        });
    });
  };

  const chartData = useMemo(() => calculateReliabilityData(suppliers), [suppliers]);
  const weibullSuppliers = useMemo(() => suppliers.filter(s => s.distribution === 'Weibull' && s.params.beta != null && s.params.eta != null), [suppliers]);
  const allFailureTimes = useMemo(() => suppliers.flatMap(s => s.failureTimes), [suppliers]);

  // Assume all suppliers in the plot share the same distribution type as the first one.
  const plotDistributionType = suppliers.length > 0 ? suppliers[0].distribution : 'Weibull';

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
        <TabsList className="grid w-full grid-cols-1 sm:w-auto sm:grid-cols-4">
          <TabsTrigger value="analysis"><LineChartIcon />Análise de Confiabilidade</TabsTrigger>
          <TabsTrigger value="ai_analysis"><Bot />Análise com IA</TabsTrigger>
          <TabsTrigger value="probability_paper"><BrainCircuit />Papéis de Probabilidade</TabsTrigger>
          <TabsTrigger value="monte_carlo"><TestTube />Simulador Monte Carlo</TabsTrigger>
        </TabsList>
        <TabsContent value="analysis" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-full lg:col-span-2">
              <CardHeader>
                <CardTitle>Dados do Equipamento</CardTitle>
                <CardDescription>
                  Gerencie os dados de tempo até a falha para cada equipamento.
                </CardDescription>
              </CardHeader>
              <CardContent className="pl-2 pr-2 sm:pl-6 sm:pr-6">
                <SupplierManager 
                  suppliers={suppliers} 
                  setSuppliers={handleSetSuppliers} 
                  estimationMethod={estimationMethod}
                  setEstimationMethod={setEstimationMethod}
                />
              </CardContent>
            </Card>
            <div className="col-span-full lg:col-span-5 space-y-4">
              <ReliabilityCharts chartData={chartData} suppliers={suppliers} />
               {suppliers.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Gráfico de Probabilidade ({plotDistributionType})</CardTitle>
                      <CardDescription>
                        Análise de aderência dos dados. Quanto mais próximos os pontos da linha de ajuste, melhor a aderência do modelo.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="-mt-4">
                        <ProbabilityPlot suppliers={suppliers} paperType={plotDistributionType} />
                    </CardContent>
                  </Card>
               )}
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
        <TabsContent value="monte_carlo" className="space-y-4">
          <MonteCarloSimulator suppliers={suppliers} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
