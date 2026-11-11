// The part of an Amplify function (`backend.<name>` for a defineFunction resource) blocks use.
import type { IFunction } from 'aws-cdk-lib/aws-lambda';

export type Fn = {
  resources: { lambda: IFunction };
  addEnvironment(name: string, value: string): void;
};
