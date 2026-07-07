import { createHash } from 'node:crypto';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export type ArtifactFormat = 'pptx' | 'pdf';

export type StoredArtifactInput = {
  key: string;
  body: Buffer;
  contentType: string;
  filename: string;
};

export type StoredArtifactMeta = {
  key: string;
  sizeBytes: number;
  sha256: string;
};

const DEFAULT_SIGNED_URL_TTL_SECONDS = 10 * 60;

let cachedClient: S3Client | null = null;

function readEnv(name: string): string {
  return String(process.env[name] || '').trim();
}

export function isArtifactAccelerationEnabled(): boolean {
  if (process.env.DOWNLOAD_ACCELERATION_ENABLED === 'false') return false;
  return Boolean(
    readEnv('R2_ACCOUNT_ID')
    && readEnv('R2_ACCESS_KEY_ID')
    && readEnv('R2_SECRET_ACCESS_KEY')
    && readEnv('R2_BUCKET')
  );
}

function getR2Bucket(): string {
  const bucket = readEnv('R2_BUCKET');
  if (!bucket) throw new Error('R2_BUCKET 未配置');
  return bucket;
}

function getR2Client(): S3Client {
  if (cachedClient) return cachedClient;

  const accountId = readEnv('R2_ACCOUNT_ID');
  const accessKeyId = readEnv('R2_ACCESS_KEY_ID');
  const secretAccessKey = readEnv('R2_SECRET_ACCESS_KEY');

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY 未配置');
  }

  cachedClient = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  return cachedClient;
}

export function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function sanitizeDownloadFilename(filename: string, fallback: string): string {
  const trimmed = (filename || '').trim() || fallback;
  return trimmed.replace(/[^\w\u4e00-\u9fff.\-]/g, '_');
}

export function buildArtifactObjectKey(format: ArtifactFormat, generationId: string, sha256: string): string {
  const safeGenerationId = generationId.replace(/[^\w.-]/g, '_').slice(0, 120) || 'unknown';
  return `${format}/${safeGenerationId}/${sha256.slice(0, 16)}.${format}`;
}

export async function putArtifactObject(input: StoredArtifactInput): Promise<StoredArtifactMeta> {
  const sha256 = sha256Hex(input.body);

  await getR2Client().send(new PutObjectCommand({
    Bucket: getR2Bucket(),
    Key: input.key,
    Body: input.body,
    ContentType: input.contentType,
    ContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(input.filename)}`,
    CacheControl: 'private, max-age=0, no-transform',
    Metadata: {
      sha256,
      filename: encodeURIComponent(input.filename),
    },
  }));

  return {
    key: input.key,
    sizeBytes: input.body.length,
    sha256,
  };
}

export async function artifactObjectExists(key: string): Promise<boolean> {
  try {
    await getR2Client().send(new HeadObjectCommand({
      Bucket: getR2Bucket(),
      Key: key,
    }));
    return true;
  } catch {
    return false;
  }
}

export async function createArtifactSignedDownloadUrl(args: {
  key: string;
  filename: string;
  contentType: string;
  expiresIn?: number;
}): Promise<string> {
  const safeFilename = sanitizeDownloadFilename(args.filename, 'shengxin-ppt.pptx');
  const command = new GetObjectCommand({
    Bucket: getR2Bucket(),
    Key: args.key,
    ResponseContentType: args.contentType,
    ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(safeFilename)}`,
  });

  return getSignedUrl(getR2Client(), command, {
    expiresIn: args.expiresIn || DEFAULT_SIGNED_URL_TTL_SECONDS,
  });
}
