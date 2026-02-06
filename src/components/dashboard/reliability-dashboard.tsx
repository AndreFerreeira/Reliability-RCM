'use client';

import { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { calculateReliabilityData, estimateParameters } from '@/lib/reliability';
import type { Supplier, EstimationMethod, AssetData } from '@/lib/types';
import SupplierManager from './supplier-manager';
import ReliabilityCharts from './reliability-charts';
import AiRiskPredictor from './ai-risk-predictor';
import { LineChart as LineChartIcon, TestTube, LayoutDashboard } from '@/components/icons';
import AiComprehensiveAnalysis from './ai-comprehensive-analysis';
import WeibullParameterAnalysis from './weibull-parameter-analysis';
import BathtubCurveAnalysis from './bathtub-curve-analysis';
import ProbabilityPlot from './probability-plot';
import MonteCarloSimulator from './monte-carlo-simulator';
import LanguageSwitcher from './language-switcher';
import { useI18n } from '@/i18n/i18n-provider';
import MaintenanceDashboard from './maintenance-dashboard';
import { useToast } from '@/hooks/use-toast';

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
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState('performance');
  const { toast } = useToast();

  const handleAnalyzeAsset = (asset: AssetData) => {
    const failureTimes = asset.failureTimes?.split(',').map(t => parseFloat(t.trim())).filter(t => !isNaN(t) && t > 0) ?? [];

    if (failureTimes.length < 2) {
        toast({
            variant: "destructive",
            title: t('toasts.insufficientData.title'),
            description: t('toasts.insufficientFailureData.description'),
        });
        return;
    }

    const estimationResult = estimateParameters({
        dist: 'Weibull',
        failureTimes: failureTimes,
        suspensionTimes: [],
        method: 'SRM'
    });
    
    if (!estimationResult.params.beta || !estimationResult.params.eta) {
      toast({
        variant: "destructive",
        title: t('toasts.estimationError.title'),
        description: t('toasts.estimationError.description'),
      });
      return;
    }

    const newSupplier: Supplier = {
        id: asset.id,
        name: asset.name,
        failureTimes: failureTimes,
        suspensionTimes: [],
        color: 'hsl(var(--chart-1))',
        distribution: 'Weibull',
        params: estimationResult.params,
        plotData: estimationResult.plotData,
        units: 'Hora (h)',
        dataType: { hasSuspensions: false, hasIntervals: false, isGrouped: false }
    };
    
    setSuppliers([newSupplier]);
    setActiveTab('analysis');
  };

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
            {t('dashboard.title')}
          </h1>
        </div>
        <div className="flex items-center space-x-2">
          <LanguageSwitcher />
        </div>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="performance" className="space-y-4">
        <TabsList className="grid w-full grid-cols-1 sm:w-auto sm:grid-cols-3">
          <TabsTrigger value="performance"><LayoutDashboard />{t('tabs.performanceDashboard')}</TabsTrigger>
          <TabsTrigger value="analysis"><LineChartIcon />{t('tabs.reliabilityAnalysis')}</TabsTrigger>
          <TabsTrigger value="monte_carlo"><TestTube />{t('tabs.monteCarlo')}</TabsTrigger>
        </TabsList>
        <TabsContent value="performance" className="space-y-4">
            <MaintenanceDashboard onAnalyze={handleAnalyzeAsset} />
        </TabsContent>
        <TabsContent value="analysis" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-full lg:col-span-2">
              <CardHeader>
                <CardTitle>{t('supplierManager.cardTitle')}</CardTitle>
                <CardDescription>
                  {t('supplierManager.cardDescription')}
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
                      <CardTitle>{t('probabilityPlot.cardTitle', { distribution: plotDistributionType })}</CardTitle>
                      <CardDescription>
                        {t('probabilityPlot.cardDescription')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="-mt-4">
                        <ProbabilityPlot suppliers={suppliers} paperType={plotDistributionType} />
                    </CardContent>
                  </Card>
               )}
              <WeibullParameterAnalysis suppliers={weibullSuppliers} />
              <BathtubCurveAnalysis failureTimes={allFailureTimes} />
              <AiRiskPredictor suppliers={suppliers} />
              <AiComprehensiveAnalysis suppliers={suppliers} chartData={chartData} />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="monte_carlo" className="space-y-4">
          <MonteCarloSimulator suppliers={suppliers} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
