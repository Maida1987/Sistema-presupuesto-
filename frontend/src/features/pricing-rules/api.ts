import { apiFetch } from '../../api/client';
import type { CreatePricingRuleInput, PricingRule } from './types';

export function fetchPricingRules(): Promise<PricingRule[]> {
  return apiFetch<PricingRule[]>('/pricing-rules');
}

export function createPricingRule(input: CreatePricingRuleInput): Promise<PricingRule> {
  return apiFetch<PricingRule>('/pricing-rules', { method: 'POST', body: JSON.stringify(input) });
}
