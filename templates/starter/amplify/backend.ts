import { defineBackend } from '@aws-amplify/backend';
import { data as dataBlock } from '../blocks/data';
import { tags } from '../blocks/tags';
import { auth } from './auth/resource';
import { data } from './data/resource';

const backend = defineBackend({ auth, data });

// Keeps the tables on prod (retained, deletion protected, point-in-time recovery); previews drop theirs.
dataBlock(backend);

// Add blocks here (files, mail, ai, cron) when the spec needs them. See blocks/README.md.

tags(backend);
