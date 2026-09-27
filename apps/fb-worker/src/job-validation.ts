import type { FacebookGroupJob } from './types.js';

export function validateFacebookGroupJob(data: unknown): FacebookGroupJob {
  if (!data || typeof data !== 'object') {
    throw new Error('Job payload must be an object.');
  }

  const value = data as Partial<FacebookGroupJob>;

  if (value.targetType !== 'facebook_group') {
    throw new Error('Only targetType=facebook_group is implemented in L06.');
  }

  if (!value.targetUrl || !/^https?:\/\//i.test(value.targetUrl)) {
    throw new Error('targetUrl must be an absolute http/https URL.');
  }

  if (!value.content || !value.content.trim()) {
    throw new Error('content is required.');
  }

  return {
    targetType: 'facebook_group',
    targetUrl: value.targetUrl,
    content: value.content.trim(),
  };
}
