'use client';

import type { Supplier, ReliabilityData, ChartDataPoint, WeibullParams } from '@/lib/types';

function getUniqueSortedTimes(suppliers: Supplier[]): number[] {
  const allTimes = new Set<number>();
  suppliers.forEach(s => s.failureTimes.forEach(t => allTimes.add(t)));
  return Array.from(allTimes).sort((a, b) => a - b);
}

// Estimates Weibull parameters using linear regression on a Weibull plot
export function estimateWeibullParameters(failureTimes: number[]): WeibullParams {
    if (failureTimes.length < 2) {
      return { beta: 0, eta: 0 };
    }
  
    const sortedTimes = [...failureTimes].sort((a, b) => a - b);
    const n = sortedTimes.length;
  
    // Using median rank for plotting positions
    const medianRanks = sortedTimes.map((_, i) => (i + 1 - 0.3) / (n + 0.4));
    
    const weibullPlotPoints = medianRanks.map((mr, i) => {
      if (mr >= 1) return null; // Avoid log(0)
      return {
        x: Math.log(sortedTimes[i]),
        y: Math.log(Math.log(1 / (1 - mr))),
      };
    }).filter(p => p !== null) as {x:number, y:number}[];
  
    if(weibullPlotPoints.length < 2) {
        return { beta: 0, eta: 0 };
    }

    // Linear regression (y = beta*x - beta*log(eta))
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    const numPoints = weibullPlotPoints.length;
  
    for (const p of weibullPlotPoints) {
      sumX += p.x;
      sumY += p.y;
      sumXY += p.x * p.y;
      sumXX += p.x * p.x;
    }
  
    const beta = (numPoints * sumXY - sumX * sumY) / (numPoints * sumXX - sumX * sumX);
    const intercept = (sumY - beta * sumX) / numPoints;
  
    const eta = Math.exp(-intercept / beta);
  
    return { beta, eta };
}


export function calculateReliabilityData(suppliers: Supplier[]): ReliabilityData {
  if (suppliers.length === 0) {
    return { Rt: [], Ft: [], ft: [], lambda_t: [] };
  }

  const maxTime = Math.max(...suppliers.flatMap(s => s.failureTimes)) * 1.2;
  const timePoints = Array.from({ length: 101 }, (_, i) => (i / 100) * maxTime);

  const dataBySupplier: Record<string, {
    Rt: { time: number; value: number }[],
    Ft: { time: number; value: number }[],
    ft: { time: number; value: number }[],
    lambda_t: { time: number; value: number }[]
  }> = {};

  suppliers.forEach(supplier => {
    if (!supplier.beta || !supplier.eta || supplier.eta === 0) {
        dataBySupplier[supplier.name] = { Rt: [], Ft: [], ft: [], lambda_t: [] };
        return;
    }
    const { beta, eta } = supplier;

    const Rt: { time: number; value: number }[] = [];
    const Ft: { time: number; value: number }[] = [];
    const ft: { time: number; value: number }[] = [];
    const lambda_t: { time: number; value: number }[] = [];

    for (const t of timePoints) {
        if (t === 0 && beta < 1) continue;

        const tOverEta = t / eta;
        const tOverEtaPowBeta = Math.pow(tOverEta, beta);

        const R_t_val = Math.exp(-tOverEtaPowBeta);
        Rt.push({ time: t, value: R_t_val });
        Ft.push({ time: t, value: 1 - R_t_val });

        if (t > 0) {
            const f_t_val = (beta / eta) * Math.pow(tOverEta, beta - 1) * Math.exp(-tOverEtaPowBeta);
            ft.push({ time: t, value: f_t_val });

            const lambda_t_val = (beta / eta) * Math.pow(tOverEta, beta - 1);
            lambda_t.push({ time: t, value: lambda_t_val });
        }
    }
    dataBySupplier[supplier.name] = { Rt, Ft, ft, lambda_t };
  });

  const transformToChartData = (
    dataType: 'Rt' | 'Ft' | 'ft' | 'lambda_t',
    defaultValue: number
  ) : ChartDataPoint[] => {
    
    return timePoints.map(time => {
      const dataPoint: ChartDataPoint = { time };
      suppliers.forEach(supplier => {
        const sData = dataBySupplier[supplier.name]?.[dataType];
        const point = sData?.find(p => p.time === time);
        dataPoint[supplier.name] = point ? point.value : (time === 0 ? defaultValue : 0);
      });
      return dataPoint;
    });
  }

  return { 
    Rt: transformToChartData('Rt', 1),
    Ft: transformToChartData('Ft', 0),
    ft: transformToChartData('ft', 0),
    lambda_t: transformToChartData('lambda_t', 0)
  };
}