import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { medianRankTables, type MedianRankTable } from '@/lib/median-ranks';

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

export default function WeibullPaper() {
    const [selectedSize, setSelectedSize] = useState<number | null>(null);

    const selectedTable = selectedSize ? medianRankTables.find(t => t.sampleSize === selectedSize) : null;
    const availableSizes = medianRankTables.map(t => t.sampleSize).sort((a,b) => a - b);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Papel de Probabilidade Weibull</CardTitle>
                    <CardDescription>
                        Use estas tabelas de Postos Medianos (Median Ranks) para plotar pontos de dados em um papel de probabilidade Weibull e realizar uma análise gráfica. Ordene seus tempos de falha e use a coluna O/N (Ordem) correspondente para encontrar o valor do posto mediano.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="max-w-xs">
                        <label htmlFor="sample-size-select" className="text-sm font-medium">Selecione o Tamanho da Amostra (N)</label>
                        <Select onValueChange={(value) => setSelectedSize(parseInt(value))}>
                            <SelectTrigger id="sample-size-select">
                                <SelectValue placeholder="Escolha um tamanho de amostra..." />
                            </SelectTrigger>
                            <SelectContent>
                                {availableSizes.map(size => (
                                    <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
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
        </div>
    );
}
