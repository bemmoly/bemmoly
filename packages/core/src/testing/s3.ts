import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { GenericContainer, getContainerRuntimeClient, Wait } from 'testcontainers';
import { adoptDockerCliContext } from './docker-context.ts';

/**
 * MinIO for integration tests that need a real S3-compatible bucket. The upstream images
 * are no longer published, so this is the Chainguard build, pinned by digest.
 */
export const S3_TEST_IMAGE =
  'cgr.dev/chainguard/minio@sha256:7df55d002b698e4494a131b848dd553361bbe58b7e19f62d9623c29af1ba9ccf';

const ACCESS_KEY_ID = 'bemmoly-test';
const SECRET_ACCESS_KEY = 'bemmoly-test-secret';
const PORT = 9000;

export interface TestS3Credentials {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: true;
}

export type TestS3 =
  | (TestS3Credentials & {
      available: true;
      createBucket(name: string): Promise<void>;
      stop(): Promise<void>;
    })
  | { available: false; reason: string };

/** Starts MinIO through Testcontainers, or says why it cannot (no container runtime). */
export async function startTestS3(): Promise<TestS3> {
  adoptDockerCliContext();
  try {
    await getContainerRuntimeClient();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { available: false, reason: `Skipped: no container runtime for MinIO (${detail})` };
  }
  const container = await new GenericContainer(S3_TEST_IMAGE)
    .withCommand(['server', '/tmp/data'])
    .withEnvironment({ MINIO_ROOT_USER: ACCESS_KEY_ID, MINIO_ROOT_PASSWORD: SECRET_ACCESS_KEY })
    .withExposedPorts(PORT)
    .withWaitStrategy(Wait.forHttp('/minio/health/ready', PORT).forStatusCode(200))
    .start();
  const credentials: TestS3Credentials = {
    endpoint: `http://${container.getHost()}:${container.getMappedPort(PORT)}`,
    region: 'us-east-1',
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
    forcePathStyle: true,
  };
  const admin = new S3Client({
    endpoint: credentials.endpoint,
    region: credentials.region,
    forcePathStyle: true,
    credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY },
  });
  return {
    available: true,
    ...credentials,
    async createBucket(name) {
      await admin.send(new CreateBucketCommand({ Bucket: name }));
    },
    async stop() {
      admin.destroy();
      await container.stop();
    },
  };
}
