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

function normalCdf(x: number, mean: number = 0, stdDev: number = 1): number {
    if (stdDev <= 0) return x < mean ? 0 : 1;
    return 0.5 * (1 + erf((x - mean) / (stdDev * Math.sqrt(2))));
}

function normalPdf(x: number, mean: number, stdDev: number): number {
    if (stdDev <= 0) return x === mean ? Infinity : 0;
    const variance = stdDev * stdDev;
    return (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean), 2) / variance);
}

const lognormalPdf = (t: number, mu: number, sigma: number) => {
    if (t <= 0 || sigma <= 0) return 0;
    const denom = t * sigma * Math.sqrt(2 * Math.PI);
    const z = (Math.log(t) - mu) / sigma;
    return Math.exp(-0.5 * z * z) / denom;
};

const lognormalSurvival = (t: number, mu: number, sigma: number) => {
    if (t <= 0) return 1;
    const z = (Math.log(t) - mu) / sigma;
    return 1 - normalCdf(z);
};

const weibullPdf = (t: number, beta: number, eta: number) => {
    if (t < 0 || beta <= 0 || eta <= 0) return 0;
    return (beta / eta) * Math.pow(t / eta, beta - 1) * Math.exp(-Math.pow(t / eta, beta));
};

const weibullSurvival = (t: number, beta: number, eta: number) => {
    if (t < 0 || beta <= 0 || eta <= 0) return 1;
    return Math.exp(-Math.pow(t / eta, beta));
};

export const generateWeibullFailureTime = (beta: number, eta: number): number => {
  const u = Math.random();
  return eta * Math.pow(-Math.log(1 - u), 1 / beta);
};


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
    const allEvents = [
        ...failureTimes.map(t => ({ time: t, isFailure: true })),
        ...suspensionTimes.map(t => ({ time: t, isFailure: false }))
    ].sort((a, b) => a.time - b.time);

    const uniqueTimes = [...new Set(allEvents.map(e => e.time))];
    const n = allEvents.length;
    let reliability = 1.0;
    let itemsAtRisk = n;

    const reliabilityAtTime: { [time: number]: number } = {};

    for (const time of uniqueTimes) {
        const eventsAtTime = allEvents.filter(d => d.time === time);
        const failuresAtTime = eventsAtTime.filter(d => d.isFailure).length;

        if (failuresAtTime > 0) {
            reliability *= (1 - failuresAtTime / itemsAtRisk);
        }
        reliabilityAtTime[time] = reliability;
        itemsAtRisk -= eventsAtTime.length;
    }

    const failurePoints = failureTimes.map(t => ({ time: t, prob: 1 - reliabilityAtTime[t] }));
    
    // Remove duplicates for regression plotting, keeping the one with highest probability
    const uniqueFailurePoints = Array.from(
        failurePoints.reduce((map, point) => {
            if (!map.has(point.time) || point.prob > (map.get(point.time) as {prob: number}).prob) {
                map.set(point.time, point);
            }
            return map;
        }, new Map()).values()
    );

    return uniqueFailurePoints.sort((a, b) => a.time - b.time);
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

//--- Nelder-Mead Optimizer ---
type NMPoint = { x: number[]; fx: number };

function isFiniteNumber(x: any): x is number {
    return typeof x === "number" && isFinite(x);
}

function nelderMead(func: (x: number[]) => number, x0: number[], options: { maxIter?: number; tol?: number; scale?: number } = {}) {
    const maxIter = options.maxIter || 1000;
    const tol = options.tol || 1e-9;
    const alpha = 1, gamma = 2, rho = 0.5, sigma = 0.5;
    const n = x0.length;
    const scale = options.scale || 0.1;

    const simplex: NMPoint[] = [];
    simplex.push({ x: x0.slice(), fx: func(x0) });
    for (let i = 0; i < n; i++) {
        const xi = x0.slice();
        xi[i] = xi[i] + scale * (Math.abs(xi[i]) + 1);
        simplex.push({ x: xi, fx: func(xi) });
    }

    let iter = 0;
    while (iter < maxIter) {
        simplex.sort((a, b) => a.fx - b.fx);
        const best = simplex[0];
        const worst = simplex[simplex.length - 1];
        const secondWorst = simplex[simplex.length - 2];

        const fmean = simplex.reduce((s, v) => s + v.fx, 0) / simplex.length;
        let fvar = simplex.reduce((s, v) => s + (v.fx - fmean) ** 2, 0) / simplex.length;
        if (Math.sqrt(fvar) < tol) break;

        const centroid = new Array(n).fill(0);
        for (let i = 0; i < simplex.length - 1; i++) {
            for (let j = 0; j < n; j++) centroid[j] += simplex[i].x[j];
        }
        centroid.forEach((_, j) => centroid[j] /= (simplex.length - 1));

        const xr = centroid.map((c, j) => c + alpha * (c - worst.x[j]));
        const fxr = func(xr);
        if (fxr < secondWorst.fx && fxr >= best.fx) {
            simplex[simplex.length - 1] = { x: xr, fx: fxr };
            iter++;
            continue;
        }

        if (fxr < best.fx) {
            const xe = centroid.map((c, j) => c + gamma * (xr[j] - c));
            const fxe = func(xe);
            simplex[simplex.length - 1] = (fxe < fxr) ? { x: xe, fx: fxe } : { x: xr, fx: fxr };
            iter++;
            continue;
        }

        const xc = centroid.map((c, j) => c + rho * (worst.x[j] - c));
        const fxc = func(xc);
        if (fxc < worst.fx) {
            simplex[simplex.length - 1] = { x: xc, fx: fxc };
            iter++;
            continue;
        }

        for (let i = 1; i < simplex.length; i++) {
            simplex[i].x = simplex[0].x.map((b, j) => b + sigma * (simplex[i].x[j] - b));
            simplex[i].fx = func(simplex[i].x);
        }
        iter++;
    }

    simplex.sort((a, b) => a.fx - b.fx);
    return { x: simplex[0].x, fx: simplex[0].fx, iter };
}

//--- MLE Functions with Censoring ---
type CensoredData = { time: number; event: 1 | 0 };

function negLogLikLognormal(x: number[], data: CensoredData[]): number {
    const mu = x[0];
    const sigma = Math.exp(x[1]); // Ensure sigma > 0
    if (!isFiniteNumber(mu) || !isFiniteNumber(sigma) || sigma <= 0) return 1e300;

    let nll = 0;
    for (const d of data) {
        if (d.event === 1) { // Failure
            const pdf = lognormalPdf(d.time, mu, sigma);
            if (pdf <= 0) return 1e300;
            nll -= Math.log(pdf);
        } else { // Censored
            const S = lognormalSurvival(d.time, mu, sigma);
            nll -= Math.log(Math.max(S, 1e-300));
        }
    }
    return nll;
}

function negLogLikWeibull(x: number[], data: CensoredData[]): number {
    const beta = Math.exp(x[0]); // k (shape)
    const eta = Math.exp(x[1]); // lambda (scale)
    if (!isFiniteNumber(beta) || !isFiniteNumber(eta) || beta <= 0 || eta <= 0) return 1e300;

    let nll = 0;
    for (const d of data) {
        if (d.event === 1) { // Failure
            const pdf = weibullPdf(d.time, beta, eta);
            if (pdf <= 0) return 1e300;
            nll -= Math.log(pdf);
        } else { // Censored
            const S = weibullSurvival(d.time, beta, eta);
            nll -= Math.log(Math.max(S, 1e-300));
        }
    }
    return nll;
}

function fitLognormalMLE(data: CensoredData[]): Parameters {
    const failures = data.filter(d => d.event === 1).map(d => d.time);
    if (failures.length === 0) return { lkv: -Infinity };
    const logs = failures.map(t => Math.log(t));
    const mu0 = logs.reduce((s, v) => s + v, 0) / logs.length;
    const sd0 = Math.sqrt(logs.reduce((s, v) => s + (v - mu0) ** 2, 0) / (logs.length - 1 || 1));
    const x0 = [mu0, Math.log(sd0 || 1)];

    const res = nelderMead(x => negLogLikLognormal(x, data), x0, { maxIter: 2000, tol: 1e-9, scale: 0.5 });
    const mu = res.x[0];
    const sigma = Math.exp(res.x[1]);
    return { mean: mu, stdDev: sigma, lkv: -res.fx };
}

function fitWeibullMLE(data: CensoredData[]): Parameters {
    const failures = data.filter(d => d.event === 1).map(d => d.time);
    if (failures.length === 0) return { lkv: -Infinity };
    const median = failures.sort((a,b) => a-b)[Math.floor(failures.length/2)] || 1;
    const x0 = [Math.log(1.0), Math.log(median)];

    const res = nelderMead(x => negLogLikWeibull(x, data), x0, { maxIter: 2000, tol: 1e-9, scale: 0.5 });
    const beta = Math.exp(res.x[0]);
    const eta = Math.exp(res.x[1]);
    return { beta, eta, lkv: -res.fx };
}

function estimateNormalMLE(data: CensoredData[]): Parameters {
    // Placeholder - requires more complex implementation for censored Normal
    const failures = data.filter(d => d.event === 1).map(d => d.time);
    if (failures.length === 0) return { lkv: -Infinity };
    const mean = failures.reduce((a, b) => a + b, 0) / failures.length;
    const stdDev = Math.sqrt(failures.reduce((a, b) => a + (b - mean) ** 2, 0) / failures.length);
    return { mean, stdDev, lkv: -Infinity }; // LKV not accurate
}

function estimateExponentialMLE(failures: number[], suspensions: number[] = []): Parameters {
    const allTimes = [...failures, ...suspensions];
    if (failures.length === 0) return { lambda: undefined, lkv: -Infinity };
    
    const sumOfTimes = allTimes.reduce((a, b) => a + b, 0);
    const lambda = failures.length / sumOfTimes; // MLE for lambda
    
    const lkv = failures.length * Math.log(lambda) - lambda * sumOfTimes;
    
    return { lambda, lkv };
}


export function estimateParameters({ dist, failureTimes, suspensionTimes = [], method = 'SRM', isGrouped = false }: EstimateParams): { params: Parameters, plotData?: PlotData } {
    if (failureTimes.length === 0 && suspensionTimes.length === 0) return { params: {} };
    
    if (method === 'SRM' || method === 'RRX') {
        const srmResult = estimateParametersByRankRegression(dist, failureTimes, suspensionTimes, method);
        return { params: srmResult?.params ?? {}, plotData: srmResult?.plotData };
    }

    const censoredData: CensoredData[] = [
        ...failureTimes.map(t => ({ time: t, event: 1 as const })),
        ...suspensionTimes.map(t => ({ time: t, event: 0 as const }))
    ];

    let params: Parameters = {};
    if (dist === 'Weibull' && method === 'MLE') {
        params = fitWeibullMLE(censoredData);
    } else if (dist === 'Lognormal' && method === 'MLE') {
        params = fitLognormalMLE(censoredData);
    } else if (dist === 'Normal' && method === 'MLE') {
        // MLE for Normal with censoring is more complex, using RR as proxy for now
        params = estimateNormalMLE(censoredData);
    } else if (dist === 'Exponential' && method === 'MLE') {
        params = estimateExponentialMLE(failureTimes, suspensionTimes);
    } else {
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

    const mle_params = fitWeibullMLE(failureTimes.map(t => ({ time: t, event: 1 })));
    if (!mle_params.beta || !mle_params.eta || !isFinite(mle_params.beta) || !isFinite(mle_params.eta)) {
        return undefined;
    }

    const beta_mle = mle_params.beta;
    const eta_mle = mle_params.eta;
    const r = failureTimes.length;
    const chi2 = invChi2(confidenceLevel / 100, 2);

    // Calculate Fisher Information Matrix elements
    let f11 = r / (beta_mle * beta_mle); // F11 = F_bb
    let f22 = 0; // F22 = F_ee
    let f12 = 0; // F12 = F_be

    for (const ti of failureTimes) {
        if (ti <= 0) continue;
        const t_over_eta = ti / eta_mle;
        const log_t_over_eta = Math.log(t_over_eta);
        const t_pow_beta = Math.pow(t_over_eta, beta_mle);
        
        if (!isFinite(log_t_over_eta) || !isFinite(t_pow_beta)) continue;

        f11 += t_pow_beta * Math.pow(log_t_over_eta, 2);
        f22 += (beta_mle + 1) * t_pow_beta;
        f12 += t_pow_beta * (1 + beta_mle * log_t_over_eta);
    }
    
    f22 *= (beta_mle * r) / (eta_mle * eta_mle);
    f12 *= -r / eta_mle;
    
    // Essential validation
    if (!isFinite(f11) || !isFinite(f12) || !isFinite(f22)) {
        return undefined;
    }

    const det = f11 * f22 - f12 * f12;
    
    // Essential validation
    if (det <= 0 || !isFinite(det)) {
        return undefined;
    }
    
    const var_beta = f22 / det;
    const var_eta = f11 / det;
    const cov_beta_eta = -f12 / det;

    if (var_beta <= 0 || var_eta <= 0) return undefined;

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

export function findBestDistribution(failureTimes: number[], suspensionTimes: number[]): { results: DistributionAnalysisResult[]; best: Distribution | null; } {
    const distributionsToTest: Distribution[] = ['Weibull', 'Lognormal', 'Normal', 'Exponential'];
    let analysisResults: DistributionAnalysisResult[] = [];
    
    const censoredData: CensoredData[] = [
        ...failureTimes.map(t => ({ time: t, event: 1 as const })),
        ...suspensionTimes.map(t => ({ time: t, event: 0 as const }))
    ];

    for (const dist of distributionsToTest) {
        let params: Parameters = {};
        if (dist === 'Weibull') {
            params = fitWeibullMLE(censoredData);
        } else if (dist === 'Lognormal') {
            params = fitLognormalMLE(censoredData);
        } else if (dist === 'Normal') {
             params = estimateNormalMLE(censoredData);
        } else if (dist === 'Exponential') {
            params = estimateExponentialMLE(failureTimes, suspensionTimes);
        }

        const rrAnalysis = estimateParametersByRankRegression(dist, failureTimes, suspensionTimes, 'SRM');

        if (params.lkv && isFinite(params.lkv)) {
           analysisResults.push({
                distribution: dist,
                params: params,
                rSquared: rrAnalysis?.params.rho ?? 0,
                logLikelihood: params.lkv,
            });
        }
    }
    
    if (analysisResults.length === 0) {
        return { results: [], best: null };
    }

    analysisResults.sort((a, b) => (b.logLikelihood ?? -Infinity) - (a.logLikelihood ?? -Infinity));
    
    const bestDistribution = analysisResults[0].distribution;

    return { results: analysisResults, best: bestDistribution };
}
