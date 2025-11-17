'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface BathtubCurveAnalysisProps {
  failureTimes: number[];
}

const BathtubCurveSVG = ({ points }: { points: {x: number, y: number, time: number}[] }) => (
  <div className="relative">
    <svg viewBox="0 0 500 200" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      {/* Grid lines */}
      {[20, 40, 60, 80, 100, 120, 140].map(y => (
        <line key={y} x1="0" y1={y} x2="500" y2={y} stroke="hsl(var(--border))" strokeWidth="0.5" strokeDasharray="4 4" />
      ))}

      {/* Main bathtub curve */}
      <path d="M 10,80 Q 70,10 150,50 T 350,150 Q 450,20 490,120" stroke="hsl(var(--primary))" strokeWidth="2.5" fill="none" />
      
      {/* Phase separators */}
      <line x1="160" y1="10" x2="160" y2="190" stroke="hsl(var(--border))" strokeWidth="1" />
      <line x1="340" y1="10" x2="340" y2="190" stroke="hsl(var(--border))" strokeWidth="1" />

      {/* Phase Labels */}
      <text x="80" y="25" textAnchor="middle" className="text-sm font-semibold fill-muted-foreground">Fase 1</text>
      <text x="250" y="25" textAnchor="middle" className="text-sm font-semibold fill-muted-foreground">Fase 2</text>
      <text x="420" y="25" textAnchor="middle" className="text-sm font-semibold fill-muted-foreground">Fase 3</text>

      {/* Phase description boxes */}
      <rect x="30" y="100" width="100" height="30" rx="15" fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth="1.5" />
      <text x="80" y="120" textAnchor="middle" className="text-xs font-bold fill-primary">FALHAS INICIAIS</text>
      
      <rect x="200" y="160" width="100" height="30" rx="15" fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth="1.5" />
      <text x="250" y="180" textAnchor="middle" className="text-xs font-bold fill-primary">VIDA ÚTIL</text>

      <rect x="370" y="60" width="100" height="30" rx="15" fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth="1.5" />
      <text x="420" y="80" textAnchor="middle" className="text-xs font-bold fill-primary">DESGASTE</text>
      
      {/* Axis Labels */}
      <text x="-15" y="100" transform="rotate(-90 -15,100)" textAnchor="middle" className="text-xs font-semibold fill-foreground">Taxa de falhas</text>
      <text x="250" y="198" textAnchor="middle" className="text-xs font-semibold fill-foreground">Tempo</text>
    </svg>

    <div className="absolute top-0 left-0 w-full h-full">
      {points.map((point, index) => (
        <TooltipProvider key={index}>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div 
                className="absolute"
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
              >
                  <div className="w-2.5 h-2.5 bg-primary rounded-full cursor-pointer transform -translate-x-1/2 -translate-y-1/2" />
                  <span className="absolute text-xs font-medium text-foreground transform -translate-x-1/2 -translate-y-full top-[-4px] left-1/2">{Math.round(point.time)}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Tempo de Falha: {point.time}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  </div>
);

// This function maps a time value to a point on the predefined SVG curve
const mapTimeToPoint = (time: number, minTime: number, maxTime: number): { x: number; y: number; time: number } => {
    const timePercentage = (time - minTime) / (maxTime - minTime);

    let x, y;

    // Phase 1: Early Failures (0% to 32% of time axis)
    if (timePercentage <= 0.32) {
        const phasePercentage = timePercentage / 0.32;
        x = 10 + phasePercentage * 140; // X from 10 to 150
        y = 80 - 30 * Math.cos(phasePercentage * Math.PI / 2); // Y decreases
    } 
    // Phase 2: Useful Life (32% to 68% of time axis)
    else if (timePercentage <= 0.68) {
        const phasePercentage = (timePercentage - 0.32) / 0.36;
        x = 150 + phasePercentage * 200; // X from 150 to 350
        y = 50 + 100 * Math.sin(phasePercentage * Math.PI); // Y is at the bottom part of the curve
    } 
    // Phase 3: Wear-out (68% to 100% of time axis)
    else {
        const phasePercentage = (timePercentage - 0.68) / 0.32;
        x = 350 + phasePercentage * 140; // X from 350 to 490
        y = 150 - 130 * Math.sin(phasePercentage * Math.PI / 2); // Y increases
    }
    
    // Convert SVG coordinates to percentage for CSS positioning
    const xPercent = (x / 500) * 100;
    const yPercent = (y / 200) * 100;

    return { x: xPercent, y: yPercent, time };
};


export default function BathtubCurveAnalysis({ failureTimes }: BathtubCurveAnalysisProps) {
  if (failureTimes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Análise da Curva da Banheira</CardTitle>
          <CardDescription>
            Visualize os pontos de falha ao longo do ciclo de vida do componente.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48">
          <p className="text-muted-foreground">Adicione dados de fornecedores para ver a análise.</p>
        </CardContent>
      </Card>
    );
  }

  const sortedTimes = [...failureTimes].sort((a, b) => a - b);
  const minTime = sortedTimes[0];
  const maxTime = sortedTimes[sortedTimes.length - 1];

  const points = sortedTimes.map(time => mapTimeToPoint(time, minTime, maxTime));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Análise da Curva da Banheira</CardTitle>
        <CardDescription>
          Visualize os pontos de falha ao longo do ciclo de vida do componente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <BathtubCurveSVG points={points} />
      </CardContent>
    </Card>
  );
}
