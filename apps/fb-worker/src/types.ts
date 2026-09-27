export type FacebookGroupJob = {
  targetType: 'facebook_group';
  targetUrl: string;
  content: string;
};

export type PublishResult = {
  status: 'POSTED';
  targetUrl: string;
  postUrl?: string;
  publishedAt: string;
};
