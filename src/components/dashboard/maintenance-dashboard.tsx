'use client';

import React from 'react';
import { AlertTriangle, ArrowDown, ArrowRight, ArrowUp, Clock, Cog, DollarSign, MapPin, Pencil, Search, Tag, Trash2, TrendingUp, Upload, Wrench, CalendarClock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { useI18n } from '@/i18n/i18n-provider';
import type { AssetData, LogEvent } from '@/lib/types';
import { cn } from '@/lib/utils';
import assetData from '@/lib/asset-data.json';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { AssetDetailView } from './asset-detail-view';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '../ui/textarea';
import { findBestDistribution, getReliability, getMedianLife } from '@/lib/reliability';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const headerMapping: Record<string, string> = {
    // Portuguese
    'id do equipamento': 'id',
    'id': 'id',
    'tag': 'id',
    'equipamento': 'id',
    'denominação do objeto técnico': 'id',
    'descrição': 'name',
    'descricao': 'name',
    'nome': 'name',
    'descrição da ordem': 'description',
    'descrição ordem': 'description',
    'descricao ordem': 'description',
    'número da ordem': 'orderNumber',
    'numero da ordem': 'orderNumber',
    'tipo de intervenção': 'interventionType',
    'tipo de intervencao': 'interventionType',
    'tipo de ordem': 'interventionType',
    'status da ordem': 'status',
    'suspensão ou falha': 'status',
    'localização': 'location',
    'localizacao': 'location',
    'criticidade': 'criticality',
    'ciclo de vida': 'lifecycle',
    'saúde pdm': 'pdmHealth',
    'saude pdm': 'pdmHealth',
    'pdm health': 'pdmHealth',
    'disponibilidade': 'availability',
    'custo de manutenção': 'maintenanceCost',
    'custo r&m': 'maintenanceCost',
    'total real': 'maintenanceCost',
    'gbv': 'gbv',
    'custo por hora de downtime': 'downtimeCostPerHour',
    'rpn': 'rpn',
    'severidade': 'severity',
    
    // Calculation fields
    'data': 'startDate',
    'data de inicio': 'startDate',
    'data de início': 'startDate',
    'data-base do início': 'startDate',
    'data de término': 'endDate',
    'data de termino': 'endDate',
    'data-base do fim': 'endDate',
    'status': 'status',
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
    'downtime cost per hour': 'downtimeCostPerHour',
    'failure times': 'failureTimes',
    'rpn': 'rpn',
    'severity': 'severity',
    'start date': 'startDate',
    'end date': 'endDate',
    'date': 'startDate',
    'status': 'status',
};

const requiredFields: (keyof AssetData)[] = [
    'id', 'name', 'criticality', 'pdmHealth',
    'maintenanceCost', 'gbv', 'failureTimes', 'rpn', 'severity', 'mttr', 'downtimeCostPerHour'
];

function parseDate(dateStr: string): Date | null {
    if (!dateStr || typeof dateStr !== 'string') return null;
    
    // Try to match with time
    let parts = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):?(\d{2})?/);
    if (parts) {
        const [, day, month, year, hour, minute, second] = parts;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), second ? parseInt(second) : 0);
    }

    // Try to match date only
    parts = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (parts) {
        const [, day, month, year] = parts;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    
    return null;
}


function AssetDataMassEditor({ assets, onSave, t }: { assets: AssetData[], onSave: (assets: AssetData[]) => void, t: (key: string, args?: any) => string }) {
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
        const headerMap: Record<string, number> = {};
        headerLine.forEach((h, i) => { 
            const mappedKey = headerMapping[h.toLowerCase()];
            if(mappedKey) headerMap[mappedKey] = i;
        });

        const isEventLog = headerMap['id'] !== undefined && headerMap['startDate'] !== undefined;
        let newAssets: Partial<AssetData>[];

        if (isEventLog) {
            const hasEndDate = headerMap['endDate'] !== undefined;
            const hasStatus = headerMap['status'] !== undefined;
            const allRows = lines.map(line => line.split('\t'));

            const groupedByTag: Record<string, string[][]> = {};
            allRows.forEach(row => {
                const tag = row[headerMap['id']];
                if (tag) {
                    if (!groupedByTag[tag]) groupedByTag[tag] = [];
                    groupedByTag[tag].push(row);
                }
            });

            newAssets = Object.values(groupedByTag).map((rows, groupIndex) => {
                const firstRow = rows[0];
                const tag = firstRow[headerMap['id']];

                const events = rows.map(row => ({
                    row,
                    startDate: parseDate(row[headerMap['startDate']]),
                    endDate: hasEndDate ? parseDate(row[headerMap['endDate']]) : null,
                    status: (hasStatus ? row[headerMap['status']]?.toUpperCase().trim() : 'FALHA').replace('Ç', 'C')
                }))
                .filter((e): e is { row: string[]; startDate: Date; endDate: Date | null; status: string } => e.startDate !== null)
                .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

                const logEvents: LogEvent[] = events.map((e, index) => ({
                    tag: e.row[headerMap['id']] || '',
                    startDate: e.row[headerMap['startDate']] || '',
                    endDate: hasEndDate ? e.row[headerMap['endDate']] || '' : '',
                    description: e.row[headerMap['description']] || t('assetDetail.eventLog.defaultDescription'),
                    orderNumber: e.row[headerMap['orderNumber']] || (100000 + index).toString(),
                    interventionType: e.row[headerMap['interventionType']] || t('assetDetail.eventLog.defaultIntervention'),
                    status: e.status,
                }));

                const failureTimes: number[] = [];
                const repairTimes: number[] = [];
                const failureEvents = events.filter(e => ['FALHA', 'CORRETIVA'].includes(e.status));

                if (hasEndDate) { // Two-date event log
                     for (let i = 0; i < failureEvents.length; i++) {
                        const event = failureEvents[i];
                        if (event.endDate) {
                            const repairTimeHours = (event.endDate.getTime() - event.startDate.getTime()) / (1000 * 60 * 60);
                            if (repairTimeHours >= 0) repairTimes.push(repairTimeHours === 0 ? 24 : repairTimeHours);
                        }
                        if (i > 0) {
                            const prevEvent = failureEvents[i - 1];
                            if (prevEvent.endDate) {
                                const timeBetweenFailuresHours = (event.startDate.getTime() - prevEvent.endDate.getTime()) / (1000 * 60 * 60);
                                if (timeBetweenFailuresHours > 0) failureTimes.push(timeBetweenFailuresHours);
                            }
                        }
                    }
                } else { // Single-date event log
                    for (let i = 1; i < failureEvents.length; i++) {
                        const timeBetweenFailuresHours = (failureEvents[i].startDate.getTime() - failureEvents[i - 1].startDate.getTime()) / (1000 * 60 * 60);
                        if (timeBetweenFailuresHours > 0) failureTimes.push(timeBetweenFailuresHours);
                    }
                }

                const asset: Partial<AssetData> = { id: tag };
                
                asset.maintenanceCost = rows.reduce((sum, row) => {
                    const costStr = row[headerMap['maintenanceCost']];
                    if (costStr) return sum + (parseFloat(costStr.replace(/[^0-9,.-]+/g, '').replace(/\./g, '').replace(',', '.')) || 0);
                    return sum;
                }, 0);

                Object.keys(headerMap).forEach(key => {
                    const index = headerMap[key];
                    const value = firstRow[index]?.trim();
                    if (value === undefined) return;

                    const staticFields: (keyof AssetData)[] = ['name', 'location', 'criticality', 'pdmHealth', 'availability', 'gbv', 'rpn', 'severity', 'downtimeCostPerHour'];
                    if (staticFields.includes(key as any)) {
                        const mappedKey = key as keyof AssetData;
                        const numericFields: (keyof AssetData)[] = ['pdmHealth', 'availability', 'gbv', 'rpn', 'severity', 'downtimeCostPerHour'];
                        if (numericFields.includes(mappedKey)) {
                           (asset[mappedKey] as any) = parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
                        } else if (mappedKey === 'criticality') {
                            asset.criticality = (value.toUpperCase() as any) || 'C';
                        } else {
                           (asset[mappedKey] as any) = value;
                        }
                    }
                });

                if (!asset.name) asset.name = tag;

                asset.failureTimes = failureTimes.join(', ');
                asset.mttr = repairTimes.length > 0 ? repairTimes.reduce((a, b) => a + b, 0) / repairTimes.length : 0;
                
                if (asset.mttr === 0 && headerMap['mttr'] !== undefined) {
                    asset.mttr = parseFloat(firstRow[headerMap['mttr']].replace(',', '.')) || 0;
                }

                const ftArray = asset.failureTimes.split(/[,; ]+/).map(t => parseFloat(t.trim())).filter(t => !isNaN(t) && t > 0);
                const stArray: number[] = []; // Suspensions are not yet parsed from event logs
                if (ftArray.length >= 2) {
                    const { results, best } = findBestDistribution(ftArray, stArray);
                    if (best && results.length > 0) {
                        const bestFit = results.find(r => r.distribution === best);
                        if (bestFit) {
                            asset.distribution = best;
                            asset.beta = bestFit.params.beta;
                            asset.eta = bestFit.params.eta;
                            asset.mean = bestFit.params.mean;
                            asset.stdDev = bestFit.params.stdDev;
                            asset.lambda = bestFit.params.lambda;
                            asset.rho = bestFit.rSquared;

                            if (best === 'Weibull' && asset.beta) {
                                if (asset.beta < 0.95) asset.lifecycle = 'infant';
                                else if (asset.beta > 1.05) asset.lifecycle = 'wearOut';
                                else asset.lifecycle = 'stable';
                            } else {
                                asset.lifecycle = 'stable';
                            }
                        }
                    }
                } else {
                    asset.lifecycle = 'stable';
                }

                asset.events = logEvents;

                return asset;
            });
        } else {
            const columnIndexMap: Partial<Record<keyof AssetData, number>> = {};
            headerLine.forEach((header, index) => {
                const mappedKey = headerMapping[header];
                if (mappedKey && requiredFields.includes(mappedKey as any)) {
                    columnIndexMap[mappedKey as keyof AssetData] = index;
                }
            });
            
            const missingHeaders = requiredFields.filter(field => columnIndexMap[field] === undefined);
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
                         const numericFields: (keyof AssetData)[] = ['pdmHealth', 'availability', 'maintenanceCost', 'gbv', 'downtimeCostPerHour', 'rpn', 'severity', 'mttr'];
                        
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
                 if (failureTimesArray.length >= 2) {
                    const { results, best } = findBestDistribution(failureTimesArray, []);
                    if (best && results.length > 0) {
                        const bestFit = results.find(r => r.distribution === best);
                        if (bestFit) {
                            asset.distribution = best;
                            asset.beta = bestFit.params.beta;
                            asset.eta = bestFit.params.eta;
                            asset.mean = bestFit.params.mean;
                            asset.stdDev = bestFit.params.stdDev;
                            asset.lambda = bestFit.params.lambda;
                            asset.rho = bestFit.rSquared;

                            if (best === 'Weibull' && asset.beta) {
                                if (asset.beta < 0.95) asset.lifecycle = 'infant';
                                else if (asset.beta > 1.05) asset.lifecycle = 'wearOut';
                                else asset.lifecycle = 'stable';
                            } else {
                                asset.lifecycle = 'stable';
                            }
                        }
                    }
                } else {
                    asset.lifecycle = 'stable';
                }

                return asset;
            });
        }

        const assetsMap = new Map(assets.map(a => [a.id, a]));

        newAssets.forEach(newAsset => {
            const existingAsset = assetsMap.get(newAsset.id!);
            
            const cleanNewAsset = Object.fromEntries(
                Object.entries(newAsset).filter(([, v]) => v !== undefined)
            );

            if (existingAsset) {
                assetsMap.set(newAsset.id!, { ...existingAsset, ...cleanNewAsset });
            } else {
                const defaultAsset: AssetData = {
                    id: newAsset.id!,
                    name: newAsset.name || `Asset ${newAsset.id}`,
                    location: 'N/A',
                    criticality: 'C',
                    lifecycle: 'stable',
                    pdmHealth: 0,
                    availability: 0,
                    maintenanceCost: 0,
                    gbv: 0,
                    downtimeLoss: 0,
                    downtimeCostPerHour: 0,
                    failureTimes: '',
                    rpn: 0,
                    severity: 0,
                    mttr: 0,
                    units: 'h',
                };
                assetsMap.set(newAsset.id!, { ...defaultAsset, ...cleanNewAsset } as AssetData);
            }
        });

        onSave(Array.from(assetsMap.values()));

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
            <p><strong>{t('assetEditor.instructions.requiredHeaders')}:</strong> <code className="text-xs">tag, data, status, custo de manutenção, gbv...</code></p>
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

const assetSchema = z.object({
    name: z.string().min(1),
    location: z.string(),
    criticality: z.enum(['AA', 'A', 'B', 'C']),
    pdmHealth: z.coerce.number(),
    availability: z.coerce.number(),
    maintenanceCost: z.coerce.number(),
    gbv: z.coerce.number(),
    downtimeCostPerHour: z.coerce.number().optional(),
    failureTimes: z.string(),
    rpn: z.coerce.number(),
    severity: z.coerce.number(),
    mttr: z.coerce.number(),
});

function AssetEditorDialog({ asset, onSave, onCancel, t }: { asset: AssetData; onSave: (data: AssetData) => void; onCancel: () => void; t: (key: string) => string }) {
    const form = useForm<z.infer<typeof assetSchema>>({
        resolver: zodResolver(assetSchema),
        defaultValues: {
            name: asset.name ?? '',
            location: asset.location ?? '',
            criticality: asset.criticality ?? 'C',
            pdmHealth: asset.pdmHealth ?? 0,
            availability: asset.availability ?? 0,
            maintenanceCost: asset.maintenanceCost ?? 0,
            gbv: asset.gbv ?? 0,
            downtimeCostPerHour: asset.downtimeCostPerHour ?? 0,
            failureTimes: asset.failureTimes ?? '',
            rpn: asset.rpn ?? 0,
            severity: asset.severity ?? 0,
            mttr: asset.mttr ?? 0,
        },
    });

    function onSubmit(data: z.infer<typeof assetSchema>) {
        const ftArray = data.failureTimes.split(/[,; ]+/).map(t => parseFloat(t.trim())).filter(t => !isNaN(t) && t > 0);
        let updatedAssetData: AssetData = { ...asset, ...data, units: asset.units || 'h' };
        
        if (ftArray.length >= 2) {
            const { results, best } = findBestDistribution(ftArray, []); // Assuming no suspensions
            if (best && results.length > 0) {
                const bestFit = results.find(r => r.distribution === best);
                if (bestFit) {
                    updatedAssetData.distribution = best;
                    updatedAssetData.beta = bestFit.params.beta;
                    updatedAssetData.eta = bestFit.params.eta;
                    updatedAssetData.mean = bestFit.params.mean;
                    updatedAssetData.stdDev = bestFit.params.stdDev;
                    updatedAssetData.lambda = bestFit.params.lambda;
                    updatedAssetData.rho = bestFit.rSquared;

                    if (best === 'Weibull' && updatedAssetData.beta) {
                        if (updatedAssetData.beta < 0.95) updatedAssetData.lifecycle = 'infant';
                        else if (updatedAssetData.beta > 1.05) updatedAssetData.lifecycle = 'wearOut';
                        else updatedAssetData.lifecycle = 'stable';
                    } else {
                        updatedAssetData.lifecycle = 'stable';
                    }
                }
            }
        } else {
            updatedAssetData.lifecycle = 'stable';
        }
        
        onSave(updatedAssetData);
    }

    return (
        <Dialog open={true} onOpenChange={onCancel}>
            <DialogContent className="sm:max-w-[625px]">
                <DialogHeader>
                    <DialogTitle>{t('assetEditor.titleEdit')}</DialogTitle>
                    <DialogDescription>{t('assetEditor.descriptionEdit')}</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem><FormLabel>{t('performance.table.assetId')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="location" render={({ field }) => (
                                <FormItem><FormLabel>{t('assetEditor.location')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                         <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="criticality" render={({ field }) => (
                                <FormItem><FormLabel>{t('performance.table.criticality')}</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="AA">AA</SelectItem>
                                        <SelectItem value="A">A</SelectItem>
                                        <SelectItem value="B">B</SelectItem>
                                        <SelectItem value="C">C</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage /></FormItem>
                            )} />
                             <FormField control={form.control} name="gbv" render={({ field }) => (
                                <FormItem><FormLabel>{t('assetEditor.gbv')}</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="failureTimes" render={({ field }) => (
                            <FormItem><FormLabel>{t('monteCarlo.confidence.dataLabel')}</FormLabel><FormControl><Textarea {...field} rows={3}/></FormControl><FormMessage /></FormItem>
                        )} />

                        <div className="grid grid-cols-3 gap-4">
                           <FormField control={form.control} name="maintenanceCost" render={({ field }) => (
                                <FormItem><FormLabel>{t('performance.kpi.maintenanceCost')}</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                             <FormField control={form.control} name="downtimeCostPerHour" render={({ field }) => (
                                <FormItem><FormLabel>{t('assetEditor.downtimeCostPerHour')}</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                              <FormField control={form.control} name="mttr" render={({ field }) => (
                                <FormItem><FormLabel>MTTR</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                         <div className="grid grid-cols-3 gap-4">
                           <FormField control={form.control} name="pdmHealth" render={({ field }) => (
                                <FormItem><FormLabel>{t('performance.table.pdmHealth')}</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                             <FormField control={form.control} name="rpn" render={({ field }) => (
                                <FormItem><FormLabel>RPN</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                              <FormField control={form.control} name="severity" render={({ field }) => (
                                <FormItem><FormLabel>{t('assetDetail.pdmScore.severity')}</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>

                        <DialogFooter>
                            <Button type="submit">{t('assetEditor.saveButton')}</Button>
                        </DialogFooter>
                    </form>
                </Form>
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

const getInitialAssets = (): AssetData[] => {
    if (typeof window === 'undefined') {
        return [];
    }
    try {
        const savedAssets = localStorage.getItem('rcm-assets');
        if (savedAssets) {
            return JSON.parse(savedAssets);
        }
    } catch (error) {
        console.error("Failed to parse assets from localStorage", error);
    }
    return assetData.assets;
};

export default function MaintenanceDashboard() {
    const { t } = useI18n();
    const { toast } = useToast();
    const [assets, setAssets] = React.useState<AssetData[]>([]);
    const [selectedAsset, setSelectedAsset] = React.useState<AssetData | null>(null);
    const [editingAsset, setEditingAsset] = React.useState<AssetData | null>(null);
    const [healthData, setHealthData] = React.useState<Map<string, { score: number, daysRemaining: number }>>(new Map());

    React.useEffect(() => {
        setAssets(getInitialAssets());
    }, []);

    React.useEffect(() => {
        if (assets.length > 0) {
            try {
                localStorage.setItem('rcm-assets', JSON.stringify(assets));
            } catch (error) {
                console.error("Failed to save assets to localStorage", error);
            }
        }
    }, [assets]);
    
    const processedAssets = React.useMemo(() => {
        return assets.map(asset => {
            const failureTimesArray = asset.failureTimes?.split(',').map(t => parseFloat(t.trim())).filter(t => !isNaN(t) && t > 0) ?? [];
            const numFailures = failureTimesArray.length;

            const mtbf = numFailures > 0 
                ? failureTimesArray.reduce((sum, t) => sum + t, 0) / numFailures
                : 0;
            
            const availability = (asset.mttr > 0 && mtbf > 0)
                ? (mtbf / (mtbf + asset.mttr))
                : 1;

            const totalHoursDown = numFailures * asset.mttr;

            const downtimeLoss = totalHoursDown * (asset.downtimeCostPerHour ?? 0);

            return {
                ...asset,
                availability: availability * 100, // Stored as percentage
                downtimeLoss: downtimeLoss,
                calculatedTotalHoursDown: totalHoursDown,
                calculatedNumFailures: numFailures,
                mtbf: mtbf
            };
        });
    }, [assets]);


    React.useEffect(() => {
        const newHealthData = new Map<string, { score: number, daysRemaining: number }>();
        
        processedAssets.forEach(asset => {
            if (!asset.distribution || !asset.events || asset.events.length === 0) {
                return;
            }

            const failureEvents = asset.events
                .map(e => ({ ...e, date: parseDate(e.endDate || e.startDate) }))
                .filter((e): e is typeof e & { date: Date } => !!e.date && (e.status === 'FALHA' || e.status === 'CORRETIVA'))
                .sort((a, b) => b.date.getTime() - a.date.getTime());

            if (failureEvents.length > 0) {
                const lastFailureDate = failureEvents[0].date;
                const now = new Date();
                const hoursSinceLastFailure = (now.getTime() - lastFailureDate.getTime()) / (1000 * 60 * 60);

                const reliability = getReliability(asset.distribution, asset, hoursSinceLastFailure);
                const score = isNaN(reliability) ? null : Math.round(reliability * 100);
    
                const medianLife = getMedianLife(asset.distribution, asset);
                const daysRemaining = isNaN(medianLife) ? null : Math.round((medianLife - hoursSinceLastFailure) / 24);

                if (score !== null && daysRemaining !== null) {
                    newHealthData.set(asset.id, {
                        score: score,
                        daysRemaining: daysRemaining
                    });
                }
            }
        });

        setHealthData(newHealthData);
    }, [processedAssets]);

    const kpiValues = React.useMemo(() => {
        if (processedAssets.length === 0) {
            return {
                avgAvailability: 0,
                totalDowntimeLoss: 0,
                totalMaintenanceCost: 0,
                totalGbv: 0,
                maintIntensity: 0,
            };
        }

        const totalDowntimeLoss = processedAssets.reduce((sum, asset) => sum + (asset.downtimeLoss || 0), 0);
        const totalGbv = processedAssets.reduce((sum, asset) => sum + (asset.gbv || 0), 0);
        const totalMaintenanceCost = processedAssets.reduce((sum, asset) => sum + (asset.maintenanceCost || 0), 0);
        
        let validAvailabilityAssets = 0;
        const totalAvailability = processedAssets.reduce((sum, asset) => {
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
            totalMaintenanceCost,
            totalGbv,
            maintIntensity,
        };
    }, [processedAssets]);
    
    let intensityTrend, intensityTrendColor, intensityTrendDirection;

    if (kpiValues.maintIntensity > 10) {
        intensityTrend = t('performance.kpi.veryHigh');
        intensityTrendColor = 'red';
        intensityTrendDirection = 'up';
    } else if (kpiValues.maintIntensity > 3) { // benchmark is 2-3%
        intensityTrend = t('performance.kpi.high');
        intensityTrendColor = 'red';
        intensityTrendDirection = 'up';
    } else if (kpiValues.maintIntensity < 2 && kpiValues.maintIntensity > 0) {
        intensityTrend = t('performance.kpi.low');
        intensityTrendColor = 'green';
        intensityTrendDirection = 'down';
    } else {
        intensityTrend = t('performance.kpi.stable');
        intensityTrendColor = 'gray';
        intensityTrendDirection = 'stable';
    }

    const formatCurrency = (value: number) => {
        if (typeof value !== 'number') return '$0';
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
    }
    
    const handleSaveAsset = (updatedAsset: AssetData) => {
        setAssets(assets => assets.map(a => a.id === updatedAsset.id ? updatedAsset : a));
        setEditingAsset(null);
        toast({
            title: t('toasts.assetUpdateSuccess.title'),
            description: t('toasts.assetUpdateSuccess.description'),
        });
    };

    const handleDeleteAsset = (assetId: string) => {
        setAssets(assets => assets.filter(a => a.id !== assetId));
        toast({
            title: t('toasts.assetDeleted.title'),
            description: t('toasts.assetDeleted.description'),
        });
    };

    if (selectedAsset) {
        return <AssetDetailView asset={selectedAsset} onBack={() => setSelectedAsset(null)} />;
    }


    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-2xl font-semibold tracking-tight">{t('performance.title')}</h2>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <KpiCard title={t('performance.kpi.availability')} value={`${kpiValues.avgAvailability.toFixed(2)}%`} subtitle={t('performance.kpi.availabilityTarget')} icon={TrendingUp} trend={t('performance.kpi.high')} trendDirection="up" trendColor="green" />
                <KpiCard title={t('performance.kpi.revenueLoss')} value={formatCurrency(kpiValues.totalDowntimeLoss)} subtitle={t('performance.kpi.revenueLossPeriod')} icon={DollarSign} trend={t('performance.kpi.low')} trendDirection="down" trendColor="red" />
                <KpiCard title={t('performance.kpi.maintenanceCost')} value={formatCurrency(kpiValues.totalMaintenanceCost)} subtitle={t('performance.kpi.maintenanceCostPeriod')} icon={Wrench} trend={t('performance.kpi.low')} trendDirection="down" trendColor="red" />
                <KpiCard title={t('performance.kpi.intensity')} value={`${kpiValues.maintIntensity.toFixed(2)}%`} subtitle={t('performance.kpi.intensityBenchmark')} icon={TrendingUp} trend={intensityTrend} trendDirection={intensityTrendDirection} trendColor={intensityTrendColor} />
                <KpiCard title={t('performance.kpi.gbv')} value={formatCurrency(kpiValues.totalGbv)} subtitle={t('performance.kpi.gbvSub')} icon={Cog} />
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
                            <AssetDataMassEditor assets={assets} onSave={setAssets} t={t} />
                            <Button variant="link">{t('performance.inventory.export')}</Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-2">
                     <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase">
                        <div className="col-span-3">{t('performance.table.assetInfo')}</div>
                        <div className="col-span-2">{t('performance.table.locationSerial')}</div>
                        <div className="col-span-1 text-right">{t('performance.table.gbv')}</div>
                        <div className="col-span-2 text-right">{t('performance.table.rmCosts')}</div>
                        <div className="col-span-2 text-right">{t('performance.table.lossAnalysis')}</div>
                        <div className="text-right">{t('performance.table.maintIntensity')}</div>
                        <div className="text-right">{t('performance.table.pmCountdown')}</div>
                    </div>
                    {processedAssets.map((asset) => {
                        const maintIntensity = asset.gbv > 0 ? (asset.maintenanceCost / asset.gbv) * 100 : 0;
                        const health = healthData.get(asset.id);
                        const isCritical = health && health.daysRemaining <= 0;

                        const lifecycleText = t(`performance.lifecycle.${asset.lifecycle}`);
                        const lifecycleStyle: React.CSSProperties = {};
                        switch (asset.lifecycle) {
                            case 'wearOut':
                                lifecycleStyle.backgroundColor = 'hsl(var(--destructive))';
                                lifecycleStyle.color = 'hsl(var(--destructive-foreground))';
                                break;
                            case 'infant':
                                lifecycleStyle.backgroundColor = 'hsl(var(--chart-4))';
                                lifecycleStyle.color = '#111';
                                break;
                            case 'stable':
                            default:
                                lifecycleStyle.backgroundColor = 'hsl(var(--accent))';
                                lifecycleStyle.color = 'hsl(var(--accent-foreground))';
                                break;
                        }

                        return (
                            <div 
                                key={asset.id} 
                                className={cn(
                                    "group relative grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-4 rounded-lg hover:bg-muted/50 cursor-pointer border",
                                    isCritical && "animate-flash"
                                )}
                                onClick={() => setSelectedAsset(asset)}
                            >
                                {/* Asset Info */}
                                <div className="flex items-center gap-3 col-span-3">
                                    <div className="bg-muted p-2 rounded-lg">
                                        <Tag className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <div>
                                        <div className="font-bold flex items-center gap-2 flex-wrap">
                                            <span>{asset.name}</span>
                                            <Badge
                                                style={{
                                                    backgroundColor: {
                                                        'AA': 'hsl(var(--destructive))',
                                                        'A': 'hsl(var(--chart-3))',
                                                        'B': 'hsl(var(--chart-4))',
                                                        'C': 'hsl(var(--secondary))'
                                                    }[asset.criticality],
                                                    color: ['A', 'B'].includes(asset.criticality) ? '#111' : 'hsl(var(--primary-foreground))',
                                                }}
                                                className="border-transparent"
                                            >
                                                {asset.criticality}
                                            </Badge>
                                            {asset.lifecycle && (
                                                <Badge className="border-transparent" style={lifecycleStyle}>
                                                    {lifecycleText}
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                                            <span>{asset.id}</span>
                                            {asset.tags && asset.tags.length > 0 && (
                                                <>
                                                    <span className="font-bold text-muted-foreground/50">·</span>
                                                    <span className="truncate">{asset.tags.join(' · ')}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Location & Serial */}
                                <div className="col-span-2">
                                     <div className="font-medium flex items-center gap-2"><MapPin className="h-3 w-3 text-muted-foreground" />{asset.location}</div>
                                     <div className="text-xs text-muted-foreground ml-5">SN: {asset.serialNumber || 'N/A'}</div>
                                </div>

                                {/* GBV */}
                                <div className="text-right font-medium col-span-1">{formatCurrency(asset.gbv)}</div>

                                {/* R&M Costs */}
                                <div className="text-right col-span-2">
                                     <div className="font-bold">{formatCurrency(asset.maintenanceCost)}</div>
                                     <div className="text-xs text-muted-foreground">
                                         <span>PM: {formatCurrency(asset.pmCost ?? 0)}</span>
                                         <span className="font-bold mx-1 text-muted-foreground/50">·</span>
                                         <span className="text-red-500">CM: {formatCurrency(asset.cmCost ?? 0)}</span>
                                     </div>
                                </div>
                                
                                {/* Loss Analysis */}
                                <div className="text-right col-span-2">
                                     <div className="font-bold text-red-500 flex items-center justify-end gap-1">
                                        <AlertTriangle className="h-4 w-4"/>
                                        {formatCurrency(asset.downtimeLoss)}
                                     </div>
                                     <div className="text-xs text-muted-foreground">
                                         <span><Clock className="inline h-3 w-3 mr-1"/>{asset.calculatedTotalHoursDown}h Down</span>
                                         <span className="font-bold mx-1">·</span>
                                         <span>{asset.calculatedNumFailures} Failures</span>
                                     </div>
                                </div>

                                {/* Maint Intensity */}
                                <div className="text-right">
                                     <span className="font-bold text-red-500">{maintIntensity.toFixed(2)}%</span>
                                     <Progress value={maintIntensity > 100 ? 100 : maintIntensity} className="h-1 w-10 bg-red-500/20 [&>div]:bg-red-500"/>
                                </div>

                                 {/* PM Countdown */}
                                <div className="text-right">
                                     {health ? (
                                        <div className="flex flex-col items-end">
                                            <div className={cn(
                                                "font-bold text-lg",
                                                health.daysRemaining < 7 && "text-red-500",
                                                health.daysRemaining >= 7 && health.daysRemaining < 30 && "text-yellow-500",
                                                health.daysRemaining >= 30 && "text-green-500"
                                            )}>
                                                {Math.max(0, health.daysRemaining)} {t('performance.table.days')}
                                            </div>
                                            <div className="text-xs text-muted-foreground">{health.score}% {t('performance.table.health')}</div>
                                        </div>
                                    ) : (
                                        <div className="text-sm text-muted-foreground">--</div>
                                    )}
                                </div>

                                 <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditingAsset(asset); }} aria-label={t('performance.table.edit')}><Pencil className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDeleteAsset(asset.id); }} aria-label={t('performance.table.delete')}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                </div>
                            </div>
                        )
                    })}
                </CardContent>
            </Card>
            {editingAsset && <AssetEditorDialog asset={editingAsset} onSave={handleSaveAsset} onCancel={() => setEditingAsset(null)} t={t} />}
        </div>
    );
}

    
