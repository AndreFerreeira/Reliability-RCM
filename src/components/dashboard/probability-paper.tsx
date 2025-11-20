'use client';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ProbabilityPlot from './probability-paper-images';
import type { Supplier } from '@/lib/types';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { estimateWeibullRankRegression } from '@/lib/reliability';

export default function ProbabilityPaper() {
    const [paperType, setPaperType] = useState<'Weibull' | 'Lognormal' | 'Normal' | 'Exponential'>('Weibull');
    const [failureData, setFailureData] = useState('');
    const [localSupplier, setLocalSupplier] = useState<Supplier | null>(null);
    const { toast } = useToast();

    const paperTypes = ['Weibull', 'Exponencial', 'Lognormal', 'Normal'];

    const handlePlot = () => {
        const times = failureData.replace(/\./g, '').split(/[\s,]+/).map(v => parseFloat(v.trim())).filter(v => !isNaN(v) && v > 0);
        
        if (times.length < 2) {
            toast({
                variant: 'destructive',
                title: 'Dados Insuficientes',
                description: 'Por favor, insira pelo menos dois tempos de falha válidos para plotar.',
            });
            return;
        }

        const { params } = estimateWeibullRankRegression(times);
        
        const newSupplier: Supplier = {
            id: 'local_analysis',
            name: 'Dados Locais',
            failureTimes: times,
            suspensionTimes: [],
            color: 'hsl(var(--chart-1))',
            distribution: 'Weibull',
            params: params,
            units: 'Tempo',
            dataType: { hasSuspensions: false, hasIntervals: false, isGrouped: false }
        };
        setLocalSupplier(newSupplier);
    };

    const suppliersToPlot = localSupplier ? [localSupplier] : [];

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Laboratório de Papel de Probabilidade</CardTitle>
                    <CardDescription>
                        Uma ferramenta de análise gráfica independente. Cole um conjunto de tempos de falha, selecione o tipo de papel e clique em "Plotar Gráfico" para gerar uma análise visual instantânea. Os dados inseridos aqui são apenas para esta análise e não afetam outras abas.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     <div className="w-full max-w-sm">
                        <Label htmlFor="paper-type-select">Tipo de Papel</Label>
                         <Select value={paperType} onValueChange={(v) => setPaperType(v as any)}>
                            <SelectTrigger id="paper-type-select">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {paperTypes.map(type => (
                                    <SelectItem key={type} value={type}>{type}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <ProbabilityPlot suppliers={suppliersToPlot} paperType={paperType}>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="failure-data-input">Dados de Falha</Label>
                        <Textarea
                            id="failure-data-input"
                            placeholder="Insira os tempos de falha separados por vírgula, espaço ou nova linha. Ex: 105, 213, 332, 351"
                            rows={8}
                            value={failureData}
                            onChange={(e) => setFailureData(e.target.value)}
                        />
                    </div>
                    <Button onClick={handlePlot} className="w-full">Plotar Gráfico</Button>
                </div>
            </ProbabilityPlot>
        </div>
    );
}