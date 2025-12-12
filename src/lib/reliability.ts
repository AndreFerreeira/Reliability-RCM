// @ts-nocheck - This is a temporary measure to allow for the use of the `jStat` library.
'use client'

import type { Supplier, ReliabilityData, ChartDataPoint, Distribution, Parameters, GumbelParams, LoglogisticParams, EstimationMethod, EstimateParams, PlotData, LRBoundsResult, ContourData, DistributionAnalysisResult, CensoredData, BudgetInput, ExpectedFailuresResult, CompetingFailureMode, CompetingModesAnalysis, AnalysisTableData } from './types';
import { medianRankTables } from './median-ranks';


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
    if (p <= 0) return 0;
    if (p >= 1) return Infinity;

    // Use a more robust approximation (Wilson-Hilferty)
    let x = invNormalCdf(p);
    let term = 1 - 2/(9*df) + x * Math.sqrt(2/(9*df));
    if (term <= 0) { // Fallback for small df or extreme p
        let approx = df + Math.sqrt(2*df)*x + (2/3)*(x*x-1);
        return Math.max(0, approx);
    }
    return df * Math.pow(term, 3);
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

const lognormalCdf = (t: number, mu: number, sigma: number) => {
    if (t <= 0) return 0;
    const z = (Math.log(t) - mu) / sigma;
    return normalCdf(z);
};

const lognormalSurvival = (t: number, mu: number, sigma: number) => {
    return 1 - lognormalCdf(t, mu, sigma);
};


const weibullPdf = (t: number, beta: number, eta: number) => {
    if (t < 0 || beta <= 0 || eta <= 0) return 0;
    return (beta / eta) * Math.pow(t / eta, beta - 1) * Math.exp(-Math.pow(t / eta, beta));
};

const weibullSurvival = (t: number, beta: number, eta: number) => {
    if (t < 0 || beta <= 0 || eta <= 0) return 1;
    return Math.exp(-Math.pow(t / eta, beta));
};

function weibullCDF(t: number, beta: number, eta: number) {
  if (t < 0 || beta <= 0 || eta <= 0) return 0;
  return 1 - Math.exp(-Math.pow(t / eta, beta));
}


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
    const allEvents: CensoredData[] = [
        ...failureTimes.map(t => ({ time: t, event: 1 as const })),
        ...suspensionTimes.map(t => ({ time: t, event: 0 as const }))
    ].sort((a, b) => a.time - b.time);

    let n = allEvents.length;
    if (n === 0) return [];
    
    const failurePoints: { time: number, prob: number }[] = [];
    let cumulativeReliability = 1.0;
    let itemsAtRisk = n;

    for (let i = 0; i < n; ) {
        const t = allEvents[i].time;
        let failuresAtT = 0;
        
        let j = i;
        while(j < n && allEvents[j].time === t) {
            if (allEvents[j].event === 1) failuresAtT++;
            j++;
        }
        
        if (failuresAtT > 0) {
            for (let k = 0; k < failuresAtT; k++) {
                 // Kaplan-Meier Product-Limit Estimator for individual failure points
                const reliabilityAtPoint = (itemsAtRisk - 1) / itemsAtRisk;
                cumulativeReliability *= reliabilityAtPoint;
                failurePoints.push({ time: t, prob: 1 - cumulativeReliability });
                itemsAtRisk--;
            }
        }
        
        // Handle suspensions at time t
        let suspensionsAtT = 0;
        let k = i + failuresAtT;
        while(k < n && allEvents[k].time === t && allEvents[k].event === 0) {
            suspensionsAtT++;
            itemsAtRisk--;
            k++;
        }

        i = j;
    }
    
    return failurePoints.sort((a, b) => a.time - b.time);
}



export function estimateParametersByRankRegression(
    dist: Distribution,
    failureTimes: number[],
    suspensionTimes: number[] = [],
    method: 'SRM' | 'RRX'
): AnalysisResult | null {
    
    const hasSuspensions = suspensionTimes.length > 0;
    const sortedFailures = [...failureTimes].sort((a, b) => a - b);
    const n = hasSuspensions ? failureTimes.length + suspensionTimes.length : failureTimes.length;
    
    let rankedPoints: {time: number, prob: number}[];

    if (hasSuspensions) {
        rankedPoints = calculateAdjustedRanks(failureTimes, suspensionTimes);
    } else {
        const rankTable = medianRankTables.find(t => t.sampleSize === n)?.data;
        if (!rankTable) { // Fallback for larger sample sizes
             rankedPoints = sortedFailures.map((time, i) => ({
                time: time,
                prob: (i + 1 - 0.3) / (n + 0.4) // Benard's approximation for Median Ranks
            }));
        } else {
            rankedPoints = sortedFailures.map((time, i) => ({
                time: time,
                prob: rankTable[i][2] // Median rank (50%)
            }));
        }
    }

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
        plotData: { points: {median: transformedPoints}, line, rSquared, angle },
        params
    };
}


function isFiniteNumber(x: any): x is number {
    return typeof x === "number" && isFinite(x);
}

/* -----------------------
   Nelder-Mead implementation (simple)
   ----------------------- */
function nelderMead(func: (x: number[]) => number, x0: number[], options: { maxIter?: number; tol?: number; scale?: number } = {}) {
    const maxIter = options.maxIter || 2000;
    const tol = options.tol || 1e-9;
    const alpha = 1, gamma = 2, rho = 0.5, sigma = 0.5;

    const n = x0.length;
    const scale = options.scale || 0.5;
    const simplex: { x: number[], fx: number }[] = [];
    simplex.push({ x: x0.slice(), fx: func(x0) });
    for (let i = 0; i < n; i++) {
        const xi = x0.slice();
        xi[i] = xi[i] + scale * (Math.abs(xi[i]) + 1);
        simplex.push({ x: xi, fx: func(xi) });
    }

    for (let iter = 0; iter < maxIter; iter++) {
        simplex.sort((a, b) => a.fx - b.fx);

        const fmean = simplex.reduce((s, v) => s + v.fx, 0) / simplex.length;
        let fvar = 0;
        for (const v of simplex) fvar += (v.fx - fmean) * (v.fx - fmean);
        fvar = fvar / simplex.length;
        if (Math.sqrt(fvar) < tol) break;

        const centroid = new Array(n).fill(0);
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) centroid[j] += simplex[i].x[j];
        }
        for (let j = 0; j < n; j++) centroid[j] /= n;

        const worst = simplex[n];

        const xr = centroid.map((c, j) => c + alpha * (c - worst.x[j]));
        const fxr = func(xr);

        if (fxr < simplex[n - 1].fx && fxr >= simplex[0].fx) {
            simplex[n] = { x: xr, fx: fxr };
            continue;
        }

        if (fxr < simplex[0].fx) {
            const xe = centroid.map((c, j) => c + gamma * (xr[j] - c));
            const fxe = func(xe);
            simplex[n] = (fxe < fxr) ? { x: xe, fx: fxe } : { x: xr, fx: fxr };
            continue;
        }

        const xc = centroid.map((c, j) => c + rho * (worst.x[j] - c));
        const fxc = func(xc);
        if (fxc < worst.fx) {
            simplex[n] = { x: xc, fx: fxc };
            continue;
        }

        for (let i = 1; i <= n; i++) {
            simplex[i].x = simplex[0].x.map((b, j) => b + sigma * (simplex[i].x[j] - b));
            simplex[i].fx = func(simplex[i].x);
        }
    }

    simplex.sort((a, b) => a.fx - b.fx);
    return { x: simplex[0].x, fx: simplex[0].fx };
}

/* -----------------------
   NLL Functions with Censoring
   ----------------------- */
function negLogLikLognormal(params: number[], data: CensoredData[]): number {
    const mu = params[0];
    const sigma = Math.exp(params[1]); // Enforce positivity
    if (!isFiniteNumber(mu) || !isFiniteNumber(sigma) || sigma <= 0) return 1e300;

    let nll = 0;
    for (const d of data) {
        if (d.event === 1) { // Failure
            const pdf = lognormalPdf(d.time, mu, sigma);
            if (!isFinite(pdf) || pdf <= 0) return 1e300;
            nll -= Math.log(pdf);
        } else { // Censored
            const S = lognormalSurvival(d.time, mu, sigma);
            if (!isFinite(S) || S <= 0) return 1e300;
            nll -= Math.log(S);
        }
    }
    return nll;
}

function negLogLikWeibull(params: number[], data: CensoredData[]): number {
    const beta = Math.exp(params[0]); // shape
    const eta = Math.exp(params[1]); // scale
    if (!isFiniteNumber(beta) || !isFiniteNumber(eta) || beta <= 0 || eta <= 0) return 1e300;
    
    let nll = 0;
    for (const d of data) {
        if (d.event === 1) { // Failure
            const pdf = weibullPdf(d.time, beta, eta);
            if (!isFinite(pdf) || pdf <= 0) return 1e300;
            nll -= Math.log(pdf);
        } else { // Censored
            const S = weibullSurvival(d.time, beta, eta);
            if (!isFinite(S) || S <= 0) return 1e300;
            nll -= Math.log(S);
        }
    }
    return nll;
}

/* -----------------------
   Fit Functions using MLE
   ----------------------- */

function fitLognormalMLE(data: CensoredData[]): Parameters {
    const failures = data.filter(d => d.event === 1).map(d => Math.log(d.time));
    if (failures.length === 0) return { lkv: -Infinity };
    
    const mu0 = failures.reduce((s, v) => s + v, 0) / failures.length;
    const sd0 = Math.sqrt(failures.reduce((s, v) => s + (v - mu0) ** 2, 0) / (failures.length > 1 ? failures.length - 1 : 1));
    const x0 = [mu0, Math.log(sd0 > 0 ? sd0 : 1)];
    
    const res = nelderMead(params => negLogLikLognormal(params, data), x0, { maxIter: 2000, tol: 1e-9 });
    const [mu, logSigma] = res.x;
    return { mean: mu, stdDev: Math.exp(logSigma), lkv: -res.fx };
}

export function fitWeibullMLE(data: CensoredData[]): Parameters {
    const failures = data.filter(d => d.event === 1).map(d => d.time);
    if (failures.length === 0) return { lkv: -Infinity };
    const median = failures.sort((a,b) => a-b)[Math.floor(failures.length/2)] || 1;
    const x0 = [Math.log(1.0), Math.log(median || 1)];

    const res = nelderMead(x => negLogLikWeibull(x, data), x0, { maxIter: 2000, tol: 1e-9 });
    const k = Math.exp(res.x[0]);
    const lambda = Math.exp(res.x[1]);
    return { beta: k, eta: lambda, lkv: -res.fx };
}

function estimateNormalMLE(data: CensoredData[]): Parameters {
    const failures = data.filter(d => d.event === 1).map(d => d.time);
    if (failures.length === 0) return { lkv: -Infinity };
    const mean = failures.reduce((a, b) => a + b, 0) / failures.length;
    const stdDev = Math.sqrt(failures.reduce((a, b) => a + (b - mean) ** 2, 0) / (failures.length > 1 ? failures.length - 1 : 1));
    let lkv = 0;
    for (const d of data) {
        if (d.event === 1) {
            const pdf = normalPdf(d.time, mean, stdDev);
            if (pdf > 0) lkv += Math.log(pdf); else return { lkv: -Infinity };
        } else {
            const S = 1 - normalCdf(d.time, mean, stdDev);
            if (S > 0) lkv += Math.log(S); else return { lkv: -Infinity };
        }
    }
    return { mean, stdDev, lkv: isFinite(lkv) ? lkv : -Infinity };
}


function estimateExponentialMLE(failures: number[], suspensions: number[] = []): Parameters {
    const allTimes = [...failures, ...suspensions];
    if (failures.length === 0) return { lambda: undefined, lkv: -Infinity };
    
    const sumOfTimes = allTimes.reduce((a, b) => a + b, 0);
    const lambda = failures.length / sumOfTimes;
    
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
        params = estimateNormalMLE(censoredData);
    } else if (dist === 'Exponential' && method === 'MLE') {
        params = estimateExponentialMLE(failureTimes, suspensionTimes);
    } else {
        return estimateParameters({ dist, failureTimes, suspensionTimes, method: 'SRM', isGrouped });
    }
    
    const plotResult = estimateParametersByRankRegression(dist, failureTimes, suspensionTimes, 'SRM');
    return { params, plotData: plotResult?.plotData };
}

function generateTimeGrid(min = 1, max = 10000, points = 80) {
  const out: number[] = [];
  const logMin = Math.log10(min);
  const logMax = Math.log10(max);
  for (let i = 0; i < points; i++) {
    out.push(Math.pow(10, logMin + (logMax - logMin) * (i / (points - 1))));
  }
  return out;
}

export function calculateLikelihoodRatioBounds(
    { times, confidenceLevel = 90, tValue = null }: { times: number[], confidenceLevel: number, tValue: number | null }
): LRBoundsResult | undefined {
    const n = times.length;
    if (n < 2) return { error: "Pelo menos 2 pontos de dados são necessários." };

    const rankTable = medianRankTables.find(t => t.sampleSize === n)?.data;
    if (!rankTable) return { error: `Tabela de postos não encontrada para n=${n}` };
    
    const sortedTimes = [...times].sort((a,b) => a-b);

    const getTransformedPoints = (rankIndex: number) => {
        return sortedTimes.map((time, i) => {
            const prob = rankTable[i][rankIndex];
            const x = Math.log(time);
            const y = Math.log(Math.log(1 / (1 - prob)));
            return { x, y, time, prob };
        }).filter(p => isFinite(p.x) && isFinite(p.y));
    };
    
    const lowerPoints = getTransformedPoints(1); // 5% rank
    const medianPoints = getTransformedPoints(2); // 50% rank
    const upperPoints = getTransformedPoints(3); // 95% rank
    
    const medianReg = performLinearRegression(medianPoints, false);
    if (!medianReg) return { error: "Falha na regressão da linha mediana." };
    
    const lowerReg = performLinearRegression(lowerPoints, false);
    if (!lowerReg) return { error: "Falha na regressão da linha inferior." };
    
    const upperReg = performLinearRegression(upperPoints, false);
    if (!upperReg) return { error: "Falha na regressão da linha superior." };
    
    const createLine = (reg: {slope:number, intercept:number}) => {
        const allX = medianPoints.map(p => p.x);
        const minX = Math.min(...allX);
        const maxX = Math.max(...allX);
        return [
            { x: minX, y: reg.slope * minX + reg.intercept },
            { x: maxX, y: reg.slope * maxX + reg.intercept },
        ];
    };

    const medianLine = createLine(medianReg);
    const lowerLine = createLine(lowerReg);
    const upperLine = createLine(upperReg);
    
    let calculation = null;
    if (tValue && isFinite(tValue) && tValue > 0) {
        const logTime = Math.log(tValue);
        calculation = {
            medianAtT: medianReg.slope * logTime + medianReg.intercept,
            lowerAtT: lowerReg.slope * logTime + lowerReg.intercept,
            upperAtT: upperReg.slope * logTime + upperReg.intercept,
        };
    }
    
    return {
      beta: medianReg.slope,
      eta: Math.exp(-medianReg.intercept / medianReg.slope),
      rSquared: medianReg.rSquared,
      confidenceLevel,
      points: { lower: lowerPoints, median: medianPoints, upper: upperPoints },
      medianLine,
      lowerLine,
      upperLine,
      calculation
    };
}


export function calculateLikelihoodRatioContour(
    failureTimes: number[],
    suspensionTimes: number[],
    confidenceLevel: number
): ContourData | undefined {
    const data: CensoredData[] = [
        ...failureTimes.map(t => ({ time: t, event: 1 as const })),
        ...suspensionTimes.map(t => ({ time: t, event: 0 as const }))
    ];

    if (data.filter(d => d.event === 1).length === 0) return undefined;

    const mle_params = fitWeibullMLE(data);
    if (!mle_params.beta || !mle_params.eta || !isFinite(mle_params.beta) || !isFinite(mle_params.eta) || !isFinite(mle_params.lkv)) {
        return undefined;
    }

    const beta_mle = mle_params.beta;
    const eta_mle = mle_params.eta;
    const ll_max = mle_params.lkv;
    
    const chi2_val = invChi2(confidenceLevel / 100, 2);
    if (!isFinite(chi2_val) || chi2_val <= 0) return undefined;
    const target_ll = ll_max - chi2_val / 2.0;

    const gridSize = 50;
    const rangeFactor = 4;
    
    const beta_sd_approx = 0.8 / Math.sqrt(failureTimes.length) * beta_mle;
    const beta_min = Math.max(0.1, beta_mle - rangeFactor * beta_sd_approx);
    const beta_max = beta_mle + rangeFactor * beta_sd_approx;

    const eta_sd_approx = (eta_mle / (beta_mle * Math.sqrt(failureTimes.length)));
    const eta_min = Math.max(1, eta_mle - rangeFactor * eta_sd_approx);
    const eta_max = eta_mle + rangeFactor * eta_sd_approx;
    
    const beta_step = (beta_max - beta_min) / gridSize;
    const eta_step = (eta_max - eta_min) / gridSize;
    
    const grid: number[][] = [];
    for (let i = 0; i <= gridSize; i++) {
        const row: number[] = [];
        for (let j = 0; j <= gridSize; j++) {
            const beta = beta_min + i * beta_step;
            const eta = eta_min + j * eta_step;
            const nll = negLogLikWeibull([Math.log(beta), Math.log(eta)], data);
            row.push(-nll);
        }
        grid.push(row);
    }
    
    const contourPaths: [number, number][][] = [];
    const targetIsovalue = target_ll;

    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            const cell_values = [ grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1] ];
            let case_index = 0;
            if (cell_values[0] > targetIsovalue) case_index |= 1;
            if (cell_values[1] > targetIsovalue) case_index |= 2;
            if (cell_values[2] > targetIsovalue) case_index |= 4;
            if (cell_values[3] > targetIsovalue) case_index |= 8;
            
            if (case_index === 0 || case_index === 15) continue;

            const cell_coords = [
                [beta_min + i * beta_step, eta_min + j * eta_step],
                [beta_min + (i + 1) * beta_step, eta_min + j * eta_step],
                [beta_min + (i + 1) * beta_step, eta_min + (j + 1) * eta_step],
                [beta_min + i * beta_step, eta_min + (j + 1) * eta_step],
            ];
            
            const interp = (p1_idx: number, p2_idx: number) => {
                 const v1 = cell_values[p1_idx];
                 const v2 = cell_values[p2_idx];
                 const c1 = cell_coords[p1_idx];
                 const c2 = cell_coords[p2_idx];
                 const t = (targetIsovalue - v1) / (v2 - v1);
                 return [c1[0] * (1 - t) + c2[0] * t, c1[1] * (1-t) + c2[1] * t];
            };
            
            const segments = [];
            if (case_index === 1 || case_index === 14) segments.push([interp(0,3), interp(0,1)]);
            if (case_index === 2 || case_index === 13) segments.push([interp(0,1), interp(1,2)]);
            if (case_index === 3 || case_index === 12) segments.push([interp(0,3), interp(1,2)]);
            if (case_index === 4 || case_index === 11) segments.push([interp(1,2), interp(2,3)]);
            if (case_index === 5) { segments.push([interp(0,1),interp(1,2)]); segments.push([interp(0,3),interp(2,3)])};
            if (case_index === 6 || case_index === 9) segments.push([interp(0,1), interp(2,3)]);
            if (case_index === 7 || case_index === 8) segments.push([interp(0,3), interp(2,3)]);
            if (case_index === 10) { segments.push([interp(0,3),interp(1,2)]); segments.push([interp(0,1),interp(2,3)])};
            contourPaths.push(...segments);
        }
    }
    
    if (contourPaths.length === 0) return undefined;
    
    const stitched = contourPaths.shift() || [];
    while (contourPaths.length > 0) {
        const last_point = stitched[stitched.length - 1];
        let best_match_idx = -1;
        let min_dist = Infinity;
        let reverse_order = false;

        for (let i = 0; i < contourPaths.length; i++) {
            const dist1 = Math.hypot(last_point[0] - contourPaths[i][0][0], last_point[1] - contourPaths[i][0][1]);
            const dist2 = Math.hypot(last_point[0] - contourPaths[i][1][0], last_point[1] - contourPaths[i][1][1]);
            if (dist1 < min_dist) { min_dist = dist1; best_match_idx = i; reverse_order = false; }
            if (dist2 < min_dist) { min_dist = dist2; best_match_idx = i; reverse_order = true; }
        }
        if (best_match_idx !== -1) {
            const match = contourPaths.splice(best_match_idx, 1)[0];
            stitched.push(reverse_order ? match[0] : match[1]);
        } else { break; }
    }
    
    const ellipsePoints = stitched.map(p => [p[1], p[0]]); // swap to [eta, beta]
    
    if (ellipsePoints.length === 0) return undefined;
    
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
            R_t = weibullSurvival(time, params.beta, params.eta);
            F_t = 1 - R_t;
            f_t = weibullPdf(time, params.beta, params.eta);
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
            F_t = lognormalCdf(time, params.mean, params.stdDev);
            R_t = 1 - F_t;
            f_t = lognormalPdf(time, params.mean, params.stdDev);
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

export function getFailureProbWithBounds(t: number, T: number, beta: number, eta: number, n: number, confidence: number) {
    const z = invNormalCdf(1 - (1 - confidence) / 2);
    
    const var_b = beta * beta / n;
    const var_k = eta * eta / (n * beta * beta);
    const cov_bk = 0.277 * beta * eta / n;

    if (t === 0) {
        const medianF = weibullCDF(T, beta, eta);
        if (!isFinite(medianF) || medianF <= 0 || medianF >= 1) {
            return { li: medianF, median: medianF, ls: medianF };
        }
        const dFdb = -Math.pow(T / eta, beta) * Math.log(T / eta) * Math.exp(-Math.pow(T / eta, beta));
        const dFdk = Math.pow(T / eta, beta) * (beta / eta) * Math.exp(-Math.pow(T / eta, beta));
        const var_F = dFdb*dFdb * var_b + dFdk*dFdk * var_k + 2*dFdb*dFdk * cov_bk;

        if(var_F < 0 || !(1 - medianF > 0) || !isFinite(var_F)) {
            return { li: medianF, median: medianF, ls: medianF };
        }
        const w = Math.exp( (z * Math.sqrt(var_F)) / ( (1 - medianF) * Math.log(1 / (1 - medianF)) ) );
        const li = 1 - Math.pow(1 - medianF, 1/w);
        const ls = 1 - Math.pow(1 - medianF, w);
        return { li: li, median: medianF, ls: ls };
    }

    const R_t = weibullSurvival(t, beta, eta);
    const R_t_plus_T = weibullSurvival(t + T, beta, eta);

    const probFailureMedian = R_t > 1e-9 ? (R_t - R_t_plus_T) / R_t : 1;
    
    if (!isFinite(R_t) || R_t <= 1e-9) {
      return { li: probFailureMedian, median: probFailureMedian, ls: probFailureMedian };
    }

    const dPdb_term1 = -Math.pow((t+T)/eta, beta) * Math.log((t+T)/eta) * R_t_plus_T;
    const dPdb_term2 = -(-Math.pow(t/eta, beta) * Math.log(t/eta) * R_t);
    const dPdb = (1/R_t) * (dPdb_term1 - dPdb_term2) - ((R_t - R_t_plus_T) / (R_t * R_t)) * dPdb_term2;

    const dPdk_term1 = R_t_plus_T * (beta/eta) * Math.pow((t+T)/eta, beta);
    const dPdk_term2 = R_t * (beta/eta) * Math.pow(t/eta, beta);
    const dPdk = (1/R_t) * (dPdk_term1 - dPdk_term2) + ((R_t - R_t_plus_T) / (R_t*R_t)) * dPdk_term2;

    const var_P = dPdb*dPdb * var_b + dPdk*dPdk * var_k + 2 * dPdb*dPdk * cov_bk;
    
    if (var_P < 0 || !isFinite(var_P)) {
        return { li: probFailureMedian, median: probFailureMedian, ls: probFailureMedian };
    }

    const se_P = Math.sqrt(var_P);
    const probFailureLi = Math.max(0, probFailureMedian - z * se_P);
    const probFailureLs = Math.min(1, probFailureMedian + z * se_P);

    return { li: probFailureLi, median: probFailureMedian, ls: probFailureLs };
}

export function calculateExpectedFailures(input: BudgetInput): ExpectedFailuresResult {
    const { beta, eta, items, period, confidenceLevel } = input;
    const n = input.failureTimes?.length ?? items.reduce((sum, item) => sum + item.quantity, 0);

    const details = items.map(item => {
        const { age, quantity } = item;
        const {li: probLi, median: probMedian, ls: probLs} = getFailureProbWithBounds(age, period, beta, eta, n, confidenceLevel);

        return {
            age,
            quantity,
            li: probLi * quantity,
            median: probMedian * quantity,
            ls: probLs * quantity,
        };
    });

    const totals = details.reduce((acc, current) => {
        acc.li += current.li;
        acc.median += current.median;
        acc.ls += current.ls;
        return acc;
    }, { li: 0, median: 0, ls: 0 });

    return { details, totals };
}

export function analyzeCompetingFailureModes(
    modes: CompetingFailureMode[],
    period: number
): CompetingModesAnalysis | null {
    if (modes.length === 0) {
        return null;
    }

    const allDataPoints = modes.flatMap(m => m.times.map(t => ({ time: t, originalMode: m.name })));
    allDataPoints.sort((a, b) => a.time - b.time);

    const analysisTables: AnalysisTableData[] = modes.map(currentMode => {
        const dataRows = allDataPoints.map(dp => ({
            time: dp.time,
            status: dp.originalMode === currentMode.name ? 'F' : 'S',
            originalMode: dp.originalMode
        }));
        return { modeName: currentMode.name, dataRows };
    });

    const modeAnalyses = modes.map(currentMode => {
        const failureTimes = currentMode.times;
        const suspensionTimes = allDataPoints
            .filter(dp => dp.originalMode !== currentMode.name)
            .map(dp => dp.time);
        
        const analysis = estimateParameters({ 
            dist: 'Weibull', 
            failureTimes,
            suspensionTimes, 
            method: 'MLE' 
        });
        
        return { ...currentMode, ...analysis };
    });

    const timePoints = generateTimeGrid(1, period * 1.2, 100);

    const systemReliability: ChartDataPoint[] = timePoints.map(t => {
        let system_R_t = 1;
        const point: ChartDataPoint = { time: t };

        modeAnalyses.forEach(mode => {
            if (mode.params.beta && mode.params.eta) {
                const mode_R_t = weibullSurvival(t, mode.params.beta, mode.params.eta);
                point[mode.name] = mode_R_t;
                system_R_t *= mode_R_t;
            }
        });

        point['Sistema'] = system_R_t;
        return point;
    });

    const failureProbabilities = modeAnalyses.map(mode => {
        let prob = 0;
        if (mode.params.beta && mode.params.eta) {
            prob = weibullCDF(period, mode.params.beta, mode.params.eta);
        }
        return {
            name: mode.name,
            probability: prob,
        };
    }).sort((a,b) => b.probability - a.probability);


    return {
        analyses: modeAnalyses,
        reliabilityData: systemReliability,
        failureProbabilities,
        period,
        tables: analysisTables,
    };
}
