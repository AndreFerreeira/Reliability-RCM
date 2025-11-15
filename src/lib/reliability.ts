'use client';

import type { Supplier, ReliabilityData, ChartDataPoint } from '@/lib/types';

function getUniqueSortedTimes(suppliers: Supplier[]): number[] {
  const allTimes = new Set<number>();
  suppliers.forEach(s => s.failureTimes.forEach(t => allTimes.add(t)));
  return Array.from(allTimes).sort((a, b) => a - b);
}

export function calculateReliabilityData(suppliers: Supplier[]): ReliabilityData {
  if (suppliers.length === 0) {
    return { Rt: [], Ft: [], ft: [], lambda_t: [] };
  }

  const allUniqueTimes = getUniqueSortedTimes(suppliers);
  const maxTime = allUniqueTimes.length > 0 ? allUniqueTimes[allUniqueTimes.length-1] * 1.1 : 1000;

  const dataBySupplier: Record<string, {
    Rt: { time: number; value: number }[],
    Ft: { time: number; value: number }[],
    ft: { time: number; value: number }[],
    lambda_t: { time: number; value: number }[]
  }> = {};

  suppliers.forEach(supplier => {
    const initialPopulation = supplier.failureTimes.length;
    if (initialPopulation === 0) {
        dataBySupplier[supplier.name] = { Rt: [{time: 0, value: 1}], Ft: [{time: 0, value: 0}], ft: [], lambda_t: [] };
        return;
    };

    const sortedFailures = [...supplier.failureTimes].sort((a, b) => a - b);
    
    const failureCounts = sortedFailures.reduce((acc, time) => {
      acc[time] = (acc[time] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    
    const uniqueFailureTimes = Object.keys(failureCounts).map(Number).sort((a, b) => a - b);
    
    let R_t_val = 1.0;
    let atRisk = initialPopulation;
    const Rt_points: { time: number; value: number }[] = [{ time: 0, value: 1.0 }];

    for (const time of uniqueFailureTimes) {
      if (atRisk > 0) {
        const failures = failureCounts[time];
        R_t_val = R_t_val * ((atRisk - failures) / atRisk);
        atRisk -= failures;
        Rt_points.push({ time, value: R_t_val });
      }
    }
    
    const rtStep: { time: number; value: number }[] = [{ time: 0, value: 1.0 }];
    for (let i = 1; i < Rt_points.length; i++) {
        rtStep.push({ time: Rt_points[i].time, value: Rt_points[i-1].value });
        rtStep.push({ time: Rt_points[i].time, value: Rt_points[i].value });
    }
    if(rtStep.length > 1) {
      rtStep.push({ time: maxTime, value: rtStep[rtStep.length - 1].value });
    }
    
    const Ft_points = rtStep.map(p => ({ time: p.time, value: 1 - p.value }));

    const ft_points: { time: number; value: number }[] = [];
    for (let i = 1; i < Rt_points.length; i++) {
      const prev = Rt_points[i-1];
      const curr = Rt_points[i];
      const timeDiff = curr.time - prev.time;
      if (timeDiff > 0) {
        const reliabilityDiff = prev.value - curr.value;
        ft_points.push({ time: curr.time, value: reliabilityDiff / timeDiff });
      }
    }

    const lambda_t_points: { time: number; value: number }[] = [];
    for (const ft_point of ft_points) {
      const rt_point_index = Rt_points.findIndex(p => p.time >= ft_point.time);
      const rt_point = Rt_points[Math.max(0, rt_point_index -1)];
      if (rt_point && rt_point.value > 0.00001) {
        lambda_t_points.push({ time: ft_point.time, value: ft_point.value / rt_point.value });
      } else if (ft_point.value > 0) {
        lambda_t_points.push({ time: ft_point.time, value: Infinity });
      }
    }
    dataBySupplier[supplier.name] = { Rt: rtStep, Ft: Ft_points, ft: ft_points, lambda_t: lambda_t_points };
  });

  const transformToChartData = (
    dataType: 'Rt' | 'Ft' | 'ft' | 'lambda_t',
    defaultValue: number
  ) : ChartDataPoint[] => {
    const chartTimes = new Set<number>([0]);
    Object.values(dataBySupplier).forEach(s_data => {
      s_data[dataType].forEach(p => chartTimes.add(p.time));
    });
    const sortedTimes = Array.from(chartTimes).sort((a,b) => a-b);
    
    return sortedTimes.map(time => {
      const dataPoint: ChartDataPoint = { time };
      suppliers.forEach(supplier => {
        const sData = dataBySupplier[supplier.name];
        if (!sData) {
          dataPoint[supplier.name] = defaultValue;
          return;
        }

        const points = sData[dataType];
        const exact = points.find(p => p.time === time);
        if (exact) {
          dataPoint[supplier.name] = exact.value;
          return;
        }
        const preceding = points.filter(p => p.time < time);
        dataPoint[supplier.name] = preceding.length > 0 ? preceding[preceding.length - 1].value : defaultValue;
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
