'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface BathtubCurveAnalysisProps {
  failureTimes: number[];
}

interface Point {
  x: number;
  y: number;
  time: number;
}

const BathtubCurveSVG = ({ points }: { points: Point[] }) => (
  <div className="relative">
    <svg viewBox="0 0 500 200" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      {/* Grid lines */}
      {[20, 40, 60, 80, 100, 120, 140, 160, 180].map(y => (
        <line key={y} x1="0" y1={y} x2="500" y2={y} stroke="hsl(var(--border))" strokeWidth="0.5" strokeDasharray="2 2" />
      ))}

      {/* Correct "U" shaped bathtub curve path with a flat bottom and smooth transitions */}
      <path d="M 10,40 C 50,40 80,140 160,140 L 340,140 C 420,140 450,40 490,40" stroke="hsl(var(--primary))" strokeWidth="2.5" fill="none" />
      
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
      <TooltipProvider>
        {points.map((point, index) => (
          <Tooltip key={index} delayDuration={0}>
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
        ))}
      </TooltipProvider>
    </div>
  </div>
);

// This function maps a time value to a point on the predefined SVG curve
const mapTimeToPoint = (time: number, minTime: number, maxTime: number): Point => {
    if (maxTime === minTime) { // Avoid division by zero if all times are the same
        return { x: 50, y: 70, time };
    }
    const timePercentage = (time - minTime) / (maxTime - minTime);

    let x, y;
    const svgWidth = 500;
    const svgHeight = 200;

    const p0_start = {x: 10, y: 40};
    const p1_infant = {x: 50, y: 40};
    const p2_infant = {x: 80, y: 140};
    const p3_infant_end = {x: 160, y: 140};

    const p0_wearout_start = {x: 340, y: 140};
    const p1_wearout = {x: 420, y: 140};
    const p2_wearout = {x: 450, y: 40};
    const p3_end = {x: 490, y: 40};

    // Phase 1: Early Failures (0% to 32% of time axis) -> Mapped to x=[10, 160]
    if (timePercentage <= 0.32) {
        const t = timePercentage / 0.32;
        x = Math.pow(1-t, 3)*p0_start.x + 3*Math.pow(1-t, 2)*t*p1_infant.x + 3*(1-t)*Math.pow(t,2)*p2_infant.x + Math.pow(t,3)*p3_infant_end.x;
        y = Math.pow(1-t, 3)*p0_start.y + 3*Math.pow(1-t, 2)*t*p1_infant.y + 3*(1-t)*Math.pow(t,2)*p2_infant.y + Math.pow(t,3)*p3_infant_end.y;
    } 
    // Phase 2: Useful Life (32% to 68% of time axis) -> Mapped to x=[160, 340]
    else if (timePercentage <= 0.68) {
        const phasePercentage = (timePercentage - 0.32) / 0.36;
        x = 160 + phasePercentage * 180;
        y = 140; // Flat part of the curve
    } 
    // Phase 3: Wear-out (68% to 100% of time axis) -> Mapped to x=[340, 490]
    else {
        const t = (timePercentage - 0.68) / 0.32;
        x = Math.pow(1-t, 3)*p0_wearout_start.x + 3*Math.pow(1-t, 2)*t*p1_wearout.x + 3*(1-t)*Math.pow(t,2)*p2_wearout.x + Math.pow(t,3)*p3_end.x;
        y = Math.pow(1-t, 3)*p0_wearout_start.y + 3*Math.pow(1-t, 2)*t*p1_wearout.y + 3*(1-t)*Math.pow(t,2)*p2_wearout.y + Math.pow(t,3)*p3_end.y;
    }
    
    // Convert SVG coordinates to percentage for CSS positioning
    const xPercent = (x / svgWidth) * 100;
    const yPercent = (y / svgHeight) * 100;

    return { x: xPercent, y: yPercent, time };
};


export default function BathtubCurveAnalysis({ failureTimes }: BathtubCurveAnalysisProps) {
  const [points, setPoints] = useState<Point[]>([]);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (failureTimes.length > 0 && isClient) {
      const sortedTimes = [...failureTimes].sort((a, b) => a - b);
      const minTime = sortedTimes[0];
      const maxTime = sortedTimes[sortedTimes.length - 1];
      const calculatedPoints = sortedTimes.map(time => mapTimeToPoint(time, minTime, maxTime));
      setPoints(calculatedPoints);
    } else {
      setPoints([]);
    }
  }, [failureTimes, isClient]);

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
          <p className="text-muted-foreground">Adicione dados de equipamentos para ver a análise.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Análise da Curva da Banheira</CardTitle>
        <CardDescription>
          Visualize os pontos de falha ao longo do ciclo de vida do componente.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        {isClient ? <BathtubCurveSVG points={points} /> : <div className="h-[205px] w-full animate-pulse rounded-md bg-muted" />}
      </CardContent>
    </Card>
  );
}
