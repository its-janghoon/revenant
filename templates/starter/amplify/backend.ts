import { defineBackend } from '@aws-amplify/backend';
import { tags } from '../blocks/tags';
import { auth } from './auth/resource';
import { data } from './data/resource';

const backend = defineBackend({ auth, data });

// Add blocks here (files, mail, ai, cron) when the spec needs them. See blocks/README.md.

tags(backend);
