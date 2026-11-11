// Tags every resource of the app (Requirement 11.2): `awsApplication` puts the app and its
// cost in the console's myApplications; `revenant:*` tags group cost per project.
// Revenant creates the app's AppRegistry application and sets RV_AWS_APPLICATION (its ARN)
// and RV_PROJECT_ID on the Amplify app. Call last in amplify/backend.ts: tags(backend).
import { Annotations, Tags, type Stack } from 'aws-cdk-lib';
import { app, env, name, sandbox } from './name';

export function tags(backend: { stack: Stack }): void {
  const scope = backend.stack;
  const all = Tags.of(scope.node.root);
  all.add('revenant:app', app());
  all.add('revenant:env', env(scope));
  all.add('revenant:name', name(scope));

  const project = process.env.RV_PROJECT_ID?.trim();
  if (project) all.add('revenant:project', project);

  const application = process.env.RV_AWS_APPLICATION?.trim();
  if (application) all.add('awsApplication', application);
  else if (sandbox(scope)) Annotations.of(scope).addWarning('RV_AWS_APPLICATION is not set; resources are not in myApplications');
  else throw new Error('RV_AWS_APPLICATION must be set to the AppRegistry application ARN');
}
