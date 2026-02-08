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

const PFCurveSVG = ({ health, beta, distribution, curveStyle, t }: { health: number; beta?: number | null; distribution?: Distribution | null; curveStyle: React.CSSProperties; t: (key: string, args?: any) => string }) => {
  const controlPointX = (distribution === 'Weibull' && beta && beta > 3) ? 80 : 55;
  const curvePath = `M 5,10 Q ${controlPointX},10 95,45`;

  const getYOnCurve = (xPercent: number) => {
    const t_bezier = (xPercent - 5) / 90;
    const p0_y = 10, p1_y = 10, p2_y = 45;
    return Math.pow(1 - t_bezier, 2) * p0_y + 2 * (1 - t_bezier) * t_bezier * p1_y + Math.pow(t_bezier, 2) * p2_y;
  };

  const assetX = 5 + (100 - health) * 0.9;
  const assetY = getYOnCurve(assetX);
  const healthColor = health < 20 ? 'border-red-500' : health < 50 ? 'border-yellow-500' : health < 80 ? 'border-blue-500' : 'border-green-500';
  const healthTextColor = health < 20 ? 'text-red-500' : health < 50 ? 'text-yellow-500' : health < 80 ? 'text-blue-500' : 'text-green-500';

  const pPointX = 5 + (100 - 70) * 0.9;
  const pPointY = getYOnCurve(pPointX);
  
  const fPointX = 95;
  const fPointY = 45;

  return (
    <div className="relative w-full aspect-[2/1] max-w-lg mx-auto">
      <svg viewBox="0 0 100 50" className="w-full h-auto" preserveAspectRatio="xMidYMin meet">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3" markerHeight="3" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--border))" />
          </marker>
        </defs>
        
        <line x1="5" y1="5" x2="5" y2="45" stroke="hsl(var(--border))" strokeWidth="0.5" markerEnd="url(#arrow)" />
        <line x1="5" y1="45" x2="95" y2="45" stroke="hsl(var(--border))" strokeWidth="0.5" markerEnd="url(#arrow)" />
        <text x="-2" y="25" textAnchor="middle" transform="rotate(-90 -2 25)" className="text-[4px] fill-muted-foreground">{t('assetDetail.pfCurve.condition')}</text>
        <text x="50" y="50" textAnchor="middle" className="text-[4px] fill-muted-foreground">{t('charts.time')}</text>
        <text x="3" y="10" textAnchor="end" dominantBaseline="middle" className="text-[3px] fill-muted-foreground">Normal</text>
        <text x="3" y="45" textAnchor="end" dominantBaseline="middle" className="text-[3px] fill-muted-foreground">Fallo</text>
        
        <path d={curvePath} stroke="hsl(var(--primary))" strokeWidth="1.2" fill="none" style={curveStyle} />

        <g>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <g className="cursor-pointer">
                    <circle cx={pPointX} cy={pPointY} r="1.5" fill="hsl(var(--chart-4))" />
                    <circle cx={pPointX} cy={pPointY} r="3" fill="transparent" />
                </g>
              </TooltipTrigger>
              <TooltipContent><p>{t('assetDetail.pfCurve.potentialFailure')}</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <text x={pPointX} y={pPointY - 3} textAnchor="middle" className="text-[5px] font-bold fill-chart-4">P</text>
        </g>

        <g>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                 <g className="cursor-pointer">
                    <circle cx={fPointX} cy={fPointY} r="1.5" fill="hsl(var(--destructive))" />
                    <circle cx={fPointX} cy={fPointY} r="3" fill="transparent" />
                 </g>
              </TooltipTrigger>
              <TooltipContent><p>{t('assetDetail.pfCurve.functionalFailure')}</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <text x={fPointX} y={fPointY - 3} textAnchor="middle" className="text-[5px] font-bold fill-destructive">F</text>
        </g>
      </svg>
      
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer"
              style={{ left: `${assetX}%`, top: `${assetY}%` }}
            >
              <div className={cn("w-3 h-3 rounded-full border-2 bg-background animate-pulse", healthColor)} />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className={cn(healthTextColor)}>{t('assetDetail.pfCurve.assetHealth', { health: health.toFixed(0) })}</p>
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

  const curveShapeDescription = useMemo(() => {
    if (distribution === 'Weibull' && beta) {
      if (beta > 3) {
        return t('assetDetail.pfCurve.shape.steep', { beta: beta.toFixed(2) });
      }
      return t('assetDetail.pfCurve.shape.normal', { beta: beta.toFixed(2) });
    }
    return t('assetDetail.pfCurve.shape.genericWearOut');
  }, [distribution, beta, t]);

  const curveStyle = useMemo((): React.CSSProperties => {
    switch (uncertaintyLevel) {
        case 'high': return { strokeDasharray: "3 3" };
        case 'medium': return { strokeDasharray: "6 4" };
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
        <PFCurveSVG 
            health={pdmHealth} 
            beta={beta}
            distribution={distribution}
            curveStyle={curveStyle}
            t={t} 
        />
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
