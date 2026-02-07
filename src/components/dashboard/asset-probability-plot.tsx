'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import ReactECharts from 'echarts-for-react';
import { useI18n } from '@/i18n/i18n-provider';
import type { AssetData, LRBoundsResult } from '@/lib/types';
import { calculateLikelihoodRatioBounds } from '@/lib/reliability';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lightbulb } from 'lucide-react';

interface AssetProbabilityPlotProps {
  asset: AssetData;
}

const Plot = ({ data }: { data?: LRBoundsResult }) => {
    const { t } = useI18n();
    if (!data || !data.medianLine) return null;

    const {
        medianLine,
        lowerLine,
        upperLine,
        points,
        beta,
        eta,
        confidenceLevel,
    } = data;

    const sortFn = (a: { x: number }, b: { x: number }) => a.x - b.x;

    const medianData = medianLine.map(p => [p.x, p.y]).sort(sortFn);
    const lowerData = lowerLine.map(p => [p.x, p.y]).sort(sortFn);
    const upperData = upperLine.map(p => [p.x, p.y]).sort(sortFn);

    const scatterData = points.median.map(p => [p.x, p.y]);
    
    const option = {
        backgroundColor: "transparent",
        grid: { left: 65, right: 40, top: 70, bottom: 60 },
        title: {
            text: t('monteCarlo.confidence.chartTitle'),
            subtext: `β: ${beta.toFixed(2)} | η: ${eta.toFixed(0)} | N: ${points.median.length}`,
            left: 'center',
            textStyle: { color: 'hsl(var(--foreground))', fontSize: 16 },
            subtextStyle: { color: 'hsl(var(--muted-foreground))', fontSize: 12 },
        },
        tooltip: {
            trigger: 'axis',
            formatter: (params: any[]) => {
              if (!params || params.length === 0) return '';
              const logTime = params[0].axisValue;
              const time = Math.exp(logTime);
              let tooltip = `<strong>${t('charts.time')}:</strong> ${time.toLocaleString()}<br/>`;
              params.forEach(p => {
                  if (p.seriesName && !p.seriesName.includes('Base') && !p.seriesName.includes('Faixa') && !p.seriesName.includes(t('monteCarlo.confidence.data'))) {
                      const loglogY = p.value[1];
                      if(typeof loglogY === 'number') {
                         const prob = (1 - Math.exp(-Math.exp(loglogY))) * 100;
                         tooltip += `<span style="color:${p.color};">●</span> ${p.seriesName}: ${prob.toFixed(2)}%<br/>`;
                      }
                  }
              });
              return tooltip;
            }
        },
        legend: {
            data: [
                t('monteCarlo.confidence.lowerBound', { level: confidenceLevel }),
                t('monteCarlo.confidence.upperBound', { level: confidenceLevel }),
                t('monteCarlo.confidence.medianFit'),
                t('monteCarlo.confidence.medianRank')
            ],
            bottom: 0,
            textStyle: { color: 'hsl(var(--muted-foreground))', fontSize: 13 },
            itemGap: 20,
            inactiveColor: "#555"
        },
        xAxis: {
            type: 'value',
            name: 'ln(Tempo)',
            nameLocation: 'middle',
            nameGap: 30,
            axisLabel: { color: "#aaa" },
            splitLine: { show: true, lineStyle: { type: 'dashed', color: "rgba(255,255,255,0.05)", opacity: 0.5 } },
        },
        yAxis: {
            type: 'value',
            name: 'ln(ln(1/(1-F(t))))',
            nameLocation: 'middle',
            nameGap: 50,
            axisLabel: {
                formatter: (value: number) => {
                    const prob = (1 - Math.exp(-Math.exp(value))) * 100;
                    if (prob < 1) return prob.toFixed(2);
                    if (prob > 99) return prob.toFixed(2);
                    return Math.round(prob);
                },
                color: "#aaa",
            },
            splitLine: { show: false },
        },
        series: [
            {
                name: t('monteCarlo.confidence.upperBound', { level: confidenceLevel }),
                type: 'line',
                data: upperData,
                showSymbol: false,
                smooth: true,
                lineStyle: { width: 2, color: 'hsl(var(--destructive))' },
                z: 9,
            },
            {
                name: t('monteCarlo.confidence.lowerBound', { level: confidenceLevel }),
                type: 'line',
                data: lowerData,
                showSymbol: false,
                smooth: true,
                lineStyle: { width: 2, color: 'hsl(var(--destructive))' },
                z: 9,
            },
            {
                name: t('monteCarlo.confidence.medianFit'),
                type: 'line',
                data: medianData,
                showSymbol: false,
                smooth: true,
                lineStyle: { width: 3, color: 'hsl(var(--primary))' },
                z: 10,
            },
            {
                name: t('monteCarlo.confidence.medianRank'),
                type: 'scatter',
                data: scatterData,
                symbolSize: 8,
                itemStyle: { color: 'black', borderWidth: 2, borderColor: 'hsl(var(--primary))' }
            }
        ]
    };

    return <ReactECharts option={option} style={{ height: '450px', width: '100%' }} notMerge={true} />;
};

export default function AssetProbabilityPlot({ asset }: AssetProbabilityPlotProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [confidenceLevel, setConfidenceLevel] = useState(90);
  const [boundsData, setBoundsData] = useState<LRBoundsResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const failureTimes = useMemo(() => {
    return asset.failureTimes?.split(/[,; ]+/).map(t => parseFloat(t.trim())).filter(t => !isNaN(t) && t > 0) ?? [];
  }, [asset.failureTimes]);

  useEffect(() => {
    if (asset.distribution !== 'Weibull' || failureTimes.length < 2) {
      setBoundsData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      try {
        const result = calculateLikelihoodRatioBounds({
          times: failureTimes,
          confidenceLevel: confidenceLevel,
          tValue: null
        });

        if (!result || result.error) {
          throw new Error(result?.error || t('monteCarlo.errors.confidence'));
        }
        setBoundsData(result);
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: t('toasts.simulationError.title'),
          description: error.message,
        });
        setBoundsData(null);
      } finally {
        setIsLoading(false);
      }
    }, 50);
  }, [failureTimes, confidenceLevel, t, toast, asset.distribution]);

  if (asset.distribution !== 'Weibull' || failureTimes.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('assetDetail.confidencePlot.title')}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48">
          <p className="text-muted-foreground">{asset.distribution !== 'Weibull' ? 'Análise disponível apenas para distribuição Weibull.' : t('toasts.insufficientFailureData.description')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('assetDetail.confidencePlot.title')}</CardTitle>
          <CardDescription>{t('assetDetail.confidencePlot.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="confidence-slider" className="text-sm font-medium">{t('monteCarlo.confidence.levelLabel')}</label>
            <div className="flex items-center gap-4">
              <Slider
                id="confidence-slider"
                value={[confidenceLevel]}
                onValueChange={(value) => setConfidenceLevel(value[0])}
                max={99.9}
                min={80}
                step={0.1}
                className="flex-1"
              />
              <span className="text-sm font-medium text-muted-foreground w-16 text-center">
                {confidenceLevel.toFixed(1)}%
              </span>
            </div>
          </div>
          
          {isLoading && (
              <div className="flex justify-center items-center h-[450px]">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
          )}

          {!isLoading && boundsData && (
              <Plot data={boundsData} />
          )}
        </CardContent>
      </Card>

      {!isLoading && boundsData && (
        <Card>
            <CardHeader className="flex flex-row items-center gap-3">
                <Lightbulb className="h-6 w-6 text-yellow-500" />
                <CardTitle>{t('assetDetail.confidencePlot.interpretationTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-4">
                <p>{t('assetDetail.confidencePlot.interpretation1')}</p>
                <ul className="list-disc pl-5 space-y-2">
                    <li><strong>{t('assetDetail.confidencePlot.interpretation2_1')}:</strong> {t('assetDetail.confidencePlot.interpretation2_2')}</li>
                    <li><strong>{t('assetDetail.confidencePlot.interpretation3_1')}:</strong> {t('assetDetail.confidencePlot.interpretation3_2')}</li>
                    <li><strong>{t('assetDetail.confidencePlot.interpretation4_1')}:</strong> {t('assetDetail.confidencePlot.interpretation4_2')}</li>
                </ul>
                <p>{t('assetDetail.confidencePlot.interpretation5')}</p>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
