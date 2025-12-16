'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Supplier } from '@/lib/types';
import { Target, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import React from 'react';
import { useI18n } from '@/i18n/i18n-provider';

interface WeibullParameterAnalysisProps {
    suppliers: Supplier[];
}

const BetaAnalysis = ({ beta, t }: { beta: number, t: (key: string) => string }) => {
    let interpretation, Icon, colorClass, phase;

    if (beta < 1) {
        interpretation = t('weibullAnalysis.beta.infantMortality.interpretation');
        Icon = TrendingDown;
        colorClass = "text-green-500";
        phase = t('weibullAnalysis.beta.infantMortality.phase');
    } else if (beta > 0.95 && beta < 1.05) {
        interpretation = t('weibullAnalysis.beta.usefulLife.interpretation');
        Icon = Minus;
        colorClass = "text-yellow-500";
        phase = t('weibullAnalysis.beta.usefulLife.phase');
    } else { // beta > 1
        interpretation = t('weibullAnalysis.beta.wearOut.interpretation');
        Icon = TrendingUp;
        colorClass = "text-red-500";
        phase = t('weibullAnalysis.beta.wearOut.phase');
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-muted ${colorClass}`}>
                    <Icon className="h-6 w-6" />
                </div>
                <div>
                    <p className="font-bold text-lg">{beta.toFixed(2)}</p>
                    <p className="text-sm font-medium text-muted-foreground">{t('parameters.beta')}</p>
                </div>
            </div>
            <p className="text-xs text-muted-foreground pl-1">
                <strong className={`font-semibold ${colorClass}`}>{phase}:</strong> {interpretation}
            </p>
        </div>
    );
};

const EtaAnalysis = ({ eta, t }: { eta: number, t: (key: string) => string }) => {
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-blue-500">
                    <Target className="h-6 w-6" />
                </div>
                <div>
                    <p className="font-bold text-lg">{Math.round(eta)}</p>
                    <p className="text-sm font-medium text-muted-foreground">{t('parameters.eta')}</p>
                </div>
            </div>
            <p className="text-xs text-muted-foreground pl-1">
                {t('weibullAnalysis.eta.description')}
            </p>
        </div>
    );
};

export default function WeibullParameterAnalysis({ suppliers }: WeibullParameterAnalysisProps) {
    const { t } = useI18n();

    if (suppliers.length === 0) {
        return null;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('weibullAnalysis.cardTitle')}</CardTitle>
                <CardDescription>
                    {t('weibullAnalysis.cardDescription')}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {suppliers.map(supplier => (
                        <Card key={supplier.id} className="p-4" style={{ borderLeft: `4px solid ${supplier.color}` }}>
                            <h3 className="font-bold text-foreground mb-4">{supplier.name}</h3>
                            <div className="space-y-6">
                                {supplier.params.beta != null && <BetaAnalysis beta={supplier.params.beta} t={t} />}
                                {supplier.params.eta != null && <EtaAnalysis eta={supplier.params.eta} t={t} />}
                            </div>
                        </Card>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
