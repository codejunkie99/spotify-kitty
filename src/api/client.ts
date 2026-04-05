import type { AppConfig } from "../config.js";

export class SpotifyApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "SpotifyApiError";
  }
}

export class SpotifyTransportError extends Error {
  constructor(
    public readonly request: string,
    public readonly requestUrl: string,
    cause: unknown,
  ) {
    super(`Unable to reach Spotify API while requesting ${request}.`, { cause });
    this.name = "SpotifyTransportError";
  }
}

type TokenProvider = () => Promise<string>;

export class SpotifyClient {
  public constructor(
    private readonly config: AppConfig,
    private readonly getToken: TokenProvider,
    private readonly hooks?: { onUnauthorized: () => Promise<void> | void },
  ) {}

  private async headers(): Promise<Record<string, string>> {
    const token = await this.getToken();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  private buildUrl(path: string, params?: Record<string, string>): URL {
    const url = new URL(`${this.config.spotifyApiBaseUrl}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }
    return url;
  }

  public async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    return this.request<T>(this.buildUrl(path, params));
  }

  public async put<T>(path: string, body?: unknown, params?: Record<string, string>): Promise<T> {
    return this.request<T>(this.buildUrl(path, params), {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public async post<T>(path: string, body?: unknown, params?: Record<string, string>): Promise<T> {
    return this.request<T>(this.buildUrl(path, params), {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public async delete<T>(path: string, body?: unknown, params?: Record<string, string>): Promise<T> {
    return this.request<T>(this.buildUrl(path, params), {
      method: "DELETE",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  private describeRequest(url: URL, init?: RequestInit): string {
    const method = (init?.method || "GET").toUpperCase();
    const apiBasePath = new URL(this.config.spotifyApiBaseUrl).pathname.replace(/\/$/, "");
    const relativePath = url.pathname.startsWith(apiBasePath)
      ? url.pathname.slice(apiBasePath.length) || "/"
      : url.pathname;
    const search = url.search || "";
    return `${method} ${relativePath}${search}`;
  }

  private async request<T>(url: URL, init?: RequestInit): Promise<T> {
    const headers = await this.headers();
    const requestDescription = this.describeRequest(url, init);

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        ...init,
        headers: { ...headers, ...(init?.headers as Record<string, string> || {}) },
      });
    } catch (error) {
      throw new SpotifyTransportError(requestDescription, url.toString(), error);
    }

    if (response.status === 204) return {} as T;

    const rawBody = await response.text();
    const hasBody = rawBody.trim().length > 0;
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    let data: unknown = {};
    if (hasBody) {
      const trimmedBody = rawBody.trim();
      const looksLikeJson = trimmedBody.startsWith("{") || trimmedBody.startsWith("[");
      if (contentType.includes("json") || looksLikeJson) {
        try {
          data = JSON.parse(rawBody);
        } catch (error) {
          throw new Error(`Invalid JSON response for ${requestDescription}.`, { cause: error });
        }
      } else {
        data = rawBody;
      }
    }

    if (!response.ok) {
      if (response.status === 401 && this.hooks?.onUnauthorized) {
        await this.hooks.onUnauthorized();
      }
      const message =
        typeof data === "string"
          ? data.trim() || `HTTP ${response.status}`
          : (data as { error_description?: string; error?: { message?: string } }).error_description ||
            (data as { error?: { message?: string } }).error?.message ||
            `HTTP ${response.status}`;
      throw new SpotifyApiError(
        response.status,
        message,
      );
    }

    return data as T;
  }
}
