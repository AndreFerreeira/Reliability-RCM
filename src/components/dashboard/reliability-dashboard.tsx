'use client';

import { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { calculateReliabilityData } from '@/lib/reliability';
import type { Supplier, ReliabilityData } from '@/lib/types';
import SupplierManager from './supplier-manager';
import ReliabilityCharts from './reliability-charts';
import AiReportGenerator from './ai-report-generator';
import AiRiskPredictor from './ai-risk-predictor';
import { Logo } from '@/components/icons';

const initialSuppliers: Supplier[] = [
  { id: '1', name: 'Supplier A', failureTimes: [100, 150, 220, 280, 350, 400, 410, 480, 550, 600], color: 'hsl(var(--chart-1))' },
  { id: '2', name: 'Supplier B', failureTimes: [120, 180, 250, 300, 380, 420, 500, 580, 650, 700], color: 'hsl(var(--chart-2))' },
  { id: '3', name: 'Supplier C', failureTimes: [80, 110, 160, 200, 230, 290, 330, 380, 450, 520], color: 'hsl(var(--chart-4))' },
];

export default function ReliabilityDashboard() {
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const chartData = useMemo(() => calculateReliabilityData(suppliers), [suppliers]);

  return (
    <div className="flex-1 space-y-4 p-4 sm:p-6 md:p-8">
      <div className="flex items-center justify-between space-y-2">
        <div className="flex items-center gap-2">
          <Logo className="h-8 w-8" />
          <h1 className="text-3xl font-bold tracking-tight">
            Reliability Analyzer
          </h1>
        </div>
      </div>
      <Tabs defaultValue="analysis" className="space-y-4">
        <TabsList>
          <TabsTrigger value="analysis">Reliability Analysis</TabsTrigger>
          <TabsTrigger value="predictions">AI Predictions</TabsTrigger>
        </TabsList>
        <TabsContent value="analysis" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-full lg:col-span-2">
              <CardHeader>
                <CardTitle>Supplier Data</CardTitle>
                <CardDescription>
                  Manage failure time data for each supplier.
                </CardDescription>
              </CardHeader>
              <CardContent className="pl-2 pr-2 sm:pl-6 sm:pr-6">
                <SupplierManager suppliers={suppliers} setSuppliers={setSuppliers} />
              </CardContent>
            </Card>
            <div className="col-span-full lg:col-span-5 space-y-4">
              <ReliabilityCharts chartData={chartData} suppliers={suppliers} />
              <AiReportGenerator suppliers={suppliers} chartData={chartData} />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="predictions">
          <AiRiskPredictor suppliers={suppliers} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
