'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Supplier } from '@/lib/types';
import { Target, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import React from 'react';

interface WeibullParameterAnalysisProps {
    suppliers: Supplier[];
}

const BetaAnalysis = ({ beta }: { beta: number }) => {
    let interpretation, Icon, colorClass, phase;

    if (beta < 1) {
        interpretation = "Foco em melhorar a qualidade, comissionamento e testes de aceitação.";
        Icon = TrendingDown;
        colorClass = "text-green-500";
        phase = "Mortalidade Infantil";
    } else if (beta > 0.95 && beta < 1.05) {
        interpretation = "Considere Manutenção Preventiva (PM) baseada no tempo ou análises de custo-benefício.";
        Icon = Minus;
        colorClass = "text-yellow-500";
        phase = "Vida Útil";
    } else { // beta > 1
        interpretation = "Cenário ideal para Manutenção Preditiva (PdM), pois há um padrão de desgaste claro.";
        Icon = TrendingUp;
        colorClass = "text-red-500";
        phase = "Desgaste";
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-muted ${colorClass}`}>
                    <Icon className="h-6 w-6" />
                </div>
                <div>
                    <p className="font-bold text-lg">{beta.toFixed(2)}</p>
                    <p className="text-sm font-medium text-muted-foreground">Parâmetro de Forma (β)</p>
                </div>
            </div>
            <p className="text-xs text-muted-foreground pl-1">
                <strong className={`font-semibold ${colorClass}`}>{phase}:</strong> {interpretation}
            </p>
        </div>
    );
};

const EtaAnalysis = ({ eta }: { eta: number }) => {
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-blue-500">
                    <Target className="h-6 w-6" />
                </div>
                <div>
                    <p className="font-bold text-lg">{Math.round(eta)}</p>
                    <p className="text-sm font-medium text-muted-foreground">Vida Característica (η)</p>
                </div>
            </div>
            <p className="text-xs text-muted-foreground pl-1">
                Este é o tempo em que <strong className="font-semibold text-foreground">63.2%</strong> da população de componentes terá falhado. É um marco de confiabilidade crucial para planeamento.
            </p>
        </div>
    );
};

export default function WeibullParameterAnalysis({ suppliers }: WeibullParameterAnalysisProps) {
    if (suppliers.length === 0) {
        return null;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Analisador de Parâmetros Weibull (β & η)</CardTitle>
                <CardDescription>
                    Interprete os parâmetros Beta (forma) e Eta (vida) para entender o modo de falha e a vida útil dos seus componentes.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {suppliers.map(supplier => (
                        <Card key={supplier.id} className="p-4" style={{ borderLeft: `4px solid ${supplier.color}` }}>
                            <h3 className="font-bold text-foreground mb-4">{supplier.name}</h3>
                            <div className="space-y-6">
                                {supplier.params.beta != null && <BetaAnalysis beta={supplier.params.beta} />}
                                {supplier.params.eta != null && <EtaAnalysis eta={supplier.params.eta} />}
                            </div>
                        </Card>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
