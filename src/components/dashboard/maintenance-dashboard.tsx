'use client';

import React from 'react';
import { ArrowDown, ArrowRight, ArrowUp, Cog, DollarSign, Search, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { useI18n } from '@/i18n/i18n-provider';
import type { AssetData } from '@/lib/types';
import { cn } from '@/lib/utils';
import assetData from '@/lib/asset-data.json';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';


const assetsToTsv = (assets: AssetData[]): string => {
  const headers: (keyof AssetData)[] = ['id', 'name', 'criticality', 'lifecycle', 'pdmHealth', 'availability', 'maintenanceCost', 'gbv', 'downtimeLoss', 'failureTimes'];
  const headerRow = headers.join('\t');
  const dataRows = assets.map(asset =>
    headers.map(header => asset[header as keyof AssetData]).join('\t')
  );
  return [headerRow, ...dataRows].join('\n');
};

const tsvToAssets = (tsv: string): AssetData[] => {
  const rows = tsv.trim().split('\n');
  if (rows.length < 2) throw new Error("Dados insuficientes. A primeira linha deve ser o cabeçalho, seguida pelas linhas de dados.");

  const headers = rows.shift()!.trim().split('\t') as (keyof AssetData)[];

  return rows.map((row, rowIndex) => {
    const values = row.split('\t');
    if (values.length !== headers.length) {
      throw new Error(`A linha ${rowIndex + 1} tem um número incorreto de colunas. Esperado: ${headers.length}, Encontrado: ${values.length}.`);
    }
    const asset = {} as AssetData;
    headers.forEach((header, index) => {
      const value = values[index];
      const isNumeric = ['pdmHealth', 'availability', 'maintenanceCost', 'gbv', 'downtimeLoss'].includes(header);

      if (isNumeric) {
        const cleanedValue = value.replace(/[^0-9.,-]+/g, "").replace(',', '.');
        (asset as any)[header] = parseFloat(cleanedValue) || 0;
      } else {
        (asset as any)[header] = value;
      }
    });
    return asset;
  });
};


function AssetEditorDialog({ assets, setAssets, t }: { assets: AssetData[], setAssets: (assets: AssetData[]) => void, t: (key: string, args?: any) => string }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [textData, setTextData] = React.useState('');
  const { toast } = useToast();

  React.useEffect(() => {
    if (isOpen) {
      setTextData(assetsToTsv(assets));
    }
  }, [assets, isOpen]);

  const handleSave = () => {
    try {
      const parsedAssets = tsvToAssets(textData);
      setAssets(parsedAssets);
      toast({
        title: t('toasts.assetUpdateSuccess.title'),
        description: t('toasts.assetUpdateSuccess.description'),
      });
      setIsOpen(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('toasts.tsvError.title'),
        description: t('toasts.tsvError.description', { error: error.message }),
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
            <Cog className="mr-2 h-4 w-4" />
            {t('performance.inventory.manageAssets')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('assetEditor.title')}</DialogTitle>
          <DialogDescription>
            {t('assetEditor.descriptionExcel')}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={textData}
          onChange={(e) => setTextData(e.target.value)}
          rows={20}
          className="font-mono text-xs bg-muted/50"
          placeholder={t('assetEditor.placeholderExcel')}
        />
        <DialogFooter>
          <Button onClick={handleSave}>{t('assetEditor.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


const KpiCard = ({ title, value, subtitle, icon: Icon, trend, trendDirection, trendColor }) => {
    const trendClasses = {
        green: 'bg-green-500/20 text-green-500 hover:bg-green-500/30',
        red: 'bg-red-500/20 text-red-500 hover:bg-red-500/30',
        gray: 'bg-gray-500/20 text-gray-500 hover:bg-gray-500/30'
    };

    const TrendIcon = trendDirection === 'up' ? ArrowUp : trendDirection === 'down' ? ArrowDown : ArrowRight;

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                <p className="text-xs text-muted-foreground">{subtitle}</p>
                {trend && (
                    <div className="mt-2 flex items-center gap-1 text-xs">
                        <Badge variant="outline" className={cn("gap-1 border-0", trendClasses[trendColor])}>
                            <TrendIcon className="h-3 w-3" />
                            {trend}
                        </Badge>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

const CriticalityBadge = ({ criticality }) => {
    const variants = {
        AA: 'bg-red-200/20 text-red-400 border-red-400/30',
        A: 'bg-orange-200/20 text-orange-400 border-orange-400/30',
        B: 'bg-yellow-200/20 text-yellow-400 border-yellow-400/30',
        C: 'bg-green-200/20 text-green-400 border-green-400/30',
    };
    return <Badge variant="outline" className={cn('font-bold w-12 justify-center', variants[criticality])}>{criticality}</Badge>;
};


const HealthIndicator = ({ health }) => {
    let colorClass = 'text-green-400';
    if (health < 50) colorClass = 'text-red-400';
    else if (health < 80) colorClass = 'text-yellow-400';

    return (
        <div className={cn("flex items-center gap-2", colorClass)}>
            <span className={cn("h-2.5 w-2.5 rounded-full", colorClass.replace('text-', 'bg-'))} />
            <span>{health}%</span>
        </div>
    );
};

export default function MaintenanceDashboard({ onAnalyze }: { onAnalyze: (asset: AssetData) => void }) {
    const { t } = useI18n();
    const [assets, setAssets] = React.useState<AssetData[]>(assetData.assets);

    const kpiValues = React.useMemo(() => {
        if (!assets || assets.length === 0) {
            return {
                avgAvailability: 0,
                totalDowntimeLoss: 0,
                totalGbv: 0,
                maintIntensity: 0,
            };
        }

        const totalDowntimeLoss = assets.reduce((sum, asset) => sum + (asset.downtimeLoss || 0), 0);
        const totalGbv = assets.reduce((sum, asset) => sum + (asset.gbv || 0), 0);
        const totalMaintenanceCost = assets.reduce((sum, asset) => sum + (asset.maintenanceCost || 0), 0);
        
        let validAvailabilityAssets = 0;
        const totalAvailability = assets.reduce((sum, asset) => {
          if (asset.availability != null) {
            validAvailabilityAssets++;
            return sum + asset.availability;
          }
          return sum;
        }, 0);
        const avgAvailability = validAvailabilityAssets > 0 ? totalAvailability / validAvailabilityAssets : 0;

        const maintIntensity = totalGbv > 0 ? (totalMaintenanceCost / totalGbv) * 100 : 0;

        return {
            avgAvailability,
            totalDowntimeLoss,
            totalGbv,
            maintIntensity,
        };
    }, [assets]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-2xl font-semibold tracking-tight">{t('performance.title')}</h2>
                <p className="text-sm text-muted-foreground">{t('performance.plant')}</p>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <KpiCard title={t('performance.kpi.availability')} value={`${kpiValues.avgAvailability.toFixed(2)}%`} subtitle={t('performance.kpi.availabilityTarget')} icon={TrendingUp} trend={t('performance.kpi.high')} trendDirection="up" trendColor="green" />
                <KpiCard title={t('performance.kpi.revenueLoss')} value={formatCurrency(kpiValues.totalDowntimeLoss)} subtitle={t('performance.kpi.revenueLossPeriod')} icon={DollarSign} trend={t('performance.kpi.low')} trendDirection="down" trendColor="red" />
                <KpiCard title={t('performance.kpi.intensity')} value={`${kpiValues.maintIntensity.toFixed(2)}%`} subtitle={t('performance.kpi.intensityBenchmark')} icon={TrendingUp} trend={t('performance.kpi.stable')} trendDirection="stable" trendColor="gray" />
                <KpiCard title={t('performance.kpi.totalValue')} value={formatCurrency(kpiValues.totalGbv)} subtitle={t('performance.kpi.totalValueSub')} icon={Cog} />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t('performance.inventory.title')}</CardTitle>
                    <CardDescription>{t('performance.inventory.description')}</CardDescription>
                    <div className="flex items-center justify-between pt-2">
                        <div className="relative w-full max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder={t('performance.inventory.searchPlaceholder')} className="pl-9" />
                        </div>
                        <div className="flex items-center gap-2">
                            <AssetEditorDialog assets={assets} setAssets={setAssets} t={t} />
                            <Button variant="link">{t('performance.inventory.export')}</Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t('performance.table.assetId')}</TableHead>
                                    <TableHead>{t('performance.table.criticality')}</TableHead>
                                    <TableHead>{t('performance.table.lifecycle')}</TableHead>
                                    <TableHead>{t('performance.table.pdmHealth')}</TableHead>
                                    <TableHead>{t('performance.table.availability')}</TableHead>
                                    <TableHead className="text-right">{t('performance.table.maintGbv')}</TableHead>
                                    <TableHead className="text-right">{t('performance.table.downtimeLoss')}</TableHead>
                                    <TableHead className="text-center">{t('performance.table.action')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {assets.map((asset) => (
                                    <TableRow key={asset.id}>
                                        <TableCell>
                                            <div className="font-medium">{asset.name}</div>
                                            <div className="text-xs text-muted-foreground">{asset.id}</div>
                                        </TableCell>
                                        <TableCell><CriticalityBadge criticality={asset.criticality} /></TableCell>
                                        <TableCell>{t(`performance.lifecycle.${asset.lifecycle}`)}</TableCell>
                                        <TableCell><HealthIndicator health={asset.pdmHealth} /></TableCell>
                                        <TableCell><Progress value={asset.availability} className="h-2" /></TableCell>
                                        <TableCell className="text-right">
                                            {asset.gbv > 0 ? ((asset.maintenanceCost / asset.gbv) * 100).toFixed(2) : '0.00'}%
                                        </TableCell>
                                        <TableCell className="text-right font-medium text-red-500">{formatCurrency(asset.downtimeLoss)}</TableCell>
                                        <TableCell className="text-center"><Button variant="outline" size="sm" onClick={() => onAnalyze(asset)}>{t('performance.table.analyze')}</Button></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
