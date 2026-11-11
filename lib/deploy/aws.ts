// AWS clients for the deploy flow. Credentials come from the compute role only.
import "server-only";
import { AmplifyClient } from "@aws-sdk/client-amplify";
import { CloudFormationClient } from "@aws-sdk/client-cloudformation";
import { CodeCommitClient } from "@aws-sdk/client-codecommit";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { deployEnv } from "./env";

const region = deployEnv.AWS_REGION;

export const amplify = new AmplifyClient({ region });
export const cfn = new CloudFormationClient({ region });
export const codecommit = new CodeCommitClient({ region });
export const dynamo = new DynamoDBClient({ region });
export const lambda = new LambdaClient({ region });
export { region };
