'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Supplier } from '@/lib/types';
import { TrendingDown, Minus, TrendingUp } from 'lucide-react';

interface BathtubCurveAnalysisProps {
  suppliers: Supplier[];
}

const BathtubCurveSVG = () => (
  <svg viewBox="0 0 400 150" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
    {/* Paths for the curve sections */}
    <path d="M 0,40 Q 40,10 80,80" stroke="hsl(var(--muted-foreground))" strokeWidth="2" fill="none" strokeDasharray="4 4" />
    <path d="M 80,80 L 280,80" stroke="hsl(var(--muted-foreground))" strokeWidth="2" fill="none" strokeDasharray="4 4" />
    <path d="M 280,80 Q 320,150 400,60" stroke="hsl(var(--muted-foreground))" strokeWidth="2" fill="none" strokeDasharray="4 4" />

    {/* Vertical separator lines */}
    <line x1="80" y1="20" x2="80" y2="130" stroke="hsl(var(--border))" strokeWidth="1" />
    <line x1="280" y1="20" x2="280" y2="130" stroke="hsl(var(--border))" strokeWidth="1" />

    {/* Labels for phases */}
    <text x="40" y="145" textAnchor="middle" className="text-xs fill-muted-foreground font-semibold">Mortalidade Infantil</text>
    <text x="180" y="145" textAnchor="middle" className="text-xs fill-muted-foreground font-semibold">Vida Útil</text>
    <text x="340" y="145" textAnchor="middle" className="text-xs fill-muted-foreground font-semibold">Desgaste</text>

    {/* Icons for phases */}
    <g transform="translate(40, 15)">
      <TrendingDown className="w-5 h-5 text-green-500" />
    </g>
    <g transform="translate(180, 15)">
      <Minus className="w-5 h-5 text-yellow-500" />
    </g>
    <g transform="translate(340, 15)">
      <TrendingUp className="w-5 h-5 text-red-500" />
    </g>
    
    <text x="0" y="10" className="text-xs fill-muted-foreground">Taxa de Falha</text>
  </svg>
);


const getPositionForBeta = (beta: number) => {
  let x: number, y: number;
  const randomFactor = Math.random() * 30 - 15; // Jitter from -15 to +15

  if (beta < 1) {
    // Early Life: Position on the downward slope
    const normalizedBeta = Math.max(0, beta) / 1.0;
    x = 10 + normalizedBeta * 60; 
    y = 40 + (1 - normalizedBeta) * 40 + randomFactor; 
  } else if (beta > 0.95 && beta < 1.05) {
    // Useful Life: Position on the flat bottom
    x = 100 + Math.random() * 160; // Randomly spread in the middle section
    y = 85 + randomFactor;
  } else {
    // Wear-out: Position on the upward slope
    const normalizedBeta = Math.min(5, beta - 1.0) / 4.0; // Normalize up to beta=5
    x = 290 + normalizedBeta * 80;
    y = 80 - normalizedBeta * 40 + randomFactor;
  }
  return { x: Math.max(10, Math.min(390, x)), y: Math.max(20, Math.min(120, y)) };
};

export default function BathtubCurveAnalysis({ suppliers }: BathtubCurveAnalysisProps) {
  if (suppliers.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Análise da Curva da Banheira</CardTitle>
        <CardDescription>
          Posicione cada fornecedor na Curva da Banheira com base no seu Parâmetro de Forma (β) para identificar a fase do ciclo de vida.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="relative">
            <BathtubCurveSVG />
            <div className="absolute top-0 left-0 w-full h-full">
              {suppliers.map(supplier => {
                if (supplier.params.beta === undefined || supplier.params.eta === undefined) return null;
                
                const { x, y } = getPositionForBeta(supplier.params.beta);

                return (
                  <Tooltip key={supplier.id} delayDuration={0}>
                    <TooltipTrigger asChild>
                      <div
                        className="absolute w-3 h-3 rounded-full transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform hover:scale-150"
                        style={{ left: `${(x / 400) * 100}%`, top: `${(y / 150) * 100}%`, backgroundColor: supplier.color, border: '1px solid white' }}
                      />
                    </TooltipTrigger>
                    <TooltipContent className="bg-background border-border shadow-lg">
                      <p className="font-bold">{supplier.name}</p>
                      <p>β (Forma): {supplier.params.beta.toFixed(2)}</p>
                      <p>η (Vida): {Math.round(supplier.params.eta)}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
