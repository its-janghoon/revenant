// Tags every resource of the app (Requirement 11.2): the `revenant:*` tags group cost per
// project, and Revenant's rv-<app> resource group finds the app's resources by revenant:project.
// Revenant sets RV_PROJECT_ID on the Amplify app. Call last in amplify/backend.ts: tags(backend).
import { Tags, type Stack } from 'aws-cdk-lib';
import { app, env, name } from './name';

export function tags(backend: { stack: Stack }): void {
  const scope = backend.stack;
  const all = Tags.of(scope.node.root);
  all.add('revenant:app', app());
  all.add('revenant:env', env(scope));
  all.add('revenant:name', name(scope));

  const project = process.env.RV_PROJECT_ID?.trim();
  if (project) all.add('revenant:project', project);
}
