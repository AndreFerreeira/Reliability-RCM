'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Calendar, CheckCircle, Flag, Gauge, Target, TrendingUp, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const RoadmapStep = ({ title, duration, children }: { title: string, duration: string, children: React.ReactNode }) => (
    <div className="relative pl-8">
        <div className="absolute left-0 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <CheckCircle className="h-3 w-3" />
        </div>
        <div className="font-bold">{title} <span className="ml-2 text-sm font-normal text-muted-foreground">({duration})</span></div>
        <div className="text-sm text-muted-foreground">{children}</div>
    </div>
);

export default function StrategicAnalysis() {

    return (
        <Card>
            <CardHeader>
                <CardTitle>Plano de Ação Estratégico de Confiabilidade</CardTitle>
                <CardDescription>
                    Uma análise crítica dos dados de performance dos ativos e um plano de contramedidas técnicas e gerenciais.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                {/* Diagnóstico Técnico */}
                <div className="space-y-4">
                    <h3 className="text-xl font-semibold flex items-center gap-2"><Gauge className="text-primary"/> Diagnóstico Técnico Resumido</h3>
                    <p className="text-muted-foreground">
                        A performance atual dos ativos indica uma estratégia de manutenção reativa e de baixa eficácia. Os altos custos de corretiva (CM), downtime recorrente e intensidade de manutenção elevada são sintomas de problemas estruturais. A presença simultânea de falhas por mortalidade infantil e por desgaste sugere falhas sistêmicas em múltiplas frentes: desde a especificação e comissionamento de ativos até a ausência de um plano de manutenção otimizado para o fim de vida.
                    </p>
                </div>

                {/* Plano de Contramedidas */}
                <div className="space-y-4">
                     <h3 className="text-xl font-semibold flex items-center gap-2"><Target className="text-primary"/> Plano de Contramedidas</h3>
                    <Accordion type="single" collapsible defaultValue="item-1" className="w-full">
                        <AccordionItem value="item-1">
                            <AccordionTrigger>Fase 1: Contramedidas Imediatas (Curto Prazo - até 90 dias)</AccordionTrigger>
                            <AccordionContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Ação</TableHead>
                                            <TableHead>Objetivo</TableHead>
                                            <TableHead>Responsável</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow>
                                            <TableCell>Análise de Criticidade ABC dos Ativos</TableCell>
                                            <TableCell>Focar recursos nos ativos de maior impacto (Criticidade A e AA).</TableCell>
                                            <TableCell>Engenharia de Manutenção</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell>Coleta de Dados de Falha (Análise Weibull)</TableCell>
                                            <TableCell>Coletar no mínimo 5 a 10 tempos de falha para ativos críticos para iniciar a análise estatística.</TableCell>
                                            <TableCell>PCM / Manutenção</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell>Inspeções Preditivas Emergenciais</TableCell>
                                            <TableCell>Realizar inspeções (termografia, vibração) nos ativos mais críticos em fim de vida para prever falhas iminentes.</TableCell>
                                            <TableCell>Equipe de Preditiva</TableCell>
                                        </TableRow>
                                         <TableRow>
                                            <TableCell>Revisão de Planos de PM Básicos</TableCell>
                                            <TableCell>Garantir que tarefas básicas de lubrificação, limpeza e inspeção estejam sendo executadas corretamente.</TableCell>
                                            <TableCell>Supervisão de Manutenção</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-2">
                            <AccordionTrigger>Fase 2: Contramedidas Estruturais (Médio Prazo - até 6 meses)</AccordionTrigger>
                            <AccordionContent>
                                <Table>
                                     <TableHeader>
                                        <TableRow>
                                            <TableHead>Ação</TableHead>
                                            <TableHead>Objetivo</TableHead>
                                            <TableHead>Responsável</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow>
                                            <TableCell>Implementação do RCM para Ativos Críticos</TableCell>
                                            <TableCell>Definir funções, falhas funcionais, modos de falha e selecionar tarefas de manutenção proativas (PM e PdM) com base no risco.</TableCell>
                                            <TableCell>Engenharia de Confiabilidade</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell>Análise de Causa Raiz (RCA) para Falhas Repetitivas</TableCell>
                                            <TableCell>Investigar as causas fundamentais de falhas de mortalidade infantil e problemas crônicos.</TableCell>
                                            <TableCell>Grupo Multidisciplinar (Eng., Op., Manut.)</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell>Otimização de Intervalos de PM com Weibull</TableCell>
                                            <TableCell>Usar a análise Weibull para recalcular os intervalos de troca ou reforma de componentes em desgaste.</TableCell>
                                            <TableCell>Engenharia de Confiabilidade</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell>Revisão da Estratégia de Sobressalentes</TableCell>
                                            <TableCell>Garantir a disponibilidade de peças para ativos críticos e otimizar o estoque com base na previsibilidade de falhas.</TableCell>
                                            <TableCell>PCM / Almoxarifado</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-3">
                            <AccordionTrigger>Fase 3: Contramedidas Estratégicas (Longo Prazo - até 12 meses)</AccordionTrigger>
                            <AccordionContent>
                                 <Table>
                                     <TableHeader>
                                        <TableRow>
                                            <TableHead>Ação</TableHead>
                                            <TableHead>Objetivo</TableHead>
                                            <TableHead>Responsável</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow>
                                            <TableCell>Revisão de Padrões de Projeto e Especificação</TableCell>
                                            <TableCell>Incorporar lições aprendidas (RCA) para evitar a reincidência de falhas de projeto em novas aquisições.</TableCell>
                                            <TableCell>Engenharia de Projetos</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell>Desenvolvimento de Indicadores de Confiabilidade</TableCell>
                                            <TableCell>Implementar e monitorar MTBF, MTTR, Disponibilidade e Custo por Ativo para medir a eficácia das ações.</TableCell>
                                            <TableCell>Gestão de Manutenção / PCM</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell>Programa de Treinamento Contínuo</TableCell>
                                            <TableCell>Capacitar operadores e mantenedores em técnicas de inspeção, identificação de falhas e melhores práticas.</TableCell>
                                            <TableCell>RH / Gestão de Manutenção</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell>Avaliação de Viabilidade Técnica e Econômica (LCC)</TableCell>
                                            <TableCell>Institucionalizar a análise de Custo do Ciclo de Vida para decisões de substituição versus reforma de grandes ativos.</TableCell>
                                            <TableCell>Engenharia de Confiabilidade / Financeiro</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>

                 {/* Roadmap */}
                <div className="space-y-6">
                    <h3 className="text-xl font-semibold flex items-center gap-2"><Flag className="text-primary"/> Roadmap de Implementação</h3>
                    <div className="relative flex flex-col gap-8 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                        <RoadmapStep title="Contenção e Análise Inicial" duration="90 Dias">
                            Foco em estabilizar a operação, priorizar os piores problemas através da análise de criticidade e coletar dados de qualidade para análises futuras.
                        </RoadmapStep>
                        <RoadmapStep title="Estruturação e Otimização" duration="6 Meses">
                            Implementar RCM e RCA para os ativos mais críticos. Usar a análise Weibull para otimizar os primeiros planos de manutenção e ajustar a estratégia de sobressalentes.
                        </RoadmapStep>
                        <RoadmapStep title="Sustentação e Melhoria Contínua" duration="12 Meses">
                            Consolidar os processos de confiabilidade, revisar padrões de projeto, treinar equipes e usar indicadores para direcionar o ciclo de melhoria contínua (PDCA).
                        </RoadmapStep>
                    </div>
                </div>

                {/* Riscos */}
                <div className="space-y-4">
                     <h3 className="text-xl font-semibold flex items-center gap-2"><Zap className="text-primary"/> Principais Riscos de Não Agir</h3>
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Riscos Iminentes</AlertTitle>
                        <AlertDescription>
                            <ul className="list-disc pl-5 mt-2 space-y-1">
                                <li>**Perda de Produção:** Continuidade de paradas não programadas, impactando diretamente a receita.</li>
                                <li>**Aumento de Custos:** Custos de manutenção corretiva continuarão a crescer exponencialmente, especialmente com ativos em fim de vida.</li>
                                <li>**Riscos de Segurança e Meio Ambiente:** Falhas catastróficas em ativos críticos podem levar a acidentes graves.</li>
                                <li>**Perda de Competitividade:** A baixa confiabilidade e os altos custos operacionais minam a capacidade da empresa de competir no mercado.</li>
                            </ul>
                        </AlertDescription>
                    </Alert>
                </div>
            </CardContent>
        </Card>
    );
}
