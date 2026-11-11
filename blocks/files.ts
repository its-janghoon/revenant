// Private file storage on S3 (Amplify Storage). Each signed-in user gets their own folder;
// the frontend uploads with `uploadData` and reads with `getUrl` (presigned URLs) from
// `aws-amplify/storage`.
//
//   amplify/storage/resource.ts:  export const storage = files.define();
//   amplify/backend.ts:           const backend = defineBackend({ auth, data, storage }); files(backend);
import { defineStorage } from '@aws-amplify/backend';
import { RemovalPolicy } from 'aws-cdk-lib';
import type { CfnBucket } from 'aws-cdk-lib/aws-s3';

function define(friendly = 'files') {
  return defineStorage({
    name: friendly,
    access: (allow) => ({
      'private/{entity_id}/*': [allow.entity('identity').to(['read', 'write', 'delete'])],
    }),
  });
}

type WithStorage = { storage: { resources: { cfnResources: { cfnBucket: CfnBucket } } } };

// Keeps the bucket and old versions of every file when the stack goes away (Requirement 10.1).
export function files(backend: WithStorage): void {
  const bucket = backend.storage.resources.cfnResources.cfnBucket;
  bucket.applyRemovalPolicy(RemovalPolicy.RETAIN);
  bucket.versioningConfiguration = { status: 'Enabled' };
  bucket.publicAccessBlockConfiguration = {
    blockPublicAcls: true,
    blockPublicPolicy: true,
    ignorePublicAcls: true,
    restrictPublicBuckets: true,
  };
}

files.define = define;
