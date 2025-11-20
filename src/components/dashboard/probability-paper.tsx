'use client';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ProbabilityPlot from './probability-plot';
import type { Supplier } from '@/lib/types';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { estimateWeibullRankRegression } from '@/lib/reliability';

const PaperInfoCard = ({ paperType }: { paperType: string }) => {
    let title = '', description = '', xAxis = '', yAxis = '';

    switch(paperType) {
        case 'Weibull':
            title = 'Papel de Probabilidade Weibull';
            description = 'Usado para determinar se os dados se ajustam a uma distribuição Weibull e estimar os parâmetros graficamente. Os dados formarão uma linha reta neste papel se a distribuição for Weibull.';
            xAxis = 'ln(Tempo)';
            yAxis = 'ln(ln(1 / (1 - F(t))))';
            break;
        case 'Exponencial':
            title = 'Papel de Probabilidade Exponencial';
            description = 'Um caso especial do papel Weibull (onde β=1). Usado para verificar se os dados seguem uma distribuição exponencial, que modela eventos que ocorrem a uma taxa constante.';
            xAxis = 'Tempo';
            yAxis = 'ln(1 / (1 - F(t)))';
            break;
        case 'Lognormal':
            title = 'Papel de Probabilidade Lognormal';
            description = 'Usado para dados cujo logaritmo segue uma distribuição normal. Comum em processos de crescimento e em algumas análises de tempo de vida.';
            xAxis = 'ln(Tempo)';
            yAxis = 'Inversa da Normal Padrão (Z-score)';
            break;
        case 'Normal':
            title = 'Papel de Probabilidade Normal';
            description = 'Usado para verificar se os dados se ajustam a uma distribuição normal (Gaussiana). Muitos fenômenos naturais seguem esta distribuição.';
            xAxis = 'Tempo';
            yAxis = 'Inversa da Normal Padrão (Z-score)';
            break;
        default:
            return null;
    }

    return (
        <Card className="bg-muted/30">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="font-semibold text-foreground">Eixo X (Horizontal)</p>
                        <p className="font-mono text-muted-foreground">{xAxis}</p>
                    </div>
                    <div>
                        <p className="font-semibold text-foreground">Eixo Y (Vertical)</p>
                        <p className="font-mono text-muted-foreground">{yAxis}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};


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
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="w-full max-w-sm space-y-4">
                        <p className="text-sm font-medium">Filtros</p>
                        <Select value={paperType} onValueChange={(v) => setPaperType(v as any)}>
                            <SelectTrigger id="paper-type-select">
                                <SelectValue placeholder="Selecione o Tipo de Papel" />
                            </SelectTrigger>
                            <SelectContent>
                                {paperTypes.map(type => (
                                    <SelectItem key={type} value={type}>{type}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <PaperInfoCard paperType={paperType} />
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