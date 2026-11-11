// Private file storage on S3 (Amplify Storage). Each signed-in user gets their own folder;
// the frontend uploads with `uploadData` and reads with `getUrl` (presigned URLs) from
// `aws-amplify/storage`.
//
//   amplify/storage/resource.ts:  import { defineStorage } from '@aws-amplify/backend';
//                                 import { files } from '../../blocks/files';
//                                 export const storage = defineStorage(files.props());
//   amplify/backend.ts:           const backend = defineBackend({ auth, data, storage }); files(backend);
//
// Amplify only accepts defineStorage called in amplify/storage/resource.ts itself, so this
// block gives the settings and the app makes the call.
import type { defineStorage } from '@aws-amplify/backend';
import { RemovalPolicy } from 'aws-cdk-lib';
import type { CfnBucket } from 'aws-cdk-lib/aws-s3';
import type { IConstruct } from 'constructs';

type StorageProps = Parameters<typeof defineStorage>[0];

function props(friendly = 'files'): StorageProps {
  return {
    name: friendly,
    // Keep the bucket when the stack goes away. Without it Amplify adds auto-delete, which
    // cannot be combined with the retained bucket below (Requirement 10.1).
    keepOnDelete: true,
    access: (allow) => ({
      'private/{entity_id}/*': [allow.entity('identity').to(['read', 'write', 'delete'])],
    }),
  };
}

type WithStorage = {
  storage: { resources: { bucket: IConstruct; cfnResources: { cfnBucket: CfnBucket } } };
};

// Keeps the bucket and old versions of every file when the stack goes away (Requirement 10.1).
export function files(backend: WithStorage): void {
  const { bucket: l2, cfnResources } = backend.storage.resources;
  if (l2.node.tryFindChild('AutoDeleteObjectsCustomResource')) {
    throw new Error(
      'blocks/files: the bucket was defined without keepOnDelete. In amplify/storage/resource.ts use ' +
        "`export const storage = defineStorage(files.props())` (import { files } from '../../blocks/files').",
    );
  }
  const bucket = cfnResources.cfnBucket;
  bucket.applyRemovalPolicy(RemovalPolicy.RETAIN);
  bucket.versioningConfiguration = { status: 'Enabled' };
  bucket.publicAccessBlockConfiguration = {
    blockPublicAcls: true,
    blockPublicPolicy: true,
    ignorePublicAcls: true,
    restrictPublicBuckets: true,
  };
}

files.props = props;
