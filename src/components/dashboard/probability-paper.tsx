'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { medianRankTables } from '@/lib/median-ranks';
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

const confidenceLevels = [10, 20, 30, 40, 50, 60, 70, 80, 90];

const MedianRankTable = ({ sampleSize, confidenceLevel }: { sampleSize: number, confidenceLevel: number }) => {
    const tableData = medianRankTables.find(t => t.sampleSize === sampleSize)?.data;
    
    if (!tableData) {
        return <p className="text-muted-foreground text-sm py-4">Selecione um tamanho de amostra entre 2 e 25 para ver a tabela de postos medianos.</p>;
    }
    
    const confidenceIndex = confidenceLevels.indexOf(confidenceLevel);

    return (
        <div className="max-h-64 overflow-y-auto rounded-md border">
            <Table>
                <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                    <TableRow>
                        <TableHead className="w-[120px]">Ordem da Falha (i)</TableHead>
                        <TableHead>Posto Mediano ({confidenceLevel}%)</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {tableData.map((row, index) => (
                        <TableRow key={index}>
                            <TableCell className="font-medium">{row[0]}</TableCell>
                            <TableCell>{(row[confidenceIndex + 1]).toFixed(5)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};


export default function ProbabilityPaper() {
    const [paperType, setPaperType] = useState<'Weibull' | 'Lognormal' | 'Normal' | 'Exponential'>('Weibull');
    const [sampleSize, setSampleSize] = useState(10);
    const [confidenceLevel, setConfidenceLevel] = useState(50);
    const [failureData, setFailureData] = useState('500\n900\n1200\n1600\n1800');
    const [localSupplier, setLocalSupplier] = useState<Supplier | null>(null);
    const { toast } = useToast();

    const paperTypes = ['Weibull', 'Exponencial', 'Lognormal', 'Normal'];
    const sampleSizes = Array.from({ length: 24 }, (_, i) => i + 2);

    const handlePlot = () => {
        const times = failureData.replace(/\./g, '').split(/[\s,]+/).map(v => parseFloat(v.trim())).filter(v => !isNaN(v) && v > 0);
        
        if (times.length < 2) {
            toast({
                variant: 'destructive',
                title: 'Dados Insuficientes',
                description: 'Por favor, insira pelo menos dois tempos de falha válidos para plotar.',
            });
            setLocalSupplier(null);
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

    useEffect(() => {
        handlePlot();
         // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const suppliersToPlot = localSupplier ? [localSupplier] : [];

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Papéis de Probabilidade e Postos Medianos</CardTitle>
                    <CardDescription>
                        Use os filtros para exibir a tabela de postos medianos ou o cartão de informações do papel de probabilidade desejado. Esta seção é para referência e cálculos manuais.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <p className="text-sm font-medium">Filtros</p>
                         <Select value={sampleSize.toString()} onValueChange={(v) => setSampleSize(parseInt(v, 10))}>
                            <SelectTrigger id="sample-size-select">
                                <SelectValue placeholder="Tamanho da Amostra (N)" />
                            </SelectTrigger>
                            <SelectContent>
                                {sampleSizes.map(size => (
                                    <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={confidenceLevel.toString()} onValueChange={(v) => setConfidenceLevel(parseInt(v, 10))}>
                            <SelectTrigger id="confidence-level-select">
                                <SelectValue placeholder="Nível de Confiança" />
                            </SelectTrigger>
                            <SelectContent>
                                {confidenceLevels.map(level => (
                                    <SelectItem key={level} value={level.toString()}>{level}%</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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
                    <div className="md:col-span-2">
                        <h3 className="text-sm font-medium mb-2">Tabela de Postos Medianos de Confiança (N = {sampleSize})</h3>
                        <MedianRankTable sampleSize={sampleSize} confidenceLevel={confidenceLevel} />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Visualização Dinâmica – Weibull</CardTitle>
                    <CardDescription>
                        Insira os dados de tempo até a falha para gerar um gráfico de probabilidade Weibull dinâmico e estimar os parâmetros.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="failure-data-input">Tempos até a Falha (TTF)</Label>
                            <Textarea
                                id="failure-data-input"
                                value={failureData}
                                onChange={(e) => setFailureData(e.target.value)}
                                placeholder="Ex: 500, 900, 1200..."
                                rows={8}
                            />
                            <p className="text-xs text-muted-foreground">
                                Insira valores separados por vírgula, espaço ou nova linha.
                            </p>
                        </div>
                        <Button onClick={handlePlot} className="w-full">Plotar Gráfico</Button>
                    </div>
                    <div className="md:col-span-2">
                        <ProbabilityPlot suppliers={suppliersToPlot} paperType="Weibull" />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

    