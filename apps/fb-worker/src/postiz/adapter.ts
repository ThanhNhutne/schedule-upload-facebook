import type { Queue } from 'bullmq';
import type {
  FacebookGroupJob,
  FacebookMarketplaceJob,
  MediaAsset,
} from '../types.js';
import { enqueueAutomationJob } from '../queue.js';
import { PostizClient } from './client.js';

export type PostizTargetMapping =
  | {
      postId: string;
      targetType: 'facebook_group';
      targetUrl: string;
      media?: MediaAsset[];
    }
  | {
      postId: string;
      targetType: 'facebook_marketplace';
      createUrl?: string;
      listing: Omit<
        FacebookMarketplaceJob['listing'],
        'description'
      > & {
        description?: string;
      };
    };

export async function syncPostizMappings(
  client: PostizClient,
  queue: Queue,
  input: {
    startDate: string;
    endDate: string;
    mappings: PostizTargetMapping[];
  },
) {
  const { posts } = await client.listPosts(
    input.startDate,
    input.endDate,
  );

  const byId = new Map(
    posts.map((post) => [post.id, post]),
  );

  const created: Array<{
    postId: string;
    jobId?: string | number;
  }> = [];

  const skipped: Array<{
    postId: string;
    reason: string;
  }> = [];

  for (const mapping of input.mappings) {
    const post = byId.get(mapping.postId);

    if (!post) {
      skipped.push({
        postId: mapping.postId,
        reason: 'POST_NOT_FOUND',
      });
      continue;
    }

    if (mapping.targetType === 'facebook_group') {
      const job: FacebookGroupJob = {
        targetType: 'facebook_group',
        targetUrl: mapping.targetUrl,
        content: post.content,
        media: mapping.media,
        scheduledAt: post.publishDate,
      };

      const queued = await enqueueAutomationJob(
        queue,
        job,
      );

      created.push({
        postId: post.id,
        jobId: queued.id,
      });

      continue;
    }

    const job: FacebookMarketplaceJob = {
      targetType: 'facebook_marketplace',
      createUrl: mapping.createUrl,
      scheduledAt: post.publishDate,
      listing: {
        ...mapping.listing,
        description:
          mapping.listing.description ||
          post.content,
      },
    };

    const queued = await enqueueAutomationJob(
      queue,
      job,
    );

    created.push({
      postId: post.id,
      jobId: queued.id,
    });
  }

  return {
    created,
    skipped,
  };
}
