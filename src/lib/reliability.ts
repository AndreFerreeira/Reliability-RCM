'use client';

import type { Supplier, ReliabilityData, ChartDataPoint, Distribution, Parameters } from '@/lib/types';

// Helper for error function
function erf(x: number): number {
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;

  const sign = (x >= 0) ? 1 : -1;
  x = Math.abs(x);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
}

function normalCdf(x: number, mean: number, stdDev: number): number {
    if (stdDev <= 0) return x < mean ? 0 : 1;
    return 0.5 * (1 + erf((x - mean) / (stdDev * Math.sqrt(2))));
}

function normalPdf(x: number, mean: number, stdDev: number): number {
    if (stdDev <= 0) return x === mean ? Infinity : 0;
    const variance = stdDev * stdDev;
    return (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean), 2) / variance);
}

// --- Parameter Estimation ---

function estimateWeibull(times: number[], suspensions: number[] = []): Parameters {
    if (times.length === 0) return { beta: 0, eta: 0 };
    if (suspensions.length > 0) {
      return estimateWeibullMLE(times, suspensions);
    }
    return estimateWeibullRankRegression(times);
}

// Maximum Likelihood Estimation for Weibull with censored data using Newton-Raphson
function estimateWeibullMLE(failures: number[], suspensions: number[], maxIterations = 100, tolerance = 1e-7): Parameters {
    const allData = [...failures, ...suspensions];
    if (failures.length === 0) return { beta: 0, eta: 0 };

    let beta = 1.0; // Initial guess for beta

    for (let i = 0; i < maxIterations; i++) {
        const kb = beta; // Keep naming for clarity
        const logTimes = allData.map(t => Math.log(t));
        const t_kb = allData.map(t => Math.pow(t, kb));
        const t_kb_logt = allData.map((t, j) => t_kb[j] * logTimes[j]);
        const t_kb_logt2 = allData.map((t, j) => t_kb[j] * Math.pow(logTimes[j], 2));

        const sum_t_kb = t_kb.reduce((a, b) => a + b, 0);
        const sum_t_kb_logt = t_kb_logt.reduce((a, b) => a + b, 0);
        const sum_t_kb_logt2 = t_kb_logt2.reduce((a, b) => a + b, 0);
        
        const sum_logt_failures = failures.reduce((a, b) => a + Math.log(b), 0);
        
        const N_f = failures.length;

        // First derivative of the log-likelihood function w.r.t. beta
        const dL_dbeta = (N_f / kb) + sum_logt_failures - (N_f / sum_t_kb) * sum_t_kb_logt;

        // Second derivative of the log-likelihood function w.r.t. beta
        const d2L_dbeta2 = (-N_f / (kb * kb)) - (N_f / sum_t_kb) * sum_t_kb_logt2 + (N_f / Math.pow(sum_t_kb, 2)) * Math.pow(sum_t_kb_logt, 2);

        if (Math.abs(d2L_dbeta2) < 1e-10) break; // Avoid division by zero

        const newBeta = beta - dL_dbeta / d2L_dbeta2;

        if (!isFinite(newBeta) || newBeta <= 0) {
            break; // Stop if beta becomes invalid
        }

        if (Math.abs(newBeta - beta) < tolerance) {
            beta = newBeta;
            break;
        }
        beta = newBeta;
    }
    
    beta = Math.max(0.01, beta); // Ensure beta is positive

    const eta = Math.pow(allData.reduce((acc, t) => acc + Math.pow(t, beta), 0) / failures.length, 1 / beta);

    return { beta: isNaN(beta) ? 0 : beta, eta: isNaN(eta) ? 0 : eta };
}


function estimateWeibullRankRegression(times: number[]): Parameters {
    if (times.length < 2) return { beta: 0, eta: 0 };

    const sortedTimes = [...times].sort((a, b) => a - b);
    const n = sortedTimes.length;
    const medianRanks = sortedTimes.map((_, i) => (i + 1 - 0.3) / (n + 0.4));
    
    const plotPoints = medianRanks.map((mr, i) => {
        if (mr >= 1 || sortedTimes[i] <= 0) return null;
        return { x: Math.log(sortedTimes[i]), y: Math.log(Math.log(1 / (1 - mr))) };
    }).filter(p => p !== null) as {x: number, y: number}[];

    if(plotPoints.length < 2) return { beta: 0, eta: 0 };

    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    plotPoints.forEach(p => {
        sumX += p.x;
        sumY += p.y;
        sumXY += p.x * p.y;
        sumXX += p.x * p.x;
    });

    const num = plotPoints.length;
    const beta = (num * sumXY - sumX * sumY) / (num * sumXX - sumX * sumX);
    const intercept = (sumY - beta * sumX) / num;
    const eta = Math.exp(-intercept / beta);

    return { beta: isNaN(beta) ? 0 : beta, eta: isNaN(eta) ? 0 : eta };
}


function estimateNormal(times: number[]): Parameters {
    if (times.length < 1) return { mean: 0, stdDev: 0 };
    const n = times.length;
    const mean = times.reduce((a, b) => a + b, 0) / n;
    const stdDev = Math.sqrt(times.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / (n > 1 ? n - 1 : 1));
    return { mean, stdDev };
}

function estimateLognormal(times: number[]): Parameters {
    if (times.length < 1) return { mean: 0, stdDev: 0 };
    const logTimes = times.map(t => Math.log(t)).filter(t => isFinite(t));
    return estimateNormal(logTimes);
}

function estimateExponential(times: number[]): Parameters {
    if (times.length < 1) return { lambda: 0 };
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    return { lambda: mean > 0 ? 1 / mean : 0 };
}

export function estimateParameters(failureTimes: number[], dist: Distribution, suspensionTimes: number[] = []): Parameters {
    switch (dist) {
        case 'Weibull': return estimateWeibull(failureTimes, suspensionTimes);
        case 'Normal': return estimateNormal(failureTimes);
        case 'Lognormal': return estimateLognormal(failureTimes);
        case 'Exponential': return estimateExponential(failureTimes);
        default: return {};
    }
}

// --- Reliability Calculations ---

export function calculateReliabilityData(suppliers: Supplier[]): ReliabilityData {
  if (suppliers.length === 0) {
    return { Rt: [], Ft: [], ft: [], lambda_t: [] };
  }
  const allTimes = suppliers.flatMap(s => [...s.failureTimes, ...(s.suspensionTimes || [])]);
  const maxTime = Math.max(...allTimes, 0) * 1.2;
  const timePoints = Array.from({ length: 101 }, (_, i) => (i / 100) * maxTime);

  const dataBySupplier: Record<string, { [key: string]: { time: number; value: number }[] }> = {};

  suppliers.forEach(supplier => {
    const { distribution, params } = supplier;
    const results = { Rt: [] as any[], Ft: [] as any[], ft: [] as any[], lambda_t: [] as any[] };

    for (const t of timePoints) {
      // time=0 is problematic for some distributions, start slightly after
      const time = t === 0 ? 1e-9 : t;

      let R_t = NaN, F_t = NaN, f_t = NaN, lambda_t = NaN;

      switch (distribution) {
        case 'Weibull':
          if (params.eta && params.eta > 0 && params.beta && params.beta > 0) {
            const tOverEta = time / params.eta;
            R_t = Math.exp(-Math.pow(tOverEta, params.beta));
            F_t = 1 - R_t;
            f_t = (params.beta / params.eta) * Math.pow(tOverEta, params.beta - 1) * Math.exp(-Math.pow(tOverEta, params.beta));
            lambda_t = (params.beta / params.eta) * Math.pow(tOverEta, params.beta - 1);
          }
          break;
        case 'Normal':
           if (params.mean !== undefined && params.stdDev && params.stdDev > 0) {
            F_t = normalCdf(time, params.mean, params.stdDev);
            R_t = 1 - F_t;
            f_t = normalPdf(time, params.mean, params.stdDev);
            lambda_t = (R_t > 1e-9) ? f_t / R_t : (f_t / 1e-9);
          }
          break;
        case 'Lognormal':
          if (params.mean !== undefined && params.stdDev && params.stdDev > 0 && time > 0) {
            const logTime = Math.log(time);
            F_t = normalCdf(logTime, params.mean, params.stdDev);
            R_t = 1 - F_t;
            f_t = normalPdf(logTime, params.mean, params.stdDev) / time;
            lambda_t = (R_t > 1e-9) ? f_t / R_t : (f_t / 1e-9);
          }
          break;
        case 'Exponential':
          if (params.lambda && params.lambda > 0) {
            R_t = Math.exp(-params.lambda * time);
            F_t = 1 - R_t;
            f_t = params.lambda * Math.exp(-params.lambda * time);
            lambda_t = params.lambda;
          }
          break;
      }
      if (isFinite(R_t)) results.Rt.push({ time: t, value: R_t });
      if (isFinite(F_t)) results.Ft.push({ time: t, value: F_t });
      if (isFinite(f_t)) results.ft.push({ time: t, value: f_t });
      if (isFinite(lambda_t)) results.lambda_t.push({ time: t, value: lambda_t });
    }
    dataBySupplier[supplier.name] = results;
  });

  const transformToChartData = (dataType: 'Rt' | 'Ft' | 'ft' | 'lambda_t'): ChartDataPoint[] => {
    return timePoints.map(time => {
      const dataPoint: ChartDataPoint = { time };
      suppliers.forEach(supplier => {
        const sData = dataBySupplier[supplier.name]?.[dataType];
        const point = sData?.find(p => Math.abs(p.time - time) < 1e-8); // Floating point comparison
        
        let value = null;
        if (point && isFinite(point.value)) {
            value = point.value;
        } else if (time === 0) {
            if (dataType === 'Rt') value = 1;
            else if (dataType === 'Ft' || dataType === 'ft') value = 0;
            // For lambda_t at t=0, it might be Inf or 0, null is safer for plotting
        }

        dataPoint[supplier.name] = value;
      });
      return dataPoint;
    });
  };

  return { 
    Rt: transformToChartData('Rt'),
    Ft: transformToChartData('Ft'),
    ft: transformToChartData('ft'),
    lambda_t: transformToChartData('lambda_t')
  };
}

