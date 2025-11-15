'use server';

import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-1.5-flash-latest',
});
