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
// Benard's approximation for median ranks
function getMedianRank(i: number, n: number): number {
    return (i - 0.3) / (n + 0.4);
}

export function estimateWeibullRankRegression(
    times: number[],
    medianRanks?: number[]
): {
    points: { x: number, y: number, time: number, prob: number }[],
    line: { x: number, y: number }[],
    params: { beta: number, eta: number },
    rSquared: number
} {
    if (times.length < 2) return { points: [], line: [], params: { beta: 0, eta: 0 }, rSquared: 0 };

    const sortedTimes = [...times].sort((a, b) => a - b);
    const n = sortedTimes.length;
    
    const points = sortedTimes.map((time, i) => {
        // Use provided median ranks or calculate them if not available
        const prob = medianRanks && medianRanks.length === n ? medianRanks[i] : getMedianRank(i + 1, n);

        if (prob >= 1 || time <= 0) return null;
        return {
            x: Math.log(time),
            y: Math.log(Math.log(1 / (1 - prob))),
            time: time,
            prob: prob,
        };
    }).filter(p => p !== null && isFinite(p.x) && isFinite(p.y)) as { x: number, y: number, time: number, prob: number }[];

    if (points.length < 2) return { points: [], line: [], params: { beta: 0, eta: 0 }, rSquared: 0 };

    // Linear regression on the transformed points (y = beta * x + intercept)
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, sumYY = 0, N = points.length;
    points.forEach(p => {
        sumX += p.x;
        sumY += p.y;
        sumXY += p.x * p.y;
        sumXX += p.x * p.x;
        sumYY += p.y * p.y;
    });

    const numerator = (N * sumXY - sumX * sumY);
    const denominator = (N * sumXX - sumX * sumX);
    
    if (Math.abs(denominator) < 1e-9) { // Avoid division by zero
        return { points, line: [], params: { beta: 0, eta: 0 }, rSquared: 0 };
    }

    const beta = numerator / denominator;
    const intercept = (sumY - beta * sumX) / N;
    const eta = Math.exp(-intercept / beta);

    const ssr = Math.pow(numerator, 2) / denominator;
    const sst = sumYY - (sumY * sumY) / N;
    const rSquared = sst === 0 ? 1 : ssr / sst;
    
    const minX = Math.min(...points.map(p => p.x));
    const maxX = Math.max(...points.map(p => p.x));

    const line = [
        { x: minX, y: beta * minX + intercept },
        { x: maxX, y: beta * maxX + intercept },
    ];
    
    return {
        points,
        line,
        params: { beta: isNaN(beta) ? 0 : beta, eta: isNaN(eta) ? 0 : eta },
        rSquared: isNaN(rSquared) ? 0 : rSquared
    };
}


// Maximum Likelihood Estimation for Weibull with censored data using Newton-Raphson
function estimateWeibullMLE(failures: number[], suspensions: number[] = [], maxIterations = 100, tolerance = 1e-7): Parameters {
    const allData = [...failures, ...suspensions];
    if (failures.length === 0) {
        if (allData.length > 1) { // If only suspensions, use RR
             const rr_params = estimateWeibullRankRegression(allData).params;
             return { beta: rr_params.beta, eta: rr_params.eta };
        }
        return { beta: 0, eta: 0 };
    }


    let beta = 1.0; // Initial guess for beta

    for (let i = 0; i < maxIterations; i++) {
        const beta_i = beta;
        
        let sum_t_beta_logt = 0;
        let sum_t_beta_logt2 = 0;
        let sum_t_beta = 0;
        let sum_logt_failures = 0;

        for(const t of allData) {
            if (t <= 0) continue;
            const t_beta = Math.pow(t, beta_i);
            const logt = Math.log(t);
            sum_t_beta += t_beta;
            sum_t_beta_logt += t_beta * logt;
            sum_t_beta_logt2 += t_beta * logt * logt;
        }

        for(const t of failures) {
            if (t <= 0) continue;
            sum_logt_failures += Math.log(t);
        }
        
        const numFailures = failures.length;

        // First derivative of log-likelihood w.r.t beta
        const dL_dbeta = (numFailures / beta_i) + sum_logt_failures - (numFailures * sum_t_beta_logt) / sum_t_beta;
        
        // Second derivative of log-likelihood w.r.t beta
        const d2L_dbeta2 = (-numFailures / (beta_i * beta_i)) - (numFailures / sum_t_beta) * (sum_t_beta_logt2 - Math.pow(sum_t_beta_logt, 2) / sum_t_beta);

        if (Math.abs(d2L_dbeta2) < 1e-10) break;

        const newBeta = beta - dL_dbeta / d2L_dbeta2;

        if (!isFinite(newBeta) || newBeta <= 0) { // Fallback to Rank Regression if MLE fails
            const rr_params = estimateWeibullRankRegression(failures).params;
            return { beta: rr_params.beta, eta: rr_params.eta };
        }

        if (Math.abs(newBeta - beta) < tolerance) {
            beta = newBeta;
            break;
        }
        beta = newBeta;
    }
    
    beta = Math.max(0.01, beta);

    const eta = Math.pow(allData.reduce((acc, t) => acc + Math.pow(t, beta), 0) / failures.length, 1 / beta);

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
    if (logTimes.length === 0) return { mean: 0, stdDev: 0 };
    return estimateNormal(logTimes);
}

function estimateExponential(times: number[]): Parameters {
    if (times.length < 1) return { lambda: 0 };
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    return { lambda: mean > 0 ? 1 / mean : 0 };
}

export function estimateParameters(failureTimes: number[], dist: Distribution, suspensionTimes: number[] = []): Parameters {
    switch (dist) {
        case 'Weibull': 
             return estimateWeibullMLE(failureTimes, suspensionTimes);
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
            if (R_t > 1e-9) {
                 lambda_t = f_t / R_t;
            } else {
                 // For very small R(t), lambda_t can be approximated by f_t / epsilon to avoid infinity
                 lambda_t = f_t / 1e-9;
            }
          }
          break;
        case 'Normal':
           if (params.mean !== undefined && params.stdDev && params.stdDev > 0) {
            F_t = normalCdf(time, params.mean, params.stdDev);
            R_t = 1 - F_t;
            f_t = normalPdf(time, params.mean, params.stdDev);
            lambda_t = (R_t > 1e-9) ? f_t / R_t : 0;
          }
          break;
        case 'Lognormal':
          if (params.mean !== undefined && params.stdDev && params.stdDev > 0 && time > 0) {
            const logTime = Math.log(time);
            F_t = normalCdf(logTime, params.mean, params.stdDev);
            R_t = 1 - F_t;
            f_t = normalPdf(logTime, params.mean, params.stdDev) / time;
            lambda_t = (R_t > 1e-9) ? f_t / R_t : 0;
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
    return timePoints.map((time, index) => {
      const dataPoint: ChartDataPoint = { time };
      suppliers.forEach(supplier => {
        const sData = dataBySupplier[supplier.name]?.[dataType];
        const point = sData?.find(p => Math.abs(p.time - time) < 1e-8); // Floating point comparison
        
        let value: number | null = null;
        if (point && isFinite(point.value)) {
            // For ft and lambda_t, ignore the very first point if it's an extreme outlier from t=0 case
            if ((dataType === 'ft' || dataType === 'lambda_t') && time === 0) {
               value = null;
            } else {
               value = point.value;
            }
        } else if (time === 0) {
            if (dataType === 'Rt') value = 1;
            else if (dataType === 'Ft') value = 0;
            // For ft and lambda_t at t=0, it might be Inf or 0, null is safer for plotting
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

    