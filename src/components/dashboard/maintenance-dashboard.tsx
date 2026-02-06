'use client';

import React from 'react';
import { ArrowDown, ArrowRight, ArrowUp, Cog, DollarSign, Search, Trash2, TrendingUp, Plus } from 'lucide-react';
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '../ui/textarea';
import { estimateParameters } from '@/lib/reliability';

function AssetEditorDialog({ assets, setAssets, t }: { assets: AssetData[], setAssets: (assets: AssetData[]) => void, t: (key: string, args?: any) => string }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [editableAssets, setEditableAssets] = React.useState<AssetData[]>([]);
  const { toast } = useToast();

  React.useEffect(() => {
    if (isOpen) {
      setEditableAssets(JSON.parse(JSON.stringify(assets)));
    }
  }, [assets, isOpen]);

  const handleSave = () => {
    setAssets(editableAssets);
    toast({
      title: t('toasts.assetUpdateSuccess.title'),
      description: t('toasts.assetUpdateSuccess.description'),
    });
    setIsOpen(false);
  };
  
  const handleAddAsset = () => {
    const newAsset: AssetData = {
        id: `ASSET-${Date.now().toString().slice(-4)}`,
        name: 'Novo Ativo',
        location: '',
        criticality: 'C',
        lifecycle: 'stable',
        pdmHealth: 100,
        availability: 100,
        maintenanceCost: 0,
        gbv: 0,
        downtimeLoss: 0,
        failureTimes: '',
        rpn: 0,
        severity: 0,
        mttr: 0,
    };
    setEditableAssets(prev => [...prev, newAsset]);
  };

  const handleRemoveAsset = (id: string) => {
    setEditableAssets(prev => prev.filter(asset => asset.id !== id));
  };

  const handleInputChange = (id: string, field: keyof AssetData, value: any) => {
    setEditableAssets(prev => prev.map(asset => {
        if (asset.id === id) {
            const updatedAsset = { ...asset };

            const numericFields: (keyof AssetData)[] = ['pdmHealth', 'availability', 'maintenanceCost', 'gbv', 'downtimeLoss', 'rpn', 'severity', 'mttr'];
            if (numericFields.includes(field)) {
                updatedAsset[field] = parseFloat(value) || 0;
            } else {
                updatedAsset[field] = value;
            }
            
            // NEW: Automatically calculate lifecycle based on failure times
            if (field === 'failureTimes') {
                const failureTimesArray = (value || '').split(',').map(t => parseFloat(t.trim())).filter(t => !isNaN(t) && t > 0);
                
                // Only calculate if we have enough data points for a meaningful estimation
                if (failureTimesArray.length >= 3) {
                    try {
                        const { params } = estimateParameters({
                            dist: 'Weibull',
                            failureTimes: failureTimesArray,
                            method: 'MLE', // MLE is generally better for parameter estimation
                        });
                        
                        if (params.beta) {
                            if (params.beta < 0.95) { // Infant mortality
                                updatedAsset.lifecycle = 'infant';
                            } else if (params.beta > 1.05) { // Wear-out
                                updatedAsset.lifecycle = 'wearOut';
                            } else { // Useful life
                                updatedAsset.lifecycle = 'stable';
                            }
                        }
                    } catch (e) {
                        // Could fail if data is not good, just keep the old value
                        console.error("Could not calculate lifecycle", e);
                    }
                }
            }
            
            return updatedAsset;
        }
        return asset;
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
            <Cog className="mr-2 h-4 w-4" />
            {t('performance.inventory.manageAssets')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('assetEditor.title')}</DialogTitle>
          <DialogDescription>
            {t('assetEditor.description')}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-start">
             <Button onClick={handleAddAsset}><Plus className="mr-2 h-4 w-4" />{t('assetEditor.addAsset')}</Button>
        </div>
        <ScrollArea className="flex-grow pr-6">
          <Accordion type="single" collapsible className="w-full">
            {editableAssets.map((asset) => (
              <AccordionItem value={asset.id} key={asset.id}>
                <AccordionTrigger className="flex justify-between items-center">
                    <span className="font-medium text-foreground">{asset.name}</span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 p-2">
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor={`name-${asset.id}`}>{t('assetEditor.fields.name')}</Label>
                            <Input id={`name-${asset.id}`} value={asset.name} onChange={(e) => handleInputChange(asset.id, 'name', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`id-${asset.id}`}>{t('assetEditor.fields.id')}</Label>
                            <Input id={`id-${asset.id}`} value={asset.id} onChange={(e) => handleInputChange(asset.id, 'id', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`location-${asset.id}`}>{t('assetEditor.fields.location')}</Label>
                            <Input id={`location-${asset.id}`} value={asset.location} onChange={(e) => handleInputChange(asset.id, 'location', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`criticality-${asset.id}`}>{t('assetEditor.fields.criticality')}</Label>
                             <Select value={asset.criticality} onValueChange={(value) => handleInputChange(asset.id, 'criticality', value)}>
                                <SelectTrigger id={`criticality-${asset.id}`}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="AA">AA</SelectItem>
                                    <SelectItem value="A">A</SelectItem>
                                    <SelectItem value="B">B</SelectItem>
                                    <SelectItem value="C">C</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`lifecycle-${asset.id}`}>{t('assetEditor.fields.lifecycle')}</Label>
                            <Input
                                id={`lifecycle-${asset.id}`}
                                value={t(`performance.lifecycle.${asset.lifecycle}`)}
                                disabled
                                className="font-medium text-foreground"
                            />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor={`pdmHealth-${asset.id}`}>{t('assetEditor.fields.pdmHealth')}</Label>
                            <Input id={`pdmHealth-${asset.id}`} type="number" value={asset.pdmHealth} onChange={(e) => handleInputChange(asset.id, 'pdmHealth', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`availability-${asset.id}`}>{t('assetEditor.fields.availability')}</Label>
                            <Input id={`availability-${asset.id}`} type="number" value={asset.availability} onChange={(e) => handleInputChange(asset.id, 'availability', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`maintenanceCost-${asset.id}`}>{t('assetEditor.fields.maintenanceCost')}</Label>
                            <Input id={`maintenanceCost-${asset.id}`} type="number" value={asset.maintenanceCost} onChange={(e) => handleInputChange(asset.id, 'maintenanceCost', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`gbv-${asset.id}`}>{t('assetEditor.fields.gbv')}</Label>
                            <Input id={`gbv-${asset.id}`} type="number" value={asset.gbv} onChange={(e) => handleInputChange(asset.id, 'gbv', e.target.value)} />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor={`downtimeLoss-${asset.id}`}>{t('assetEditor.fields.downtimeLoss')}</Label>
                            <Input id={`downtimeLoss-${asset.id}`} type="number" value={asset.downtimeLoss} onChange={(e) => handleInputChange(asset.id, 'downtimeLoss', e.target.value)} />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor={`rpn-${asset.id}`}>{t('assetEditor.fields.rpn')}</Label>
                            <Input id={`rpn-${asset.id}`} type="number" value={asset.rpn} onChange={(e) => handleInputChange(asset.id, 'rpn', e.target.value)} />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor={`severity-${asset.id}`}>{t('assetEditor.fields.severity')}</Label>
                            <Input id={`severity-${asset.id}`} type="number" value={asset.severity} onChange={(e) => handleInputChange(asset.id, 'severity', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`mttr-${asset.id}`}>{t('assetEditor.fields.mttr')}</Label>
                            <Input id={`mttr-${asset.id}`} type="number" value={asset.mttr} onChange={(e) => handleInputChange(asset.id, 'mttr', e.target.value)} />
                        </div>
                        <div className="space-y-2 col-span-1 md:col-span-2 lg:col-span-3">
                            <Label htmlFor={`failureTimes-${asset.id}`}>{t('assetEditor.fields.failureTimes')}</Label>
                            <Textarea id={`failureTimes-${asset.id}`} value={asset.failureTimes} placeholder={t('assetEditor.fields.failureTimesPlaceholder')} onChange={(e) => handleInputChange(asset.id, 'failureTimes', e.target.value)} rows={3} />
                        </div>
                    </div>
                    <div className="flex justify-end mt-4">
                        <Button variant="destructive" size="sm" onClick={() => handleRemoveAsset(asset.id)}><Trash2 className="mr-2 h-4 w-4"/>{t('assetEditor.removeAsset')}</Button>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollArea>
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
