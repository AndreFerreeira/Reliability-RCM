

'use client';

import type { Supplier, ReliabilityData, ChartDataPoint, Distribution, Parameters, GumbelParams, LoglogisticParams, EstimationMethod, EstimateParams, PlotData, FisherBoundsData, CalculationResult, ContourData, DistributionAnalysisResult } from '@/lib/types';

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

// Chi-Squared distribution quantile function
function invChi2(p: number, df: number): number {
    if (df <= 0) return NaN;

    // Abramowitz and Stegun 26.4.17
    let x = invNormalCdf(p);
    let p_ = 2.0/9.0/df;
    let chi = df * Math.pow(1.0 - p_ + x*Math.sqrt(p_), 3);

    // Refine with Newton's method if needed, but this is a good approximation.
    return chi;
}

// --- Helper for error function ---
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

    // Use Rank Regression as initial guess
    const rr_params = estimateParametersByRankRegression('Weibull', failures, suspensions, 'SRM')?.params;
    let beta = rr_params?.beta || 1.0;

    for (let iter = 0; iter < maxIterations; iter++) {
        const beta_k = beta;
        
        let sum1 = 0, sum2 = 0, sum3 = 0, sum_logt_failures = 0;
        
        allData.forEach(t => {
            if (t <= 0) return;
            const t_beta = Math.pow(t, beta_k);
            const log_t = Math.log(t);
            sum1 += t_beta;
            sum2 += t_beta * log_t;
            sum3 += t_beta * log_t * log_t;
        });

        failures.forEach(t => {
             if (t <= 0) return;
             sum_logt_failures += Math.log(t);
        });
        
        const numFailures = failures.length;
        if (numFailures === 0 || sum1 === 0) return { beta: undefined, eta: undefined, rho: undefined };

        // First derivative of log-likelihood w.r.t beta
        const dL_dbeta = (numFailures / beta_k) + sum_logt_failures - (numFailures / sum1) * sum2;
        
        // Second derivative (Hessian)
        const d2L_dbeta2 = (-numFailures / (beta_k * beta_k)) - numFailures * (
            (sum3 * sum1 - sum2 * sum2) / (sum1 * sum1)
        );

        if (Math.abs(d2L_dbeta2) < 1e-10) {
             // Fallback to RR if Hessian is near zero
            return { beta: rr_params?.beta, eta: rr_params?.eta, lkv: calculateWeibullLogLikelihood(failures, suspensions, rr_params?.beta, rr_params?.eta) };
        }; 

        const newBeta = beta_k - dL_dbeta / d2L_dbeta2;

        if (!isFinite(newBeta) || newBeta <= 0) {
             // Fallback to RR if beta becomes invalid
             return { beta: rr_params?.beta, eta: rr_params?.eta, lkv: calculateWeibullLogLikelihood(failures, suspensions, rr_params?.beta, rr_params?.eta) };
        }

        if (Math.abs(newBeta - beta) < tolerance) {
            beta = newBeta;
            break;
        }
        beta = newBeta;
    }
    
    beta = Math.max(0.01, beta);

    const eta = Math.pow(allData.reduce((acc, t) => acc + Math.pow(t, beta), 0) / failures.length, 1 / beta);
    const lkv = calculateWeibullLogLikelihood(failures, suspensions, beta, eta);

    return { beta: isNaN(beta) ? undefined : beta, eta: isNaN(eta) ? undefined : eta, lkv };
}


function estimateNormalMLE(failures: number[], suspensions: number[] = []): Parameters {
    if (failures.length < 1) return { mean: undefined, stdDev: undefined };
    // Simplified MLE for normal without suspensions: same as method of moments
    // For censored data, this is much more complex (EM algorithm). Sticking to a simplified version.
    const allData = [...failures, ...suspensions];
    const n = allData.length;
    const mean = allData.reduce((a, b) => a + b, 0) / n;
    const stdDev = Math.sqrt(allData.reduce((sq, cur) => sq + Math.pow(cur - mean, 2), 0) / n); // Use 'n' for MLE variance
    
    let lkv = 0;
    failures.forEach(t => {
        const pdfVal = normalPdf(t, mean, stdDev);
        lkv += (pdfVal > 0 ? Math.log(pdfVal) : -Infinity);
    });
    suspensions.forEach(t => {
        const cdfVal = normalCdf(t, mean, stdDev);
        lkv += (cdfVal < 1 ? Math.log(1 - cdfVal) : -Infinity);
    });

    return { mean, stdDev, lkv };
}

function estimateLognormalMLE(failures: number[], suspensions: number[] = []): Parameters {
    if (failures.length < 1) return { mean: undefined, stdDev: undefined };
    
    const logFailures = failures.map(t => Math.log(t)).filter(isFinite);
    const logSuspensions = suspensions.map(t => Math.log(t)).filter(isFinite);
    const allLogData = [...logFailures, ...logSuspensions];
    
    if(logFailures.length < 1) return { mean: undefined, stdDev: undefined };

    const n = allLogData.length;
    const mean = allLogData.reduce((a, b) => a + b, 0) / n; // log-mean
    const stdDev = Math.sqrt(allLogData.reduce((sq, cur) => sq + Math.pow(cur - mean, 2), 0) / n); // log-stdDev

    let lkv = 0;
    failures.forEach(t => {
        if (t <= 0) return;
        const pdfVal = normalPdf(Math.log(t), mean, stdDev) / t;
        lkv += (pdfVal > 0 ? Math.log(pdfVal) : -Infinity);
    });
    suspensions.forEach(t => {
        if (t <= 0) return;
        const cdfVal = normalCdf(Math.log(t), mean, stdDev);
        lkv += (cdfVal < 1 ? Math.log(1 - cdfVal) : -Infinity);
    });

    return { mean, stdDev, lkv };
}


function estimateExponentialMLE(failures: number[], suspensions: number[] = []): Parameters {
    const allTimes = [...failures, ...suspensions];
    if (failures.length === 0) return { lambda: undefined };
    
    const sumOfTimes = allTimes.reduce((a, b) => a + b, 0);
    const lambda = failures.length / sumOfTimes; // MLE for lambda
    
    const lkv = failures.length * Math.log(lambda) - lambda * sumOfTimes;
    
    return { lambda, lkv };
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
    let params: Parameters = {};
    if (dist === 'Weibull' && method === 'MLE') {
        params = estimateWeibullMLE(failureTimes, suspensionTimes);
    } else if (dist === 'Normal' && method === 'MLE') {
        params = estimateNormalMLE(failureTimes, suspensionTimes);
    } else if (dist === 'Lognormal' && method === 'MLE') {
        params = estimateLognormalMLE(failureTimes, suspensionTimes);
    } else if (dist === 'Exponential' && method === 'MLE') {
        params = estimateExponentialMLE(failureTimes, suspensionTimes);
    } else {
        // Fallback to SRM for unsupported MLE or other methods
        return estimateParameters({ dist, failureTimes, suspensionTimes, method: 'SRM', isGrouped });
    }
    
    const plotResult = estimateParametersByRankRegression(dist, failureTimes, suspensionTimes, 'SRM');
    return { params, plotData: plotResult?.plotData };
}

export function calculateFisherConfidenceBounds(
    failureTimes: number[], 
    confidenceLevel: number,
    timeForCalc?: number
): FisherBoundsData | undefined {
    const analysis = estimateParametersByRankRegression('Weibull', failureTimes, [], 'SRM');
    if (!analysis || !analysis.params.beta || !analysis.params.eta || !analysis.plotData) return undefined;

    const { beta, eta } = analysis.params;
    const n = failureTimes.length;
    const z = invNormalCdf(1 - (1 - confidenceLevel / 100) / 2);

    // Fisher Matrix variance-covariance approximations for SRM
    const var_beta_hat = (0.608 * beta * beta) / n;
    const var_eta_hat = (0.370 * eta * eta) / (n * beta * beta);
    const cov_beta_eta_hat = (0.255 * beta * eta) / n;

    const lowerBounds: { x: number; y: number; time: number }[] = [];
    const upperBounds: { x: number; y: number; time: number }[] = [];

    const plotPointsCount = 100;
    const allTimes = [...analysis.plotData.points.map(p => p.time), timeForCalc].filter(t => t !== undefined && t > 0) as number[];
    const minTime = Math.min(...allTimes);
    const maxTime = Math.max(...allTimes);
    
    for (let i = 0; i <= plotPointsCount; i++) {
        const currentTime = minTime + (i / plotPointsCount) * (maxTime - minTime);
        if (currentTime <=0) continue;

        const currentLogTime = Math.log(currentTime);
        const y_hat = beta * currentLogTime - beta * Math.log(eta);

        const var_Y = (Math.pow(currentLogTime - Math.log(eta), 2) * var_beta_hat) +
                      (Math.pow(beta / eta, 2) * var_eta_hat) -
                      (2 * (currentLogTime - Math.log(eta)) * (beta / eta) * cov_beta_eta_hat);
        
        if (var_Y < 0) continue;

        const std_Y = Math.sqrt(var_Y);

        const y_lower = y_hat - z * std_Y;
        const y_upper = y_hat + z * std_Y;

        lowerBounds.push({ x: currentLogTime, y: y_lower, time: currentTime });
        upperBounds.push({ x: currentLogTime, y: y_upper, time: currentTime });
    }
    
    let calculation: CalculationResult | undefined = undefined;
    if (timeForCalc !== undefined && timeForCalc > 0) {
        const logTimeCalc = Math.log(timeForCalc);
        const y_median = beta * logTimeCalc - beta * Math.log(eta);
        const var_Y_calc = (Math.pow(logTimeCalc - Math.log(eta), 2) * var_beta_hat) +
                      (Math.pow(beta / eta, 2) * var_eta_hat) -
                      (2 * (logTimeCalc - Math.log(eta)) * (beta / eta) * cov_beta_eta_hat);
        
        if(var_Y_calc >= 0) {
            const std_Y_calc = Math.sqrt(var_Y_calc);
            const y_lower_calc = y_median - z * std_Y_calc;
            const y_upper_calc = y_median + z * std_Y_calc;

            const prob_median = 1 - Math.exp(-Math.exp(y_median));
            const prob_lower = 1 - Math.exp(-Math.exp(y_lower_calc));
            const prob_upper = 1 - Math.exp(-Math.exp(y_upper_calc));

            calculation = {
                failureProb: { median: prob_median, lower: prob_lower, upper: prob_upper },
                reliability: { median: 1 - prob_median, upper: 1 - prob_upper, lower: 1 - prob_lower }
            }
        }
    }

    return {
        ...analysis.plotData,
        lower: lowerBounds,
        upper: upperBounds,
        beta,
        eta,
        confidenceLevel,
        calculation
    };
}


export function calculateContourEllipse(
    failureTimes: number[],
    confidenceLevel: number
): ContourData | undefined {
    if (failureTimes.length < 2) return undefined;
    
    const mle_params = estimateWeibullMLE(failureTimes);
    if (!mle_params.beta || !mle_params.eta || !isFinite(mle_params.beta) || !isFinite(mle_params.eta)) {
        return undefined;
    }

    const beta_mle = mle_params.beta;
    const eta_mle = mle_params.eta;
    const n = failureTimes.length;
    const r = failureTimes.length; // No suspensions in this simplified case
    const chi2 = invChi2(confidenceLevel / 100, 2);

    const L_bb_Term1 = r / (beta_mle * beta_mle);
    const L_bb_Term2 = failureTimes.reduce((sum, ti) => sum + Math.pow(ti / eta_mle, beta_mle) * Math.pow(Math.log(ti / eta_mle), 2), 0);
    const L_bb = L_bb_Term1 + L_bb_Term2;

    const L_ee_Term1 = (beta_mle * r / (eta_mle * eta_mle));
    const L_ee_Term2 = failureTimes.reduce((sum, ti) => sum + (beta_mle + 1) * Math.pow(ti / eta_mle, beta_mle), 0);
    const L_ee = L_ee_Term1 * L_ee_Term2;

    const L_be_Term1 = r / eta_mle;
    const L_be_Term2 = failureTimes.reduce((sum, ti) => sum + Math.pow(ti / eta_mle, beta_mle) * (1 + beta_mle * Math.log(ti / eta_mle)), 0);
    const L_be = -(L_be_Term1 * L_be_Term2);
    
    if(!isFinite(L_bb) || !isFinite(L_ee) || !isFinite(L_be)) return undefined;

    const det = L_bb * L_ee - L_be * L_be;
    if (Math.abs(det) < 1e-20) return undefined;
    
    const var_beta = L_ee / det;
    const var_eta = L_bb / det;
    const cov_beta_eta = -L_be / det;

    if(var_beta <= 0 || var_eta <= 0) return undefined;

    const trace = var_beta + var_eta;
    const discriminant = Math.sqrt(Math.pow(var_beta - var_eta, 2) + 4 * cov_beta_eta * cov_beta_eta);
    const L1 = (trace + discriminant) / 2;
    const L2 = (trace - discriminant) / 2;

    if (L1 <= 0 || L2 <= 0) return undefined;

    const semi_axis1 = Math.sqrt(chi2 * L1);
    const semi_axis2 = Math.sqrt(chi2 * L2);

    const angle = 0.5 * Math.atan2(2 * cov_beta_eta, var_beta - var_eta);

    const ellipsePoints: number[][] = [];
    const pointsCount = 100;
    for (let i = 0; i <= pointsCount; i++) {
        const t = (2 * Math.PI * i) / pointsCount;
        const x_prime = semi_axis1 * Math.cos(t);
        const y_prime = semi_axis2 * Math.sin(t);

        const eta_val = eta_mle + x_prime * Math.cos(angle) - y_prime * Math.sin(angle);
        const beta_val = beta_mle + x_prime * Math.sin(angle) + y_prime * Math.cos(angle);
        
        ellipsePoints.push([eta_val, beta_val]);
    }
    
    const x_coords = ellipsePoints.map(p => p[0]);
    const y_coords = ellipsePoints.map(p => p[1]);

    const eta_lower = Math.min(...x_coords);
    const eta_upper = Math.max(...x_coords);
    const beta_lower = Math.min(...y_coords);
    const beta_upper = Math.max(...y_coords);

    const bufferX = (eta_upper - eta_lower) * 0.2;
    const bufferY = (beta_upper - beta_lower) * 0.2;

    return {
        center: { beta: beta_mle, eta: eta_mle },
        ellipse: ellipsePoints,
        confidenceLevel,
        bounds: { eta_lower, eta_upper, beta_lower, beta_upper },
        limits: {
            eta_min: Math.max(0, eta_lower - bufferX),
            eta_max: eta_upper + bufferX,
            beta_min: Math.max(0, beta_lower - bufferY),
            beta_max: beta_upper + bufferY,
        }
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

// --- Goodness of Fit ---

function calculateWeibullLogLikelihood(failures: number[], suspensions: number[], beta?: number, eta?: number): number {
    if (!beta || !eta || beta <= 0 || eta <= 0) return -Infinity;
    
    let logLikelihood = 0;
    const r = failures.length;

    logLikelihood += r * (Math.log(beta) - beta * Math.log(eta));
    logLikelihood += (beta - 1) * failures.reduce((acc, t) => acc + Math.log(t), 0);
    
    const sumTbeta = [...failures, ...suspensions].reduce((acc, t) => acc + Math.pow(t / eta, beta), 0);
    logLikelihood -= sumTbeta;

    return isFinite(logLikelihood) ? logLikelihood : -Infinity;
}

export function findBestDistribution(failureTimes: number[], suspensionTimes: number[]): DistributionAnalysisResult[] {
    const distributionsToTest: Distribution[] = ['Weibull', 'Lognormal', 'Normal', 'Exponential'];
    const results: DistributionAnalysisResult[] = [];

    for (const dist of distributionsToTest) {
        const analysis = estimateParameters({dist, failureTimes, suspensionTimes, method: 'MLE'});
        const rrAnalysis = estimateParametersByRankRegression(dist, failureTimes, suspensionTimes, 'SRM');

        let logLikelihood = -Infinity;
        if (analysis.params.lkv !== undefined && isFinite(analysis.params.lkv)) {
            logLikelihood = analysis.params.lkv;
        }

        results.push({
            distribution: dist,
            params: analysis.params,
            rSquared: rrAnalysis?.params.rho ?? 0,
            logLikelihood: logLikelihood,
        });
    }

    return results;
}
