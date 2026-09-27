export type MediaKind = 'image' | 'video';

export type MediaAsset = {
  source: string;
  kind?: MediaKind;
};

export type FacebookGroupJob = {
  targetType: 'facebook_group';
  targetUrl: string;
  content: string;
  media?: MediaAsset[];
  scheduledAt?: string;
};

export type MarketplaceListing = {
  title: string;
  price?: number;
  currency?: string;
  category?: string;
  condition?: string;
  location?: string;
  description: string;
  media?: MediaAsset[];
};

export type FacebookMarketplaceJob = {
  targetType: 'facebook_marketplace';
  createUrl?: string;
  listing: MarketplaceListing;
  scheduledAt?: string;
};

export type FacebookPublishJob = FacebookGroupJob | FacebookMarketplaceJob;

export type PublishResult = {
  status: 'POSTED';
  targetUrl: string;
  postUrl?: string;
  publishedAt: string;
};
