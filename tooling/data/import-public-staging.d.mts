export interface PublicSnapshot {
  posts: Array<{
    id: number;
    text: string;
    photos: string[];
    tags: string[];
    source: "instagram";
    instagramId: string;
    sortOrder: number;
    published: true;
    status: "published";
    target: "feed";
    scheduledAt: null;
    publishedAt: string | null;
    richText: null;
    createdAt: string;
    updatedAt: string;
  }>;
  videos: Array<{
    id: number;
    youtubeId: string;
    title: string;
    duration: string | null;
    thumbnailUrl: string | null;
    videoUrl: null;
    views: string | null;
    publishedText: string | null;
    sortOrder: number;
    published: true;
    createdAt: string;
    updatedAt: string;
  }>;
  tags: Array<{
    id: number;
    slug: string;
    label: string;
    category: "season" | "topic";
    sortOrder: number;
  }>;
}
export interface ImportReport {
  applied: boolean;
  posts: number;
  videos: number;
  tags: number;
  photos: number;
}
export interface ImportConnection {
  query(sql: string, values?: unknown[]): Promise<unknown>;
  execute(sql: string, values: unknown[]): Promise<unknown>;
  beginTransaction(): Promise<unknown>;
  commit(): Promise<unknown>;
  rollback(): Promise<unknown>;
}
export function preparePublicSnapshot(input: unknown): PublicSnapshot;
export function assertStagingDestination(
  database: string | undefined,
  app: string | undefined,
): void;
export function exportPublicSnapshot(): Promise<PublicSnapshot>;
export function importPublicContent(
  db: ImportConnection,
  input: unknown,
  options: {
    database: string;
    app: string;
    apply?: boolean;
  },
): Promise<ImportReport>;
