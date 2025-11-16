'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Supplier } from '@/lib/types';
import { AlertCircle, CheckCircle2, TrendingUp, TrendingDown, Target, Zap } from 'lucide-react';

interface DecisionAssistantProps {
  suppliers: Supplier[];
}

const getBetaInterpretation = (beta: number) => {
  if (beta < 1) return { text: 'Falhas infantis (taxa de falha decrescente). O produto está melhorando com o tempo.', icon: TrendingDown, color: 'text-green-500' };
  if (beta === 1) return { text: 'Falhas aleatórias (taxa de falha constante). As falhas são imprevisíveis.', icon: Zap, color: 'text-yellow-500' };
  return { text: 'Falhas por desgaste (taxa de falha crescente). O produto se degrada com o uso.', icon: TrendingUp, color: 'text-red-500' };
};

const getEtaInterpretation = (eta: number) => {
  return { text: `Aproximadamente 63.2% das unidades falharão por este tempo. Um valor maior indica maior durabilidade intrínseca.`, icon: Target, color: 'text-blue-400' };
};


export default function DecisionAssistant({ suppliers }: DecisionAssistantProps) {
  return (
    <div className="space-y-6">
       <Card>
            <CardHeader>
                <CardTitle>Assistente de Decisão</CardTitle>
                <CardDescription>
                    Interpretações e recomendações acionáveis baseadas nos gráficos e parâmetros de Weibull para otimizar a estratégia de manutenção e custos.
                </CardDescription>
            </CardHeader>
        </Card>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
       
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Análise da Curva de Confiabilidade R(t)</CardTitle>
            <CardDescription>Mede a probabilidade de um item operar sem falha por um determinado tempo.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
            <div className="space-y-2">
                <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex-shrink-0 flex items-center justify-center"><CheckCircle2 className="w-5 h-5 text-green-500"/></div>
                    <div>
                        <h4 className="font-semibold text-foreground">Zona Econômica de Operação</h4>
                        <p className="text-sm text-muted-foreground">Alta confiabilidade. A operação é segura e os custos com falhas são baixos. Idealmente, os componentes devem operar nesta zona.</p>
                    </div>
                </div>
                <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex-shrink-0 flex items-center justify-center"><AlertCircle className="w-5 h-5 text-yellow-500"/></div>
                    <div>
                        <h4 className="font-semibold text-foreground">Zona de Atenção</h4>
                        <p className="text-sm text-muted-foreground">A confiabilidade está diminuindo. O risco de falha aumenta. Comece a planejar a manutenção ou substituição.</p>
                    </div>
                </div>
                <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-500/20 flex-shrink-0 flex items-center justify-center"><Zap className="w-5 h-5 text-red-500"/></div>
                    <div>
                        <h4 className="font-semibold text-foreground">Zona de Falha Cara</h4>
                        <p className="text-sm text-muted-foreground">Baixa confiabilidade e alto risco de falha. Operar nesta zona pode resultar em custos elevados e paradas não planejadas.</p>
                    </div>
                </div>
            </div>
            <div className="p-3 rounded-lg bg-secondary">
                <h4 className="font-semibold mb-1 text-primary">Ação Recomendada:</h4>
                <p className="text-sm text-foreground">Defina um limiar de confiabilidade (ex: R(t) = 0.7) e planeje a substituição dos componentes antes que atinjam este ponto para evitar custos de falhas inesperadas.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Análise da Densidade de Probabilidade f(t)</CardTitle>
            <CardDescription>Mostra a distribuição de falhas ao longo do tempo, ou seja, quando as falhas são mais prováveis de ocorrer.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
            <div className="space-y-2">
                 <p className="text-sm text-muted-foreground">O pico da curva indica o "tempo modal", o momento com a maior probabilidade de falha.</p>
                <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
                    <li><strong className="text-foreground">Curva com pico acentuado:</strong> Falhas concentradas em um curto período. Manutenção preditiva é eficaz.</li>
                    <li><strong className="text-foreground">Curva com pico achatado:</strong> Falhas mais distribuídas ao longo do tempo. A manutenção pode ser mais difícil de planejar.</li>
                </ul>
            </div>
             <div className="p-3 rounded-lg bg-secondary">
                <h4 className="font-semibold mb-1 text-primary">Ação Recomendada:</h4>
                <p className="text-sm text-foreground">Antecipe a troca dos componentes antes que atinjam o pico da curva f(t). Isso reduz a probabilidade de falha durante a operação de pico de risco.</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="flex flex-col lg:col-span-2">
          <CardHeader>
            <CardTitle>Análise dos Parâmetros de Weibull (β e η)</CardTitle>
            <CardDescription>Beta (β) descreve o modo de falha, enquanto Eta (η) representa a vida característica do componente.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {suppliers.length > 0 ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {suppliers.map(supplier => {
                     const betaInfo = getBetaInterpretation(supplier.beta);
                     const etaInfo = getEtaInterpretation(supplier.eta);
                     return (
                         <Card key={supplier.id} className="border-2" style={{borderColor: supplier.color}}>
                            <CardHeader>
                               <CardTitle className="flex items-center gap-2 text-lg">
                                 <div className="w-3 h-3 rounded-full" style={{backgroundColor: supplier.color}}/>
                                 {supplier.name}
                               </CardTitle>
                            </CardHeader>
                           <CardContent className="space-y-3">
                              <div className="flex items-start gap-3">
                                <betaInfo.icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${betaInfo.color}`}/>
                                <div>
                                    <h5 className="font-semibold text-foreground">Beta (β) = {supplier.beta.toFixed(2)}</h5>
                                    <p className="text-xs text-muted-foreground">{betaInfo.text}</p>
                                </div>
                              </div>
                               <div className="flex items-start gap-3">
                                <etaInfo.icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${etaInfo.color}`}/>
                                <div>
                                    <h5 className="font-semibold text-foreground">Eta (η) = {supplier.eta.toFixed(0)}</h5>
                                    <p className="text-xs text-muted-foreground">{etaInfo.text}</p>
                                </div>
                              </div>
                           </CardContent>
                         </Card>
                     );
                 })}
             </div>
            ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Adicione dados de fornecedores para ver a análise dos parâmetros.</p>
            )}

            <div className="p-3 rounded-lg bg-secondary">
                <h4 className="font-semibold mb-1 text-primary">Ação Recomendada:</h4>
                <p className="text-sm text-foreground">Para maior confiabilidade, prefira fornecedores com <strong className="text-accent">maior Eta (η)</strong> (vida útil mais longa) e <strong className="text-accent">Beta (β) próximo de 1 ou maior</strong>. Um Beta muito menor que 1 indica falhas prematuras, enquanto um Beta maior que 1 sugere falhas por desgaste, que são mais previsíveis.</p>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
