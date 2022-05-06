import { CloudFrontStack } from '@stacks/cloudfront';
import {
  App,
  CfnOutput,
  Duration,
  PhysicalName,
  RemovalPolicy,
  Stack,
  StackProps,
} from 'aws-cdk-lib';
import { PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import {
  AssetCode,
  Function,
  FunctionUrl,
  FunctionUrlAuthType,
  Runtime,
} from 'aws-cdk-lib/aws-lambda';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

import config from './config.json';

/* -----------------------------------------------------------------------------
 * Stack
 * ---------------------------------------------------------------------------*/

class FunctionUrlStack extends Stack {
  functionUrl: FunctionUrl;
  edgeFunctionPolicy: PolicyStatement;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const lambdaRole = new Role(this, 'lambdaRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      description: 'Managed by Terraform Next.js',
    });

    lambdaRole.addToPolicy(
      new PolicyStatement({
        actions: ['logs:PutLogEvents', 'logs:CreateLogStream'],
        resources: ['arn:aws:logs:*:*:log-group:/aws/lambda/*'],
      })
    );

    const lambdaFn = new Function(this, 'Handler', {
      functionName: PhysicalName.GENERATE_IF_NEEDED,
      runtime: Runtime.NODEJS_14_X,
      handler: 'app.handler',
      code: new AssetCode('./lambda'),
      role: lambdaRole,
      timeout: Duration.seconds(29),
      memorySize: 128,
    });

    this.functionUrl = lambdaFn.addFunctionUrl({
      authType: FunctionUrlAuthType.AWS_IAM,
    });

    // CloudWatch LogGroup for Lambda
    new LogGroup(this, 'logGroupHandler', {
      logGroupName: `/aws/lambda/${lambdaFn.functionName}`,
      retention: RetentionDays.FIVE_DAYS,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Create the policy statement that should be added to the edge function
    this.edgeFunctionPolicy = new PolicyStatement({
      actions: ['lambda:InvokeFunctionUrl'],
      resources: [lambdaFn.functionArn],
    });

    new CfnOutput(this, 'url', {
      value: this.functionUrl.url,
    });
  }
}

/* -----------------------------------------------------------------------------
 * App
 * ---------------------------------------------------------------------------*/

const app = new App();
const functionUrlStack = new FunctionUrlStack(app, 'test-apigw', {
  env: {
    region: config.region,
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
});

new CloudFrontStack(app, 'distribution', {
  apiUrl: functionUrlStack.functionUrl.url,
  attachPolicy: functionUrlStack.edgeFunctionPolicy,
  env: {
    region: config.region,
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
});

app.synth();
