'use client';

import React from 'react';
import { ArrowDown, ArrowRight, ArrowUp, Cog, DollarSign, Search, Trash2, TrendingUp, Upload } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { AssetDetailView } from './asset-detail-view';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '../ui/textarea';
import { estimateParameters } from '@/lib/reliability';

const headerMapping: Record<string, string> = {
    // Portuguese
    'id do equipamento': 'id',
    'id': 'id',
    'tag': 'id',
    'descrição': 'name',
    'nome': 'name',
    'localização': 'location',
    'criticidade': 'criticality',
    'ciclo de vida': 'lifecycle',
    'saúde pdm': 'pdmHealth',
    'saude pdm': 'pdmHealth',
    'pdm health': 'pdmHealth',
    'disponibilidade': 'availability',
    'custo de manutenção': 'maintenanceCost',
    'custo r&m': 'maintenanceCost',
    'gbv': 'gbv',
    'perda por downtime': 'downtimeLoss',
    'perdas por parada': 'downtimeLoss',
    'rpn': 'rpn',
    'severidade': 'severity',
    
    // Calculation fields
    'data de inicio': 'startDate',
    'data de início': 'startDate',
    'data de término': 'endDate',
    'data de termino': 'endDate',
    'tempos de falha': 'failureTimes',
    'mttr': 'mttr',

    // English
    'asset id': 'id',
    'description': 'name',
    'name': 'name',
    'location': 'location',
    'criticality': 'criticality',
    'lifecycle': 'lifecycle',
    'pdm health': 'pdmHealth',
    'availability': 'availability',
    'maintenance cost': 'maintenanceCost',
    'r&m cost': 'maintenanceCost',
    'downtime loss': 'downtimeLoss',
    'failure times': 'failureTimes',
    'rpn': 'rpn',
    'severity': 'severity',
    'start date': 'startDate',
    'end date': 'endDate',
};

const requiredFields: (keyof AssetData)[] = [
    'id', 'name', 'criticality', 'pdmHealth', 'availability', 
    'maintenanceCost', 'gbv', 'downtimeLoss', 'failureTimes', 'rpn', 'severity', 'mttr'
];

function parseDate(dateStr: string): Date | null {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const parts = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})/);
    if (!parts) return null;
    const [, day, month, year, hour, minute] = parts;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
}


function AssetDataMassEditor({ onSave, t }: { onSave: (assets: AssetData[]) => void, t: (key: string, args?: any) => string }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [textData, setTextData] = React.useState('');
  const { toast } = useToast();
  
  const handleImport = () => {
    try {
        const lines = textData.trim().split('\n');
        if (lines.length < 2) {
            throw new Error(t('tsvError.structure'));
        }

        const headerLine = lines.shift()!.toLowerCase().split('\t').map(h => h.trim());
        const hasEventLogHeaders = headerLine.includes('data de inicio') && (headerLine.includes('data de término') || headerLine.includes('data de termino'));

        let newAssets: AssetData[];

        if (hasEventLogHeaders) {
            const headerMap: Record<string, number> = {};
            headerLine.forEach((h, i) => { 
                const mappedKey = headerMapping[h];
                if(mappedKey) headerMap[mappedKey] = i;
            });

            if (headerMap['id'] === undefined) throw new Error("A coluna 'TAG' ou 'ID' é obrigatória para agrupar eventos.");
            
            const allRows = lines.map(line => line.split('\t'));

            const groupedByTag: Record<string, string[][]> = {};
            for (const row of allRows) {
                const tag = row[headerMap['id']];
                if (tag) {
                    if (!groupedByTag[tag]) groupedByTag[tag] = [];
                    groupedByTag[tag].push(row);
                }
            }
            
            newAssets = Object.values(groupedByTag).map((rows) => {
                const firstRow = rows[0];
                const tag = firstRow[headerMap['id']];

                const events = rows.map(row => {
                    const startDate = parseDate(row[headerMap['startDate']]);
                    const endDate = parseDate(row[headerMap['endDate']]);
                    if (!startDate || !endDate) return null;
                    return { startDate, endDate };
                }).filter((e): e is { startDate: Date; endDate: Date } => e !== null)
                  .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

                const failureTimes: number[] = [];
                const repairTimes: number[] = [];

                for (let i = 0; i < events.length; i++) {
                    const repairTimeHours = (events[i].endDate.getTime() - events[i].startDate.getTime()) / (1000 * 60 * 60);
                    if (repairTimeHours >= 0) repairTimes.push(repairTimeHours);

                    if (i > 0) {
                        const timeBetweenFailuresHours = (events[i].startDate.getTime() - events[i-1].endDate.getTime()) / (1000 * 60 * 60);
                        if (timeBetweenFailuresHours > 0) failureTimes.push(timeBetweenFailuresHours);
                    }
                }
                
                const asset: Partial<AssetData> = { id: tag, name: tag };

                 // Sum up costs and losses from all events for the asset
                asset.maintenanceCost = 0;
                asset.downtimeLoss = 0;
                rows.forEach(row => {
                    if(headerMap['maintenanceCost'] !== undefined) {
                        asset.maintenanceCost! += parseFloat(row[headerMap['maintenanceCost']].replace(/\./g, '').replace(',', '.')) || 0;
                    }
                     if(headerMap['downtimeLoss'] !== undefined) {
                        asset.downtimeLoss! += parseFloat(row[headerMap['downtimeLoss']].replace(/\./g, '').replace(',', '.')) || 0;
                    }
                });

                // Get static data from the first row
                Object.keys(headerMap).forEach(key => {
                    const index = headerMap[key];
                    const value = firstRow[index]?.trim();
                    if(value === undefined) return;

                    const staticFields: (keyof AssetData)[] = ['name', 'location', 'criticality', 'pdmHealth', 'availability', 'gbv', 'rpn', 'severity'];
                    if(staticFields.includes(key as any)){
                        const mappedKey = key as keyof AssetData;
                        const numericFields: (keyof AssetData)[] = ['pdmHealth', 'availability', 'gbv', 'rpn', 'severity'];
                        if (numericFields.includes(mappedKey)) {
                           (asset[mappedKey] as any) = parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
                        } else if (mappedKey === 'criticality') {
                            asset.criticality = (value.toUpperCase() as any) || 'C';
                        } else {
                           (asset[mappedKey] as any) = value;
                        }
                    }
                });

                asset.failureTimes = failureTimes.join(', ');
                asset.mttr = repairTimes.length > 0 ? repairTimes.reduce((a, b) => a + b, 0) / repairTimes.length : 0;
                if (!asset.name) asset.name = tag;

                const ftArray = asset.failureTimes.split(/[,; ]+/).map(t => parseFloat(t.trim())).filter(t => !isNaN(t) && t > 0);
                 if (ftArray.length >= 3) {
                    const { params } = estimateParameters({ dist: 'Weibull', failureTimes: ftArray, method: 'MLE' });
                    if (params.beta) {
                        if (params.beta < 0.95) asset.lifecycle = 'infant';
                        else if (params.beta > 1.05) asset.lifecycle = 'wearOut';
                        else asset.lifecycle = 'stable';
                    } else asset.lifecycle = 'stable';
                } else asset.lifecycle = 'stable';

                return asset as AssetData;
            });
        } else {
             const columnIndexMap: Partial<Record<keyof AssetData, number>> = {};
            
            headerLine.forEach((header, index) => {
                const mappedKey = headerMapping[header];
                if (mappedKey && requiredFields.includes(mappedKey as any)) {
                    columnIndexMap[mappedKey as keyof AssetData] = index;
                }
            });
            
            const missingHeaders = requiredFields.filter(field => columnIndexMap[field] === undefined && !hasEventLogHeaders);
            if (missingHeaders.length > 0) {
                throw new Error(t('tsvError.missingHeaders', { headers: missingHeaders.join(', ') }));
            }
            
            newAssets = lines.map((line, lineIndex) => {
                const values = line.split('\t');
                const asset: Partial<AssetData> = {};

                for (const key of Object.keys(columnIndexMap) as (keyof AssetData)[]) {
                    const index = columnIndexMap[key];
                    if (index !== undefined && index < values.length) {
                         const value = values[index].trim();
                         const numericFields: (keyof AssetData)[] = ['pdmHealth', 'availability', 'maintenanceCost', 'gbv', 'downtimeLoss', 'rpn', 'severity', 'mttr'];
                        
                        if (numericFields.includes(key)) {
                            (asset[key] as any) = parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
                        } else if (key === 'criticality') {
                            const crit = value.toUpperCase() as AssetData['criticality'];
                            asset.criticality = ['AA', 'A', 'B', 'C'].includes(crit) ? crit : 'C';
                        } else {
                            (asset[key] as any) = value;
                        }
                    }
                }
                
                if (!asset.id) asset.id = `ASSET-${Date.now()}-${lineIndex}`;
                if (!asset.name) asset.name = `Asset ${lineIndex + 1}`;

                const failureTimesArray = (asset.failureTimes || '').split(/[,; ]+/).map(t => parseFloat(t.trim())).filter(t => !isNaN(t) && t > 0);
                if (failureTimesArray.length >= 3) {
                    const { params } = estimateParameters({ dist: 'Weibull', failureTimes: failureTimesArray, method: 'MLE' });
                    if (params.beta) {
                        if (params.beta < 0.95) asset.lifecycle = 'infant';
                        else if (params.beta > 1.05) asset.lifecycle = 'wearOut';
                        else asset.lifecycle = 'stable';
                    } else asset.lifecycle = 'stable';
                } else asset.lifecycle = 'stable';

                return asset as AssetData;
            });
        }

        onSave(newAssets);
        toast({
            title: t('toasts.assetUpdateSuccess.title'),
            description: t('toasts.assetUpdateSuccess.description'),
        });
        setIsOpen(false);
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: t('toasts.tsvError.title'),
            description: error.message,
        });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            {t('performance.inventory.importData')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('assetEditor.titleBulk')}</DialogTitle>
          <DialogDescription>{t('assetEditor.descriptionBulk')}</DialogDescription>
        </DialogHeader>
        <div className="text-sm text-muted-foreground p-4 border rounded-md space-y-2">
            <p><strong>{t('assetEditor.instructions.title')}</strong></p>
            <ol className="list-decimal list-inside space-y-1">
                <li>{t('assetEditor.instructions.step1')}</li>
                <li>{t('assetEditor.instructions.step2')}</li>
                 <li>{t('assetEditor.instructions.step3')}</li>
            </ol>
            <p><strong>{t('assetEditor.instructions.requiredHeaders')}:</strong> <code className="text-xs">tag, data de inicio, data de término, custo de manutenção, gbv...</code></p>
        </div>
        <ScrollArea className="flex-grow pr-6 -mr-6">
           <Textarea
              placeholder={t('assetEditor.pastePlaceholder')}
              className="h-full min-h-[40vh] font-mono text-xs"
              value={textData}
              onChange={(e) => setTextData(e.target.value)}
            />
        </ScrollArea>
        <DialogFooter>
          <Button onClick={handleImport}>{t('assetEditor.importButton')}</Button>
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

export default function MaintenanceDashboard() {
    const { t } = useI18n();
    const [assets, setAssets] = React.useState<AssetData[]>(assetData.assets);
    const [selectedAsset, setSelectedAsset] = React.useState<AssetData | null>(null);

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
    
    if (selectedAsset) {
        return <AssetDetailView asset={selectedAsset} onBack={() => setSelectedAsset(null)} />;
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
                            <AssetDataMassEditor onSave={setAssets} t={t} />
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
                                        <TableCell className="text-center"><Button variant="outline" size="sm" onClick={() => setSelectedAsset(asset)}>{t('performance.table.analyze')}</Button></TableCell>
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
