import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { medianRankTables, type MedianRankTable } from '@/lib/median-ranks';
import ProbabilityPaperImages from './probability-paper-images';

const headers = ["10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%"];

const RankTable = ({ table }: { table: MedianRankTable }) => (
    <Card>
        <CardHeader>
            <CardTitle>Postos Medianos para Tamanho da Amostra = {table.sampleSize}</CardTitle>
            <CardDescription>Use a coluna O/N (Ordem/Nº da Falha) para encontrar o posto mediano na porcentagem de confiança desejada.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="font-bold text-center">O/N</TableHead>
                            {headers.map(header => (
                                <TableHead key={header} className="font-bold text-center">{header}</TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {table.data.map((row, rowIndex) => (
                            <TableRow key={rowIndex}>
                                {row.map((cell, cellIndex) => (
                                    <TableCell key={cellIndex} className={`text-center ${cellIndex === 0 ? 'font-bold' : 'font-mono text-xs'}`}>
                                        {cellIndex === 0 ? cell : cell.toFixed(4)}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
    </Card>
);

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
    const [selectedSize, setSelectedSize] = useState<number | null>(null);
    const [paperType, setPaperType] = useState('Weibull');

    const selectedTable = selectedSize ? medianRankTables.find(t => t.sampleSize === selectedSize) : null;
    const availableSizes = medianRankTables.map(t => t.sampleSize).sort((a,b) => a - b);
    const paperTypes = ['Weibull', 'Exponencial', 'Lognormal', 'Normal'];

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Papéis de Probabilidade e Postos Medianos</CardTitle>
                    <CardDescription>
                        Ferramentas para análise gráfica da vida útil. Use as tabelas de Postos Medianos para plotar pontos de dados em um papel de probabilidade e realizar uma análise visual. Ordene seus tempos de falha e use a coluna O/N (Ordem) correspondente para encontrar o valor do posto mediano, que é uma estimativa da probabilidade de falha acumulada (F(t)).
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-4">
                        <p className="text-sm font-medium">Filtros</p>
                        <Select onValueChange={(value) => setSelectedSize(parseInt(value))}>
                            <SelectTrigger>
                                <SelectValue placeholder="1. Selecione o Tamanho da Amostra (N)" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableSizes.map(size => (
                                    <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                         <Select value={paperType} onValueChange={setPaperType}>
                            <SelectTrigger>
                                <SelectValue placeholder="2. Selecione o Tipo de Papel" />
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

            {selectedTable ? (
                <RankTable table={selectedTable} />
            ) : (
                selectedSize && (
                    <Card>
                        <CardContent className="p-6">
                            <p className="text-center text-muted-foreground">Tabela para o tamanho de amostra {selectedSize} não disponível.</p>
                        </CardContent>
                    </Card>
                )
            )}

            <ProbabilityPaperImages />
        </div>
    );
}
