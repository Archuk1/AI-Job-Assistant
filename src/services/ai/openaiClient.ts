import OpenAI from 'openai';
import { env } from '../../config/env';

export const openai = new OpenAI({ apiKey: env.AI_API_KEY, baseURL: env.AI_BASE_URL });
