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
      {[20, 40, 60, 80, 100, 120, 140, 160, 180].map(y => (
        <line key={y} x1="0" y1={y} x2="500" y2={y} stroke="hsl(var(--border))" strokeWidth="0.5" strokeDasharray="2 2" />
      ))}

      {/* Correct "U" shaped bathtub curve path with a flat bottom */}
      <path d="M 10,40 Q 80,180 160,140 L 340,140 Q 420,180 490,20" stroke="hsl(var(--primary))" strokeWidth="2.5" fill="none" />
      
      {/* Phase separators */}
      <line x1="160" y1="10" x2="160" y2="190" stroke="hsl(var(--border))" strokeWidth="1" strokeDasharray="4 4" />
      <line x1="340" y1="10" x2="340" y2="190" stroke="hsl(var(--border))" strokeWidth="1" strokeDasharray="4 4" />

      {/* Phase Labels */}
      <text x="80" y="175" textAnchor="middle" className="text-xs font-semibold fill-muted-foreground">Mortalidade Infantil</text>
      <text x="250" y="175" textAnchor="middle" className="text-xs font-semibold fill-muted-foreground">Vida Útil</text>
      <text x="420" y="175" textAnchor="middle" className="text-xs font-semibold fill-muted-foreground">Desgaste</text>

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
                  <div className="w-2.5 h-2.5 bg-accent rounded-full cursor-pointer transform -translate-x-1/2 -translate-y-1/2" />
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
    if (maxTime === minTime) { // Avoid division by zero if all times are the same
        return { x: 50, y: 70, time };
    }
    const timePercentage = (time - minTime) / (maxTime - minTime);

    let x, y;
    const svgWidth = 500;
    const svgHeight = 200;

    // Phase 1: Early Failures (0% to 32% of time axis) -> Mapped to x=[10, 160]
    if (timePercentage <= 0.32) {
        const phasePercentage = timePercentage / 0.32;
        x = 10 + phasePercentage * 150;
        // Bezier curve: P0=(10,40), P1=(80,180), P2=(160,140)
        const t = phasePercentage;
        y = Math.pow(1-t, 2)*40 + 2*(1-t)*t*180 + Math.pow(t, 2)*140;
    } 
    // Phase 2: Useful Life (32% to 68% of time axis) -> Mapped to x=[160, 340]
    else if (timePercentage <= 0.68) {
        const phasePercentage = (timePercentage - 0.32) / 0.36;
        x = 160 + phasePercentage * 180;
        y = 140; // Flat part of the curve
    } 
    // Phase 3: Wear-out (68% to 100% of time axis) -> Mapped to x=[340, 490]
    else {
        const phasePercentage = (timePercentage - 0.68) / 0.32;
        x = 340 + phasePercentage * 150;
         // Bezier curve: P0=(340,140), P1=(420,180), P2=(490,20)
        const t = phasePercentage;
        y = Math.pow(1-t, 2)*140 + 2*(1-t)*t*180 + Math.pow(t, 2)*20;
    }
    
    // Convert SVG coordinates to percentage for CSS positioning
    const xPercent = (x / svgWidth) * 100;
    const yPercent = (y / svgHeight) * 100;

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
      <CardContent className="px-2 sm:px-6">
        <BathtubCurveSVG points={points} />
      </CardContent>
    </Card>
  );
}
