'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useI18n } from '@/i18n/i18n-provider';
import { cn } from '@/lib/utils';
import { Lightbulb } from 'lucide-react';

interface PFCurveChartProps {
  pdmHealth: number; // Health score from 0 to 100
}

const PFCurveSVG = ({ health, t }: { health: number; t: (key: string, args?: any) => string }) => {
  // Map health (100 -> 0) to x-coordinate (5% -> 95%)
  const xPosition = 5 + (100 - health) * 0.9;
  
  // Calculate y-position on the curve. This is a simple quadratic curve for visualization.
  // Equation: y = a*(x-h)^2 + k. Let's map x from 0 to 1.
  const normalizedX = (xPosition - 5) / 90;
  const yPosition = 10 + Math.pow(normalizedX, 2) * 75;

  const healthColor = health < 30 ? 'text-red-500' : health < 70 ? 'text-yellow-500' : 'text-green-500';

  return (
    <div className="relative w-full aspect-[2/1] max-w-lg mx-auto">
      <svg viewBox="0 0 100 50" className="w-full h-auto" preserveAspectRatio="xMidYMin meet">
        {/* Grid and Axis */}
        <line x1="5" y1="5" x2="5" y2="45" stroke="hsl(var(--border))" strokeWidth="0.5" />
        <line x1="5" y1="45" x2="95" y2="45" stroke="hsl(var(--border))" strokeWidth="0.5" />
        <text x="0" y="25" textAnchor="middle" transform="rotate(-90 0 25)" className="text-[4px] fill-muted-foreground">{t('assetDetail.pfCurve.condition')}</text>
        <text x="50" y="50" textAnchor="middle" className="text-[4px] fill-muted-foreground">{t('charts.time')}</text>

        {/* P-F Curve path */}
        <path d="M 5,10 Q 50,10 95,45" stroke="hsl(var(--primary))" strokeWidth="1" fill="none" strokeDasharray="2 2" />

        {/* P and F points */}
        <circle cx="35" cy={10 + Math.pow((30 / 90), 2) * 75} r="1.5" fill="hsl(var(--chart-4))" />
        <text x="35" y={10 + Math.pow((30 / 90), 2) * 75 - 3} textAnchor="middle" className="text-[5px] font-bold fill-chart-4">P</text>
        <TooltipProvider>
           <Tooltip>
             <TooltipTrigger asChild>
                <circle cx="35" cy={10 + Math.pow((30 / 90), 2) * 75} r="3" fill="transparent" />
             </TooltipTrigger>
             <TooltipContent>
               <p>{t('assetDetail.pfCurve.potentialFailure')}</p>
             </TooltipContent>
           </Tooltip>
        </TooltipProvider>

        <circle cx="95" cy="45" r="1.5" fill="hsl(var(--destructive))" />
        <text x="95" y="42" textAnchor="middle" className="text-[5px] font-bold fill-destructive">F</text>
        <TooltipProvider>
           <Tooltip>
             <TooltipTrigger asChild>
                <circle cx="95" cy="45" r="3" fill="transparent" />
             </TooltipTrigger>
             <TooltipContent>
               <p>{t('assetDetail.pfCurve.functionalFailure')}</p>
             </TooltipContent>
           </Tooltip>
        </TooltipProvider>
      </svg>
      
      {/* Asset Position Marker */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="absolute transform -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${xPosition}%`, top: `${yPosition}%` }}
            >
              <div className={cn("w-3 h-3 rounded-full border-2 bg-background animate-pulse", 
                health < 30 ? 'border-red-500' : health < 70 ? 'border-yellow-500' : 'border-green-500'
              )} />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className={healthColor}>{t('assetDetail.pfCurve.assetHealth', { health: health })}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

export default function PFCurveChart({ pdmHealth }: PFCurveChartProps) {
  const { t } = useI18n();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('assetDetail.pfCurve.cardTitle')}</CardTitle>
        <CardDescription>{t('assetDetail.pfCurve.cardDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <PFCurveSVG health={pdmHealth} t={t} />
        <Card className="bg-muted/30">
          <CardHeader className="flex flex-row items-start gap-4 space-y-0">
             <Lightbulb className="h-5 w-5 text-yellow-500 mt-1" />
             <div>
                <CardTitle className="text-base">{t('assetDetail.pfCurve.interpretationTitle')}</CardTitle>
             </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
             <ul className="list-disc pl-5 space-y-2">
                <li>{t('assetDetail.pfCurve.interpretation1')}</li>
                <li>{t('assetDetail.pfCurve.interpretation2')}</li>
                <li>{t('assetDetail.pfCurve.interpretation3')}</li>
            </ul>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}