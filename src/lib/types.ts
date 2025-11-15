export interface WeibullParams {
  beta: number; // shape parameter
  eta: number;  // scale parameter (characteristic life)
}

export interface Supplier extends WeibullParams {
  id: string;
  name: string;
  failureTimes: number[];
  color: string;
}

export interface ChartDataPoint {
  time: number;
  [supplierName: string]: number;
}

export interface ReliabilityData {
  Rt: ChartDataPoint[];
  Ft: ChartDataPoint[];
  ft: ChartDataPoint[];
  lambda_t: ChartDataPoint[];
}
