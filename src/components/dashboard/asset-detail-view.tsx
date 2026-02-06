'use client';

import React from 'react';
import type { AssetData } from '@/lib/types';
import { useI18n } from '@/i18n/i18n-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Clock, AlertTriangle, DollarSign, BrainCircuit, TrendingUp, ShieldCheck, Loader2 } from 'lucide-react';
import BathtubCurveAnalysis from './bathtub-curve-analysis';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { generateRcaReport } from '@/actions/reliability';
import { useToast } from '@/hooks/use-toast';
import { marked } from 'marked';


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

export function AssetDetailView({ asset, onBack }: AssetDetailViewProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [isReportOpen, setIsReportOpen] = React.useState(false);
  const [reportContent, setReportContent] = React.useState('');
  const [isGenerating, setIsGenerating] = React.useState(false);

  const failureTimes = asset.failureTimes?.split(',').map(t => parseFloat(t.trim())).filter(t => !isNaN(t) && t > 0).sort((a,b) => a - b) ?? [];

  const calculatedMtbf = React.useMemo(() => {
    if (failureTimes.length < 2) {
      return 0; // Not enough data to calculate intervals
    }
    const firstFailure = failureTimes[0];
    const lastFailure = failureTimes[failureTimes.length - 1];
    const numberOfIntervals = failureTimes.length - 1;
    
    return (lastFailure - firstFailure) / numberOfIntervals;
  }, [failureTimes]);

  const totalDowntimeHours = asset.mttr * failureTimes.length;
  const downtimeCostPerHour = totalDowntimeHours > 0 ? asset.downtimeLoss / totalDowntimeHours : 0;

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
            {t('assetDetail.backToFleet')}
          </Button>
          <h2 className="text-3xl font-bold tracking-tight">{asset.name}</h2>
          <p className="text-muted-foreground">{asset.location}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">{t('assetDetail.scheduleMaintenance')}</Button>
          <Button>{t('assetDetail.generateWorkOrder')}</Button>
          <Button variant="destructive" onClick={handleGenerateReport} disabled={isGenerating}>
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
            {t('assetDetail.decisionEngine.button')}
          </Button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column */}
        <div className="lg:col-span-3 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <InfoCard title="MTBF" value={calculatedMtbf > 0 ? calculatedMtbf.toFixed(0) : '--'} unit="h" icon={Clock} />
                <InfoCard title="MTTR" value={asset.mttr} unit="h" icon={AlertTriangle} />
                <InfoCard title="Custo / Hora de Downtime" value={`$${downtimeCostPerHour.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}`} icon={DollarSign} />
            </div>

            {/* Predictive Maintenance Score */}
            <Card className="bg-card shadow-lg">
                <CardHeader>
                    <CardTitle>{t('assetDetail.pdmScore.title')}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="text-center">
                        <div className={cn("text-7xl font-bold", asset.pdmHealth < 50 ? 'text-red-400' : 'text-green-400')}>{asset.pdmHealth}%</div>
                        <div className="text-sm text-muted-foreground">{t('assetDetail.pdmScore.healthIndex')}</div>
                    </div>
                    <div className="h-24 border-r border-dashed border-border hidden md:block" />
                    <div className="flex flex-1 justify-around gap-4 text-center">
                        <div>
                            <div className="text-xs text-muted-foreground">{t('assetDetail.pdmScore.mttrTrend')}</div>
                            <div className="flex items-center justify-center gap-1 text-2xl font-semibold text-red-400">
                                <TrendingUp className="h-5 w-5" /> 33%
                            </div>
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground">{t('assetDetail.pdmScore.rpn')}</div>
                            <div className="text-2xl font-semibold">{asset.rpn}</div>
                        </div>
                         <div>
                            <div className="text-xs text-muted-foreground">{t('assetDetail.pdmScore.severity')}</div>
                            <div className="text-2xl font-semibold">{asset.severity}/10</div>
                        </div>
                    </div>
                     <div className="w-48 hidden lg:block">
                        <BrainCircuit className="h-full w-full text-primary/10" />
                     </div>
                </CardContent>
                <div className="border-t border-border/50 bg-muted/30 px-6 py-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-green-500" />
                        <span>{t('assetDetail.pdmScore.footer')}</span>
                    </div>
                </div>
            </Card>

            {/* Reliability & Cost Dynamics */}
             <BathtubCurveAnalysis failureTimes={failureTimes} />
        </div>

      </div>

      <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
        <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('assetDetail.rcaReport.title', { assetName: asset.name })}</DialogTitle>
            <DialogDescription>{t('assetDetail.rcaReport.description')}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-grow pr-6 -mr-2">
            <div 
              className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-headings:text-foreground prose-strong:text-foreground prose-ul:pl-4" 
              dangerouslySetInnerHTML={{ __html: marked.parse(reportContent) as string }} 
            />
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
