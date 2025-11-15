import { config } from 'dotenv';
config();

import '@/ai/flows/summarize-supplier-reliability.ts';
import '@/ai/flows/generate-reliability-report.ts';
import '@/ai/flows/predict-failure-risk-factors.ts';