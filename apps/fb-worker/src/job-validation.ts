import { PermanentAutomationError } from './errors.js';
import type {
  FacebookGroupJob,
  FacebookMarketplaceJob,
  FacebookPublishJob,
  MediaAsset,
} from './types.js';

function validateScheduledAt(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;

  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new PermanentAutomationError(
      'scheduledAt must be an ISO date string.',
    );
  }

  return value;
}

function validateMedia(value: unknown): MediaAsset[] | undefined {
  if (value === undefined) return undefined;

  if (!Array.isArray(value)) {
    throw new PermanentAutomationError('media must be an array.');
  }

  return value.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new PermanentAutomationError(
        'Each media item must be an object.',
      );
    }

    const media = item as Partial<MediaAsset>;

    if (!media.source || typeof media.source !== 'string') {
      throw new PermanentAutomationError('media.source is required.');
    }

    if (
      media.kind &&
      media.kind !== 'image' &&
      media.kind !== 'video'
    ) {
      throw new PermanentAutomationError(
        'media.kind must be image or video.',
      );
    }

    return {
      source: media.source,
      ...(media.kind ? { kind: media.kind } : {}),
    };
  });
}

function validateGroup(
  value: Record<string, unknown>,
): FacebookGroupJob {
  const targetUrl = value.targetUrl;
  const content = value.content;

  if (
    typeof targetUrl !== 'string' ||
    !/^https?:\/\//i.test(targetUrl)
  ) {
    throw new PermanentAutomationError(
      'targetUrl must be an absolute http/https URL.',
    );
  }

  if (typeof content !== 'string' || !content.trim()) {
    throw new PermanentAutomationError('content is required.');
  }

  return {
    targetType: 'facebook_group',
    targetUrl,
    content: content.trim(),
    media: validateMedia(value.media),
    scheduledAt: validateScheduledAt(value.scheduledAt),
  };
}

function validateMarketplace(
  value: Record<string, unknown>,
): FacebookMarketplaceJob {
  if (!value.listing || typeof value.listing !== 'object') {
    throw new PermanentAutomationError('listing is required.');
  }

  const listing = value.listing as Record<string, unknown>;

  if (
    typeof listing.title !== 'string' ||
    !listing.title.trim()
  ) {
    throw new PermanentAutomationError(
      'listing.title is required.',
    );
  }

  if (
    typeof listing.description !== 'string' ||
    !listing.description.trim()
  ) {
    throw new PermanentAutomationError(
      'listing.description is required.',
    );
  }

  if (
    listing.price !== undefined &&
    (typeof listing.price !== 'number' ||
      !Number.isFinite(listing.price))
  ) {
    throw new PermanentAutomationError(
      'listing.price must be a number.',
    );
  }

  const optionalString = (key: string): string | undefined => {
    const raw = listing[key];

    if (raw === undefined || raw === null || raw === '') {
      return undefined;
    }

    if (typeof raw !== 'string') {
      throw new PermanentAutomationError(
        `listing.${key} must be a string.`,
      );
    }

    return raw;
  };

  const createUrl =
    typeof value.createUrl === 'string' && value.createUrl
      ? value.createUrl
      : undefined;

  if (createUrl && !/^https?:\/\//i.test(createUrl)) {
    throw new PermanentAutomationError(
      'createUrl must be an absolute URL.',
    );
  }

  return {
    targetType: 'facebook_marketplace',
    createUrl,
    scheduledAt: validateScheduledAt(value.scheduledAt),
    listing: {
      title: listing.title.trim(),
      price: listing.price as number | undefined,
      currency: optionalString('currency'),
      category: optionalString('category'),
      condition: optionalString('condition'),
      location: optionalString('location'),
      description: listing.description.trim(),
      media: validateMedia(listing.media),
    },
  };
}

export function validateFacebookJob(
  data: unknown,
): FacebookPublishJob {
  if (!data || typeof data !== 'object') {
    throw new PermanentAutomationError(
      'Job payload must be an object.',
    );
  }

  const value = data as Record<string, unknown>;

  if (value.targetType === 'facebook_group') {
    return validateGroup(value);
  }

  if (value.targetType === 'facebook_marketplace') {
    return validateMarketplace(value);
  }

  throw new PermanentAutomationError(
    'targetType must be facebook_group or facebook_marketplace.',
  );
}

export const validateFacebookGroupJob = (
  data: unknown,
): FacebookGroupJob => {
  const job = validateFacebookJob(data);

  if (job.targetType !== 'facebook_group') {
    throw new PermanentAutomationError(
      'Expected a facebook_group job.',
    );
  }

  return job;
};
