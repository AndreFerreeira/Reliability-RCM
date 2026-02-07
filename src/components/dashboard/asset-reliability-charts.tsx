'use client';

import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { ReliabilityData, Supplier, AssetData, Parameters } from '@/lib/types';
import { useI18n } from '@/i18n/i18n-provider';
import { calculateReliabilityData } from '@/lib/reliability';

interface AssetReliabilityChartsProps {
  asset: AssetData;
}

const CustomTooltip = ({ active, payload, label, t }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <div className="font-bold mb-2 text-foreground">{`${t('charts.time')}: ${Math.round(label)}`}</div>
          <div className="grid gap-1.5">
            {payload.map((entry: any, index: number) => (
               <div key={`item-${index}`} className="flex items-center justify-between gap-4 text-sm">
                 <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-muted-foreground">{`${entry.name}`}</span>
                 </div>
                 <span className="font-mono font-medium text-foreground">{entry.value.toFixed(4)}</span>
               </div>
            ))}
          </div>
      </div>
    );
  }

  return null;
};
  
export default function AssetReliabilityCharts({ asset }: AssetReliabilityChartsProps) {
  const { t } = useI18n();

  const assetAsSupplier = useMemo((): Supplier | null => {
    const failureTimes = asset.failureTimes?.split(',').map(t => parseFloat(t.trim())).filter(t => !isNaN(t) && t > 0) ?? [];
    if (failureTimes.length < 2 || !asset.distribution) return null;

    const params: Parameters = {};
    let isValid = false;

    switch(asset.distribution) {
        case 'Weibull':
            if (asset.beta && asset.eta) {
                params.beta = asset.beta;
                params.eta = asset.eta;
                params.rho = asset.rho;
                isValid = true;
            }
            break;
        case 'Lognormal':
        case 'Normal':
            if (asset.mean && asset.stdDev) {
                params.mean = asset.mean;
                params.stdDev = asset.stdDev;
                params.rho = asset.rho;
                isValid = true;
            }
            break;
        case 'Exponential':
             if (asset.lambda) {
                params.lambda = asset.lambda;
                params.rho = asset.rho;
                isValid = true;
            }
            break;
    }

    if (!isValid) return null;
    
    return {
      id: asset.id,
      name: asset.name,
      failureTimes: failureTimes,
      suspensionTimes: [], // Assuming no suspensions in this context
      color: 'hsl(var(--chart-1))',
      distribution: asset.distribution,
      params: params,
      units: asset.units || 'h',
      dataType: { hasSuspensions: false, hasIntervals: false, isGrouped: false }
    };
  }, [asset]);

  const chartData = useMemo(() => {
    if (!assetAsSupplier) return null;
    return calculateReliabilityData([assetAsSupplier]);
  }, [assetAsSupplier]);

  if (!chartData || !assetAsSupplier) {
     return (
        <Card>
            <CardHeader>
                <CardTitle>{t('assetDetail.reliabilityCurves.title')}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center h-48">
                <p className="text-muted-foreground">{t('weibullAnalysis.noData')}</p>
            </CardContent>
        </Card>
     );
  }

  const renderChart = (titleKey: string, descriptionKey: string, dataKey: keyof ReliabilityData, yDomain: any) => (
    <Card>
      <CardHeader>
        <CardTitle>{t(titleKey)}</CardTitle>
        <CardDescription>{t(descriptionKey)}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData[dataKey]} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="time" 
                type="number" 
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                domain={['dataMin', 'dataMax']} 
                name={t('charts.time')}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                domain={yDomain} 
                tickFormatter={(tick) => {
                    if (tick >= 1000) return `${(tick / 1000).toPrecision(2)}k`;
                    return tick.toPrecision(2);
                }}
              />
              <Tooltip content={<CustomTooltip t={t} />} wrapperClassName="!border-border !bg-background !shadow-lg" />
              <Legend wrapperStyle={{fontSize: "0.8rem"}} iconType="line" />
              <Line
                  key={assetAsSupplier.id}
                  type="monotone"
                  dataKey={assetAsSupplier.name}
                  stroke={assetAsSupplier.color}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
        <CardHeader className="px-0 pt-0">
            <CardTitle>{t('assetDetail.reliabilityCurves.title')}</CardTitle>
            <CardDescription>{t('assetDetail.reliabilityCurves.description', { distribution: assetAsSupplier.distribution })}</CardDescription>
        </CardHeader>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {renderChart('charts.reliability.title', 'charts.reliability.description', 'Rt', [0, 1])}
            {renderChart('charts.failureProb.title', 'charts.failureProb.description', 'Ft', [0, 1])}
            {renderChart('charts.pdf.title', 'charts.pdf.description', 'ft', [0, 'dataMax * 1.2'])}
            {renderChart('charts.failureRate.title', 'charts.failureRate.description', 'lambda_t', [0, 'dataMax * 1.2'])}
        </div>
    </div>
  );
}
