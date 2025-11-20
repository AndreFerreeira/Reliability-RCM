'use client';

import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const papers = [
    {
        name: 'Weibull',
        url: 'https://i.imgur.com/gJ5nB2X.png',
        description: 'Papel de probabilidade para análise de dados Weibull. As escalas são logarítmicas para linearizar os dados.'
    },
    {
        name: 'Lognormal',
        url: 'https://i.imgur.com/u5g12r0.png',
        description: 'Papel de probabilidade para análise de dados Lognormal. O eixo do tempo é logarítmico.'
    },
    {
        name: 'Normal',
        url: 'https://i.imgur.com/8pUnjD3.png',
        description: 'Papel de probabilidade para análise de dados com distribuição Normal (Gaussiana).'
    },
    {
        name: 'Exponencial',
        url: 'https://i.imgur.com/vBmn8yW.png',
        description: 'Papel de probabilidade para análise de dados com distribuição Exponencial. Um caso especial da Weibull com β=1.'
    }
];

export default function ProbabilityPaperImages() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Visualização dos Papéis de Probabilidade</CardTitle>
                <CardDescription>
                    Imagens de referência para os diferentes tipos de papéis de probabilidade usados na análise de dados de vida.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="Weibull" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
                        {papers.map(paper => (
                             <TabsTrigger key={paper.name} value={paper.name}>{paper.name}</TabsTrigger>
                        ))}
                    </TabsList>
                    {papers.map(paper => (
                         <TabsContent key={paper.name} value={paper.name}>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Papel de Probabilidade {paper.name}</CardTitle>
                                    <CardDescription>{paper.description}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="relative aspect-[4/5] w-full max-w-2xl mx-auto overflow-hidden rounded-md border">
                                         <Image
                                            src={paper.url}
                                            alt={`Papel de Probabilidade ${paper.name}`}
                                            fill
                                            className="object-contain"
                                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    ))}
                </Tabs>
            </CardContent>
        </Card>
    );
}
