'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ReliabilityZoneChart, FailureProbabilityZoneChart, ProbabilityDensityZoneChart, WeibullZoneChart } from '@/components/icons';

export default function DecisionAssistant() {

  const chartCards = [
    {
      title: "Confiabilidade R(t)",
      ChartComponent: ReliabilityZoneChart,
      recommendation: "Trocar quando R(t) = 0,7"
    },
    {
      title: "Probabilidade de Falha F(t)",
      ChartComponent: FailureProbabilityZoneChart,
      recommendation: "Comparar com custo de reposição"
    },
    {
      title: "Densidade de Probabilidade f(t)",
      ChartComponent: ProbabilityDensityZoneChart,
      recommendation: "Antecipar troca antes do pico"
    },
    {
      title: "Gráfico Weibull (ln-ln)",
      ChartComponent: WeibullZoneChart,
      recommendation: "Parar antes do crescimento acentuado"
    },
  ]

  return (
    <div className="space-y-6">
       <Card>
            <CardHeader>
                <CardTitle>Assistente de Decisão</CardTitle>
                <CardDescription>
                    Gráficos ilustrativos com zonas de operação para guiar a estratégia de manutenção e otimização de custos.
                </CardDescription>
            </CardHeader>
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {chartCards.map((chart, index) => (
                <Card key={index} className="flex flex-col">
                    <CardHeader>
                        <CardTitle className="text-lg">{chart.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col items-center justify-center space-y-4">
                        <div className="w-full max-w-sm">
                            <chart.ChartComponent className="w-full h-auto" />
                        </div>
                        <div className="p-3 rounded-lg bg-secondary w-full text-center">
                            <h4 className="font-semibold text-primary">{chart.recommendation}</h4>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    </div>
  );
}
