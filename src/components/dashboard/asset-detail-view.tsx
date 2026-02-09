'use client';

import React from 'react';
import type { AssetData } from '@/lib/types';
import { useI18n } from '@/i18n/i18n-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Clock, AlertTriangle, DollarSign, BrainCircuit, Lightbulb, Loader2, CalendarClock } from 'lucide-react';
import BathtubCurveAnalysis from './bathtub-curve-analysis';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { generateRcaReport } from '@/actions/reliability';
import { useToast } from '@/hooks/use-toast';
import { marked } from 'marked';
import EventLogTable from './event-log-table';
import AssetReliabilityCharts from './asset-reliability-charts';
import PreventiveMaintenanceOptimizer from './preventive-maintenance-optimizer';
import AssetProbabilityPlot from './asset-probability-plot';
import { getReliability, getMedianLife } from '@/lib/reliability';
import { Badge } from '@/components/ui/badge';
import PFCurveChart from './pf-curve-chart';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';


interface AssetDetailViewProps {
  asset: AssetData;
  onBack: () => void;
}

const InfoCard = ({ title, value, icon: Icon, unit }: { title: string, value: string | number, icon: React.ElementType, unit?: string }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value} <span className="text-xs text-muted-foreground">{unit}</span></div>
        </CardContent>
    </Card>
);

function parseDate(dateStr: string): Date | null {
    if (!dateStr || typeof dateStr !== 'string') return null;
    let parts = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2}):(\d{2}):?(\d{2})?/);
    if (parts) {
        const [, day, month, year, hour, minute, second] = parts;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), second ? parseInt(second) : 0);
    }
    parts = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (parts) {
        const [, day, month, year] = parts;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    return null;
}

export function AssetDetailView({ asset, onBack }: AssetDetailViewProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [isReportOpen, setIsReportOpen] = React.useState(false);
  const [reportContent, setReportContent] = React.useState('');
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [dynamicHealth, setDynamicHealth] = React.useState<{ score: number, daysSinceFailure: number, daysRemaining: number, referenceInterval: number } | null>(null);

  const failureTimes = React.useMemo(() => (
    asset.failureTimes?.split(',').map(t => parseFloat(t.trim())).filter(t => !isNaN(t) && t > 0).sort((a,b) => a - b) ?? []
  ), [asset.failureTimes]);

  React.useEffect(() => {
    if (!asset.distribution || !asset.events || asset.events.length === 0) {
      setDynamicHealth(null);
      return;
    }

    const failureEvents = asset.events
      .map(e => ({ ...e, date: parseDate(e.endDate || e.startDate) }))
      .filter((e): e is typeof e & { date: Date } => !!e.date && (e.status === 'FALHA' || e.status === 'CORRETIVA'))
      .sort((a, b) => b.date.getTime() - a.date.getTime());
    
    if (failureEvents.length === 0) {
        setDynamicHealth(null);
        return;
    }

    const lastFailureDate = failureEvents[0].date;
    const now = new Date();
    const hoursSinceLastFailure = (now.getTime() - lastFailureDate.getTime()) / (1000 * 60 * 60);
    
    const reliability = getReliability(asset.distribution, asset, hoursSinceLastFailure);
    const score = isNaN(reliability) ? 0 : Math.round(reliability * 100);

    let referenceInterval = getMedianLife(asset.distribution, asset);
    if (isNaN(referenceInterval)) {
        if (failureTimes.length > 0) {
          const sumOfFailureTimes = failureTimes.reduce((sum, time) => sum + time, 0);
          referenceInterval = sumOfFailureTimes / failureTimes.length;
        } else {
          referenceInterval = 0;
        }
    }
    
    const daysSince = hoursSinceLastFailure / 24;
    const daysRemaining = (referenceInterval - hoursSinceLastFailure) / 24;

    setDynamicHealth({
      score: score,
      daysSinceFailure: Math.round(daysSince),
      daysRemaining: Math.round(daysRemaining),
      referenceInterval,
    });

  }, [asset, failureTimes]);

  const calculatedMtbf = React.useMemo(() => {
    if (failureTimes.length === 0) {
      return 0;
    }
    const sumOfFailureTimes = failureTimes.reduce((sum, time) => sum + time, 0);
    return sumOfFailureTimes / failureTimes.length;
  }, [failureTimes]);

  const downtimeCostPerHour = asset.downtimeCostPerHour ?? 0;

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    setReportContent('');
    
    const result = await generateRcaReport(asset, calculatedMtbf);

    setIsGenerating(false);

    if (result && 'report' in result) {
      setReportContent(result.report);
      setIsReportOpen(true);
    } else {
      toast({
        variant: 'destructive',
        title: t('toasts.simulationError.title'),
        description: (result as { error: string }).error || t('toasts.simulationError.description'),
      });
    }
  };


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Button variant="outline" onClick={onBack} className="mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('assetDetail.back')}
          </Button>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-3xl font-bold tracking-tight">{asset.name}</h2>
            {asset.distribution && <Badge variant="outline" className="text-base shrink-0">{asset.distribution}</Badge>}
          </div>
          <p className="text-muted-foreground">{asset.location}</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button variant="destructive" onClick={handleGenerateReport} disabled={isGenerating}>
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
            {t('assetDetail.decisionEngine.button')}
          </Button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column for KPIs */}
        <div className="lg:col-span-1 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-1 gap-6">
                <InfoCard title="MTBF" value={calculatedMtbf > 0 ? calculatedMtbf.toFixed(0) : '--'} unit="h" icon={Clock} />
                <InfoCard title="MTTR" value={asset.mttr} unit="h" icon={AlertTriangle} />
                <InfoCard title={t('assetEditor.downtimeCostPerHour')} value={`$${downtimeCostPerHour.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}`} icon={DollarSign} />
            </div>

            <Card className="bg-card shadow-lg sticky top-6">
                <CardHeader>
                    <CardTitle>{t('assetDetail.dynamicHealth.title')}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col md:flex-row items-center justify-between gap-6 p-6">
                    <div className="text-center md:w-1/4">
                        {dynamicHealth !== null ? (
                            <>
                                <div className={cn("text-7xl font-bold", dynamicHealth.score < 50 ? 'text-red-400' : dynamicHealth.score < 75 ? 'text-yellow-400' : 'text-green-400')}>
                                    {dynamicHealth.score}%
                                </div>
                                <div className="text-sm text-muted-foreground">{t('assetDetail.dynamicHealth.healthIndex')}</div>
                            </>
                        ) : (
                            <>
                                <div className="text-7xl font-bold text-muted-foreground">--%</div>
                                <div className="text-sm text-muted-foreground">{t('assetDetail.dynamicHealth.noData')}</div>
                            </>
                        )}
                    </div>
                    
                    <div className="h-24 border-r border-dashed border-border hidden md:block" />

                    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
                        <div className="flex items-center gap-2 text-primary">
                            <CalendarClock className="h-5 w-5" />
                            <span className="text-sm font-semibold uppercase tracking-wider">{t('assetDetail.dynamicHealth.countdown')}</span>
                        </div>
                        <div className="text-5xl font-bold text-primary">
                            {dynamicHealth !== null ? Math.max(0, dynamicHealth.daysRemaining) : '--'}
                            <span className="ml-2 text-2xl font-medium text-muted-foreground">dias</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                            {dynamicHealth ? `${t('assetDetail.dynamicHealth.timeSinceFailure')}: ${dynamicHealth.daysSinceFailure} / ${Math.round(dynamicHealth.referenceInterval / 24)} dias` : ''}
                        </div>
                    </div>
                </CardContent>
                <div className="border-t border-border/50 bg-muted/30 px-6 py-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-yellow-500" />
                        <span>{t('assetDetail.dynamicHealth.footer')}</span>
                    </div>
                </div>
            </Card>
        </div>

        {/* Right Column for Analyses */}
        <div className="lg:col-span-2 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Análises de Confiabilidade</CardTitle>
                    <CardDescription>Explore as diferentes facetas do comportamento de falha deste ativo.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
                        <AccordionItem value="item-1">
                            <AccordionTrigger className="text-base font-semibold">1. Análise Preditiva (Curva P-F)</AccordionTrigger>
                            <AccordionContent className="pt-4">
                                <PFCurveChart
                                    pdmHealth={dynamicHealth?.score}
                                    distribution={asset.distribution}
                                    beta={asset.beta}
                                    rho={asset.rho}
                                    failureTimesCount={failureTimes.length}
                                />
                            </AccordionContent>
                        </AccordionItem>
                         <AccordionItem value="item-2">
                            <AccordionTrigger className="text-base font-semibold">2. Análise do Ciclo de Vida (Curva da Banheira)</AccordionTrigger>
                            <AccordionContent className="pt-4">
                               <BathtubCurveAnalysis failureTimes={failureTimes} />
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-3">
                            <AccordionTrigger className="text-base font-semibold">3. Otimização de Manutenção Preventiva</AccordionTrigger>
                            <AccordionContent className="pt-4">
                                <PreventiveMaintenanceOptimizer asset={asset} />
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-4">
                            <AccordionTrigger className="text-base font-semibold">4. Diagnóstico do Modelo (Gráfico de Probabilidade)</AccordionTrigger>
                            <AccordionContent className="pt-4">
                               <AssetProbabilityPlot asset={asset} />
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-5">
                            <AccordionTrigger className="text-base font-semibold">5. Curvas Fundamentais de Confiabilidade</AccordionTrigger>
                            <AccordionContent className="pt-4">
                               <AssetReliabilityCharts asset={asset} />
                            </AccordionContent>
                        </AccordionItem>
                        {asset.events && asset.events.length > 0 && (
                             <AccordionItem value="item-6">
                                <AccordionTrigger className="text-base font-semibold">6. Histórico de Eventos</AccordionTrigger>
                                <AccordionContent className="pt-4">
                                    <EventLogTable events={asset.events} />
                                </AccordionContent>
                            </AccordionItem>
                        )}
                    </Accordion>
                </CardContent>
            </Card>
        </div>
      </div>

      <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('assetDetail.rcaReport.title', { assetName: asset.name })}</DialogTitle>
            <DialogDescription>{t('assetDetail.rcaReport.description')}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-grow pr-6 -mr-2">
            <div 
              className="prose prose-base dark:prose-invert max-w-none prose-headings:text-foreground prose-strong:text-foreground prose-p:text-foreground/90 prose-li:text-foreground/90 prose-ul:list-disc prose-ul:pl-6"
              dangerouslySetInnerHTML={{ __html: marked.parse(reportContent) as string }} 
            />
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
