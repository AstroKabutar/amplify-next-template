import { defineBackend } from '@aws-amplify/backend';
import { ManagedPolicy, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { CfnFunction } from 'aws-cdk-lib/aws-lambda';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';
import { dbBridge } from './functions/db-bridge/resource.js';

const backend = defineBackend({
  auth,
  data,
  dbBridge,
});

const req = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
};

const lambda = backend.dbBridge.resources.lambda;

// VPC attach via the CDK escape hatch (L1 override); IDs come from deploy-b.sh outputs.
(lambda.node.defaultChild as CfnFunction).vpcConfig = {
  subnetIds: [req('BRIDGE_SUBNET_ID')],
  securityGroupIds: [req('BRIDGE_SG_ID')],
};

// ENI permissions needed to run in a VPC (AWS managed policy; its EC2 actions are Resource "*").
lambda.role?.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'));

// Least privilege: read only the one DB secret.
lambda.addToRolePolicy(
  new PolicyStatement({ actions: ['secretsmanager:GetSecretValue'], resources: [req('BRIDGE_SECRET_ARN')] })
);

// Surface the deployed function name so the SSR build can pass it as DB_LAMBDA_NAME.
backend.addOutput({ custom: { dbBridgeFunctionName: lambda.functionName } });
