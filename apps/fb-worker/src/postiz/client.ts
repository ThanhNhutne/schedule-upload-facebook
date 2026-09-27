export type PostizPost = {
  id: string;
  content: string;
  publishDate: string;
  releaseURL?: string | null;
  state?: string;
  integration?: {
    id: string;
    providerIdentifier?: string;
    name?: string;
  };
};

export class PostizClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
  ) {}

  private async request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const response = await fetch(
      `${this.baseUrl.replace(/\/$/, '')}${path}`,
      {
        ...init,
        headers: {
          Authorization: this.apiKey,
          ...(init.body
            ? { 'Content-Type': 'application/json' }
            : {}),
          ...(init.headers || {}),
        },
        signal:
          init.signal ||
          AbortSignal.timeout(30_000),
      },
    );

    const text = await response.text();
    const body = text ? JSON.parse(text) : null;

    if (!response.ok) {
      throw new Error(
        `Postiz API ${response.status}: ${JSON.stringify(body)}`,
      );
    }

    return body as T;
  }

  isConnected() {
    return this.request<{ connected: boolean }>(
      '/public/v1/is-connected',
    );
  }

  integrations() {
    return this.request<Array<Record<string, unknown>>>(
      '/public/v1/integrations',
    );
  }

  async listPosts(
    startDate: string,
    endDate: string,
  ) {
    const query = new URLSearchParams({
      startDate,
      endDate,
    });

    return this.request<{ posts: PostizPost[] }>(
      `/public/v1/posts?${query.toString()}`,
    );
  }

  createPost(body: unknown) {
    return this.request<unknown>(
      '/public/v1/posts',
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    );
  }
}
