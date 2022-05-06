import { CloudFrontStack } from '@stacks/cloudfront';
import {
  HttpApi,
  HttpAuthorizer,
  HttpAuthorizerType,
  HttpMethod,
  PayloadFormatVersion,
} from '@aws-cdk/aws-apigatewayv2-alpha';
import { HttpLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import {
  App,
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  StackProps,
} from 'aws-cdk-lib';
import { PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { AssetCode, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

import config from './config.json';

class ApiGatewayStack extends Stack {
  edgeFunctionPolicy: PolicyStatement;
  httpApi: HttpApi;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    /* -------------------------------------------------------------------------
     * Lambda
     * -----------------------------------------------------------------------*/

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

    // Lambda
    const lambdaFn = new Function(this, 'Handler', {
      runtime: Runtime.NODEJS_14_X,
      handler: 'app.handler',
      code: new AssetCode('./lambda'),
      role: lambdaRole,
      timeout: Duration.seconds(29),
      memorySize: 128,
    });

    // CloudWatch LogGroup for Lambda
    new LogGroup(this, 'logGroupHandler', {
      logGroupName: `/aws/lambda/${lambdaFn.functionName}`,
      retention: RetentionDays.FIVE_DAYS,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    /* -------------------------------------------------------------------------
     * API Gateway
     * -----------------------------------------------------------------------*/

    this.httpApi = new HttpApi(this, 'ApiGateway');

    const lambdaIntegration = new HttpLambdaIntegration(
      'lambdaIntegrationHandler',
      lambdaFn,
      {
        payloadFormatVersion: PayloadFormatVersion.VERSION_2_0,
      }
    );

    this.httpApi.addRoutes({
      path: '/{proxy+}',
      methods: [HttpMethod.ANY],
      integration: lambdaIntegration,
      authorizer: HttpAuthorizer.fromHttpAuthorizerAttributes(
        this,
        'IAMAuthorizer',
        {
          authorizerId: '',
          authorizerType: HttpAuthorizerType.IAM,
        }
      ),
    });

    // Create the policy statement that should be added to the edge function
    this.edgeFunctionPolicy = new PolicyStatement({
      actions: ['execute-api:Invoke'],
      // `arn:aws:execute-api:${region}:${account}:${restApi.restApiId}/*`,
      resources: ['arn:aws:execute-api:*:*:*/*'],
    });

    new CfnOutput(this, 'lambdaRoutes', {
      value: this.httpApi.apiEndpoint,
    });
  }
}

const app = new App();
const apiGwStack = new ApiGatewayStack(app, 'apigw', {
  env: {
    region: config.region,
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
});

new CloudFrontStack(app, 'distribution', {
  apiUrl: apiGwStack.httpApi.apiEndpoint,
  attachPolicy: apiGwStack.edgeFunctionPolicy,
  env: {
    region: config.region,
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
});

app.synth();
