'use client';

import type { Supplier, ReliabilityData, ChartDataPoint, Distribution, Parameters, GumbelParams, LoglogisticParams, EstimationMethod, EstimateParams, PlotData, FisherBoundsData } from '@/lib/types';

// --- Statistical Helpers ---

// Inverse Error Function
export function invErf(x: number): number {
    const a = 0.147;
    const sign = x < 0 ? -1 : 1;
    const absX = Math.abs(x);
    const log1MinusX2 = Math.log(1 - absX * absX);
    const term1 = 2 / (Math.PI * a) + log1MinusX2 / 2;
    const term2 = Math.sqrt(term1 * term1 - (log1MinusX2 / a));
    return sign * Math.sqrt(term2 - term1);
}

// Inverse of the standard normal cumulative distribution function (CDF).
export function invNormalCdf(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  // A&S formula 26.2.23 - very accurate
  const t = Math.sqrt(-2 * Math.log(1 - p));
  const c = [2.515517, 0.802853, 0.010328];
  const d = [1.432788, 0.189269, 0.001308];
  let z = t - ((c[2] * t + c[1]) * t + c[0]) / (((d[2] * t + d[1]) * t + d[0]) * t + 1.0);
  if (p < 0.5) {
    z = -z;
  }
  return z;
}


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

function performLinearRegression(points: {x: number, y: number}[], regressOnX: boolean = false) {
    if (points.length < 2) return null;

    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, sumYY = 0, N = points.length;
    points.forEach(p => {
        sumX += p.x;
        sumY += p.y;
        sumXY += p.x * p.y;
        sumXX += p.x * p.x;
        sumYY += p.y * p.y;
    });
    
    let slope: number;
    let intercept: number;
    
    const denominatorX = (N * sumXX - sumX * sumX);
    const denominatorY = (N * sumYY - sumY * sumY);

    if (regressOnX) {
        // Regress X on Y (x = my + c)
        if (Math.abs(denominatorY) < 1e-9) return null;
        const slope_x_on_y = (N * sumXY - sumX * sumY) / denominatorY;
        const intercept_x_on_y = (sumX - slope_x_on_y * sumY) / N;

        // Convert back to y = mx + c for consistency
        slope = 1 / slope_x_on_y;
        intercept = -intercept_x_on_y / slope_x_on_y;

    } else {
        // Regress Y on X (standard, y = mx + c)
        if (Math.abs(denominatorX) < 1e-9) return null;
        slope = (N * sumXY - sumX * sumY) / denominatorX;
        intercept = (sumY - slope * sumX) / N;
    }

    const rSquaredNumerator = (N * sumXY - sumX * sumY);
    const rSquaredDenominator = Math.sqrt(denominatorX * denominatorY);
    if(Math.abs(rSquaredDenominator) < 1e-9) return { slope, intercept, rSquared: 1 };
    
    const r = rSquaredNumerator / rSquaredDenominator;
    const rSquared = r*r;

    return { slope, intercept, rSquared };
}


// --- Rank Regression Estimation for Various Distributions ---

type AnalysisResult = {
    plotData: PlotData,
    params: Parameters
}

function calculateAdjustedRanks(failureTimes: number[], suspensionTimes: number[]): { time: number; prob: number; }[] {
    const allData = [
        ...failureTimes.map(t => ({ time: t, isFailure: true })),
        ...suspensionTimes.map(t => ({ time: t, isFailure: false }))
    ].sort((a, b) => a.time - b.time);

    const n = allData.length;
    if (n === 0 || failureTimes.length === 0) return [];
    
    const rankedPoints: { time: number; prob: number; }[] = [];
    let previousRank = 0;
    
    for (let i = 0; i < n; i++) {
        if (allData[i].isFailure) {
            const itemsRemaining = n - i;
            const increment = (n + 1 - previousRank) / (1 + itemsRemaining);
            const newRank = previousRank + increment;
            const prob = (newRank - 0.3) / (n + 0.4); // Benard's approximation for Median Rank
            
            if (prob < 1) { // Ensure probability is less than 1
                rankedPoints.push({ time: allData[i].time, prob });
            }
            previousRank = newRank;
        }
    }
    
    return rankedPoints;
}

export function estimateParametersByRankRegression(
    dist: Distribution,
    failureTimes: number[],
    suspensionTimes: number[] = [],
    method: 'SRM' | 'RRX'
): AnalysisResult | null {
    
    const rankedPoints = calculateAdjustedRanks(failureTimes, suspensionTimes);
    if (rankedPoints.length === 0) return null;

    let transformedPoints: { x: number; y: number; time: number; prob: number; }[] = [];
    for (const point of rankedPoints) {
        if (point.time <= 0 || point.prob <= 0 || point.prob >= 1) continue;

        let x: number, y: number;
        switch(dist) {
            case 'Weibull':
                x = Math.log(point.time);
                y = Math.log(Math.log(1 / (1 - point.prob)));
                break;
            case 'Lognormal':
                x = Math.log(point.time);
                y = invNormalCdf(point.prob);
                break;
            case 'Normal':
                x = point.time;
                y = invNormalCdf(point.prob);
                break;
            case 'Exponential':
                x = point.time;
                y = Math.log(1 / (1 - point.prob));
                break;
            case 'Loglogistic':
                x = Math.log(point.time);
                y = Math.log(point.prob / (1 - point.prob));
                break;
            case 'Gumbel':
                x = point.time;
                y = -Math.log(-Math.log(point.prob));
                break;
            default:
                return null;
        }

        if(isFinite(x) && isFinite(y)) {
            transformedPoints.push({ x, y, time: point.time, prob: point.prob });
        }
    }

    if (transformedPoints.length < 2) return null;
    
    const regressOnX = method === 'RRX';
    const regression = performLinearRegression(transformedPoints, regressOnX);
    if (!regression) return null;

    const { rSquared, slope, intercept } = regression;
    let params: Parameters = {};

    switch(dist) {
        case 'Weibull':
            params = { beta: slope, eta: Math.exp(-intercept / slope), rho: rSquared };
            break;
        case 'Lognormal':
            params = { stdDev: 1 / slope, mean: -intercept / slope, rho: rSquared };
            break;
        case 'Normal':
            params = { stdDev: 1 / slope, mean: -intercept / slope, rho: rSquared };
            break;
        case 'Exponential':
            params = { lambda: slope, rho: rSquared };
            break;
        case 'Loglogistic':
            params = { beta: slope, alpha: Math.exp(-intercept / slope), rho: rSquared };
            break;
        case 'Gumbel':
            params = { sigma: 1 / slope, mu: -intercept / slope, rho: rSquared };
            break;
    }

    const minX = Math.min(...transformedPoints.map(p => p.x));
    const maxX = Math.max(...transformedPoints.map(p => p.x));

    const line = [
        { x: minX, y: slope * minX + intercept },
        { x: maxX, y: slope * maxX + intercept },
    ];

    const angle = Math.atan(slope) * (180 / Math.PI);
    
    return { 
        plotData: { points: transformedPoints, line, rSquared, angle },
        params
    };
}


// Maximum Likelihood Estimation for Weibull with censored data using Newton-Raphson
function estimateWeibullMLE(failures: number[], suspensions: number[] = [], maxIterations = 100, tolerance = 1e-7): Parameters {
    const allData = [...failures, ...suspensions];
    if (failures.length === 0) {
        return { beta: undefined, eta: undefined };
    }

    let beta = 1.0; // Initial guess for beta

    for (let iter = 0; iter < maxIterations; iter++) {
        const beta_i = beta;
        
        let sum_t_beta_logt = 0;
        let sum_t_beta = 0;
        let sum_t_beta_logt_sq = 0;
        let sum_logt_failures = 0;
        
        for (const t of allData) {
            if (t <= 0) continue;
            const t_beta = Math.pow(t, beta_i);
            const logt = Math.log(t);
            sum_t_beta += t_beta;
            sum_t_beta_logt += t_beta * logt;
            sum_t_beta_logt_sq += t_beta * logt * logt;
        }

        for (const t of failures) {
            if (t <= 0) continue;
            sum_logt_failures += Math.log(t);
        }
        
        const numFailures = failures.length;
        if (numFailures === 0 || sum_t_beta === 0) return { beta: undefined, eta: undefined };

        // First derivative of log-likelihood w.r.t beta
        const dL_dbeta = (numFailures / beta_i) + sum_logt_failures - (numFailures / sum_t_beta) * sum_t_beta_logt;
        
        // Second derivative (Hessian)
        const d2L_dbeta2 = (-numFailures / (beta_i * beta_i)) - numFailures * (
            (sum_t_beta_logt_sq * sum_t_beta - Math.pow(sum_t_beta_logt, 2)) / Math.pow(sum_t_beta, 2)
        );

        if (Math.abs(d2L_dbeta2) < 1e-10) break; // Avoid division by zero

        const newBeta = beta - dL_dbeta / d2L_dbeta2;

        if (!isFinite(newBeta) || newBeta <= 0) {
             const rr_params = estimateParametersByRankRegression('Weibull', failures, suspensions, 'SRM')?.params;
             return { beta: rr_params?.beta, eta: rr_params?.eta };
        }

        if (Math.abs(newBeta - beta) < tolerance) {
            beta = newBeta;
            break;
        }
        beta = newBeta;
    }
    
    beta = Math.max(0.01, beta);

    const eta = Math.pow(allData.reduce((acc, t) => acc + Math.pow(t, beta), 0) / failures.length, 1 / beta);

    return { beta: isNaN(beta) ? undefined : beta, eta: isNaN(eta) ? undefined : eta, rho: undefined };
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

export function estimateParameters({ dist, failureTimes, suspensionTimes = [], method = 'SRM', isGrouped = false }: EstimateParams): { params: Parameters, plotData?: PlotData } {
    if (failureTimes.length === 0) return { params: {} };
    
    if (isGrouped && (method === 'SRM' || method === 'RRX')) {
        // Special handling for grouped data rank regression
        const srmResult = estimateParametersByRankRegression(dist, failureTimes, suspensionTimes, method);
        return { params: srmResult?.params ?? {}, plotData: srmResult?.plotData };
    }
    
    // For SRM (Rank Regression on Y) and RRX (Rank Regression on X)
    if (method === 'SRM' || method === 'RRX') {
        const srmResult = estimateParametersByRankRegression(dist, failureTimes, suspensionTimes, method);
        return { params: srmResult?.params ?? {}, plotData: srmResult?.plotData };
    }

    // For MLE
    if (dist === 'Weibull' && method === 'MLE') {
        const params = estimateWeibullMLE(failureTimes, suspensionTimes);
        const plotResult = estimateParametersByRankRegression('Weibull', failureTimes, suspensionTimes, 'SRM');
        return { params, plotData: plotResult?.plotData };
    }

    if (dist === 'Normal' && method === 'MLE') {
        const params = estimateNormal(failureTimes); // Note: Simplified, doesn't handle suspensions for Normal MLE
        const plotResult = estimateParametersByRankRegression('Normal', failureTimes, suspensionTimes, 'SRM');
        return { params, plotData: plotResult?.plotData };
    }

    if (dist === 'Lognormal' && method === 'MLE') {
        const params = estimateLognormal(failureTimes); // Note: Simplified, doesn't handle suspensions for Lognormal MLE
        const plotResult = estimateParametersByRankRegression('Lognormal', failureTimes, suspensionTimes, 'SRM');
        return { params, plotData: plotResult?.plotData };
    }
    
    if (dist === 'Exponential' && method === 'MLE') {
        const allTimes = [...failureTimes, ...suspensionTimes];
        const params = estimateExponential(allTimes); // For exponential, MLE mean is sum of all times / num of failures
        const plotResult = estimateParametersByRankRegression('Exponential', failureTimes, suspensionTimes, 'SRM');
        return { params, plotData: plotResult?.plotData };
    }
    
    return { params: {} };
}

export function calculateFisherConfidenceBounds(failureTimes: number[], confidenceLevel: number): FisherBoundsData | undefined {
    const analysis = estimateParametersByRankRegression('Weibull', failureTimes, [], 'SRM');
    if (!analysis || !analysis.params.beta || !analysis.params.eta || !analysis.plotData) return undefined;

    const { beta, eta } = analysis.params;
    const n = failureTimes.length;
    const z = invNormalCdf(1 - (1 - confidenceLevel / 100) / 2);

    // Fisher Matrix variance-covariance approximations for SRM
    const var_beta_hat = (0.608 * beta * beta) / n;
    const var_eta_hat = (0.370 * eta * eta) / (n * beta * beta);
    const cov_beta_eta_hat = (0.255 * beta * eta) / n;

    const linePoints = analysis.plotData.line;
    const lowerBounds: { x: number; y: number }[] = [];
    const upperBounds: { x: number; y: number }[] = [];

    // We need more points for a smooth curve
    const allX = analysis.plotData.points.map(p => p.x);
    const minLogTime = Math.min(...allX);
    const maxLogTime = Math.max(...allX);
    
    const plotPointsCount = 100;
    const logTimeRange = maxLogTime - minLogTime;

    for (let i = 0; i <= plotPointsCount; i++) {
        const currentLogTime = minLogTime + (i / plotPointsCount) * logTimeRange;
        const y_hat = beta * currentLogTime - beta * Math.log(eta);

        // Variance of the reliability function's linearized form (Y = log(log(1/R(t))))
        const var_Y = (Math.pow(currentLogTime - Math.log(eta), 2) * var_beta_hat) +
                      (Math.pow(beta / eta, 2) * var_eta_hat) -
                      (2 * (currentLogTime - Math.log(eta)) * (beta / eta) * cov_beta_eta_hat);
        
        if (var_Y < 0) continue;

        const std_Y = Math.sqrt(var_Y);

        const y_lower = y_hat - z * std_Y;
        const y_upper = y_hat + z * std_Y;

        lowerBounds.push({ x: currentLogTime, y: y_lower });
        upperBounds.push({ x: currentLogTime, y: y_upper });
    }
    
    return {
        ...analysis.plotData,
        lower: lowerBounds,
        upper: upperBounds,
        beta,
        eta,
        confidenceLevel
    };
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
            lambda_t = (R_t > 1e-9) ? f_t / R_t: f_t / 1e-9;
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
            if ((dataType === 'ft' || dataType === 'lambda_t') && time === 0) {
               value = null;
            } else {
               value = point.value;
            }
        } else if (time === 0) {
            if (dataType === 'Rt') value = 1;
            else if (dataType === 'Ft') value = 0;
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
