'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useI18n } from '@/i18n/i18n-provider';
import { cn } from '@/lib/utils';
import { ShieldAlert, ShieldCheck, ShieldHalf, ShieldX, HelpCircle, Sigma } from 'lucide-react';
import type { Distribution } from '@/lib/types';

interface PFCurveChartProps {
  pdmHealth?: number | null;
  distribution?: Distribution | null;
  beta?: number | null;
  rho?: number | null;
  failureTimesCount?: number | null;
}

const PFCurveSVG = ({ health, curvePath, curveStyle, t }: { health: number; curvePath: string; curveStyle: React.CSSProperties; t: (key: string, args?: any) => string }) => {
  // Map health (100 -> 0) to x-coordinate (5% -> 95%)
  const xPosition = 5 + (100 - health) * 0.9;
  
  const normalizedX = (xPosition - 5) / 90;
  
  let yPosition;
  if(health > 98) {
      yPosition = 10;
  } else if (health < 2) {
      yPosition = 45;
  } else {
     const t = normalizedX;
     const p0 = {x: 5, y: 10};
     const p1 = {x: 55, y: 10};
     const p2 = {x: 95, y: 45};
     yPosition = Math.pow(1 - t, 2) * p0.y + 2 * (1 - t) * t * p1.y + Math.pow(t, 2) * p2.y;
  }


  const healthColor = health < 20 ? 'border-red-500' : health < 50 ? 'border-yellow-500' : health < 80 ? 'border-blue-500' : 'border-green-500';

  return (
    <div className="relative w-full aspect-[2/1] max-w-lg mx-auto">
      <svg viewBox="0 0 100 50" className="w-full h-auto" preserveAspectRatio="xMidYMin meet">
        {/* Grid and Axis */}
        <line x1="5" y1="5" x2="5" y2="45" stroke="hsl(var(--border))" strokeWidth="0.5" />
        <line x1="5" y1="45" x2="95" y2="45" stroke="hsl(var(--border))" strokeWidth="0.5" />
        <text x="0" y="25" textAnchor="middle" transform="rotate(-90 0 25)" className="text-[4px] fill-muted-foreground">{t('assetDetail.pfCurve.condition')}</text>
        <text x="50" y="50" textAnchor="middle" className="text-[4px] fill-muted-foreground">{t('charts.time')}</text>

        {/* P-F Curve path */}
        <path d={curvePath} stroke="hsl(var(--primary))" strokeWidth="1" fill="none" style={curveStyle} />

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
              <div className={cn("w-3 h-3 rounded-full border-2 bg-background animate-pulse", healthColor)} />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className={cn(health < 20 ? 'text-red-500' : health < 50 ? 'text-yellow-500' : health < 80 ? 'text-blue-500' : 'text-green-500')}>{t('assetDetail.pfCurve.assetHealth', { health })}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};


const InterpretationSection = ({ health, t }: { 
    health: number, 
    t: (key: string, args?: any) => string 
}) => {
  let statusTitleKey: string, statusDescriptionKey: string, StatusIcon: React.ElementType, statusColorClass: string;

  if (health >= 80) {
    statusTitleKey = 'assetDetail.pfCurve.status.excellent';
    statusDescriptionKey = 'assetDetail.pfCurve.interpretation.excellent';
    StatusIcon = ShieldCheck;
    statusColorClass = "text-green-500";
  } else if (health >= 50) {
    statusTitleKey = 'assetDetail.pfCurve.status.good';
    statusDescriptionKey = 'assetDetail.pfCurve.interpretation.good';
    StatusIcon = ShieldHalf;
    statusColorClass = "text-blue-500";
  } else if (health >= 20) {
    statusTitleKey = 'assetDetail.pfCurve.status.alert';
    statusDescriptionKey = 'assetDetail.pfCurve.interpretation.alert';
    StatusIcon = ShieldAlert;
    statusColorClass = "text-yellow-500";
  } else {
    statusTitleKey = 'assetDetail.pfCurve.status.critical';
    statusDescriptionKey = 'assetDetail.pfCurve.interpretation.critical';
    StatusIcon = ShieldX;
    statusColorClass = "text-red-500";
  }
  
  return (
        <Card className="bg-muted/30">
            <CardHeader>
                <div className="flex items-center gap-3">
                    <StatusIcon className={cn("h-6 w-6", statusColorClass)} />
                    <CardTitle className={cn("text-lg", statusColorClass)}>{t(statusTitleKey)}</CardTitle>
                </div>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground">{t(statusDescriptionKey)}</p>
            </CardContent>
        </Card>
  )
}

const ModelInfoSection = ({ uncertaintyLevel, uncertaintyDescription, curveShapeDescription, t }: { 
    uncertaintyLevel: 'high' | 'medium' | 'low',
    uncertaintyDescription: string,
    curveShapeDescription: string,
    t: (key: string, args?: any) => string 
}) => {
   const uncertaintyColors = {
      high: 'text-red-500',
      medium: 'text-yellow-500',
      low: 'text-green-500',
  }

  return (
    <div className="space-y-4">
        <Card className="bg-muted/30">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <HelpCircle className={cn("h-6 w-6", uncertaintyColors[uncertaintyLevel])} />
                <CardTitle className="text-lg">{t('assetDetail.pfCurve.uncertainty')}: <span className={cn(uncertaintyColors[uncertaintyLevel])}>{t(`assetDetail.pfCurve.uncertaintyLevel.${uncertaintyLevel}`)}</span></CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground">{uncertaintyDescription}</p>
            </CardContent>
        </Card>
        <Card className="bg-muted/30">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <Sigma className="h-6 w-6 text-primary" />
                <CardTitle className="text-lg">{t('assetDetail.pfCurve.shape.title')}</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground">{curveShapeDescription}</p>
            </CardContent>
        </Card>
    </div>
  )
}

export default function PFCurveChart({ pdmHealth, distribution, beta, rho, failureTimesCount }: PFCurveChartProps) {
  const { t } = useI18n();

  const uncertaintyLevel = useMemo(() => {
    if (!failureTimesCount || !rho) return 'high';
    if (failureTimesCount < 5 || rho < 0.85) return 'high';
    if (failureTimesCount < 10 || rho < 0.95) return 'medium';
    return 'low';
  }, [failureTimesCount, rho]);

  const uncertaintyDescription = useMemo(() => {
      const count = failureTimesCount || 0;
      const r2 = (rho || 0).toFixed(2);
      return t(`assetDetail.pfCurve.uncertaintyDescription.${uncertaintyLevel}`, { count: count, rho: r2 });
  }, [uncertaintyLevel, failureTimesCount, rho, t]);

  const isWearOutDistribution = useMemo(() => {
    if (!distribution) return false;
    if (distribution === 'Normal' || distribution === 'Lognormal') return true;
    if (distribution === 'Weibull' && beta && beta > 1.1) return true;
    return false;
  }, [distribution, beta]);

  const { curvePath, curveShapeDescription } = useMemo(() => {
    if (distribution === 'Weibull' && beta) {
      if (beta > 3) {
        return {
          curvePath: 'M 5,10 Q 80,10 95,45',
          curveShapeDescription: t('assetDetail.pfCurve.shape.steep', { beta: beta.toFixed(2) }),
        };
      }
      return {
        curvePath: 'M 5,10 Q 55,10 95,45',
        curveShapeDescription: t('assetDetail.pfCurve.shape.normal', { beta: beta.toFixed(2) }),
      };
    }
    // For Normal or Lognormal
    return {
      curvePath: 'M 5,10 Q 55,10 95,45', // Standard wear-out curve
      curveShapeDescription: t('assetDetail.pfCurve.shape.genericWearOut'),
    };
  }, [distribution, beta, t]);

  const curveStyle = useMemo((): React.CSSProperties => {
    switch (uncertaintyLevel) {
        case 'high': return { strokeDasharray: "2 3" };
        case 'medium': return { strokeDasharray: "5 5" };
        case 'low': return {};
        default: return {};
    }
  }, [uncertaintyLevel]);

  if (pdmHealth === undefined || pdmHealth === null || !isWearOutDistribution) {
      return (
          <Card>
              <CardHeader>
                  <CardTitle>{t('assetDetail.pfCurve.cardTitle')}</CardTitle>
                  <CardDescription>{t('assetDetail.pfCurve.cardDescription')}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center h-48">
                  <p className="text-muted-foreground text-center px-4">
                      {pdmHealth === null || pdmHealth === undefined 
                          ? t('assetDetail.dynamicHealth.noData') 
                          : t('assetDetail.pfCurve.notApplicable')}
                  </p>
              </CardContent>
          </Card>
      );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('assetDetail.pfCurve.cardTitle')}</CardTitle>
        <CardDescription>{t('assetDetail.pfCurve.cardDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <PFCurveSVG health={pdmHealth} curvePath={curvePath} curveStyle={curveStyle} t={t} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InterpretationSection health={pdmHealth} t={t} />
            <ModelInfoSection
              uncertaintyLevel={uncertaintyLevel}
              uncertaintyDescription={uncertaintyDescription}
              curveShapeDescription={curveShapeDescription}
              t={t}
            />
        </div>
      </CardContent>
    </Card>
  );
}
