import { join as pathJoin } from 'path';

import { CfnOutput, Fn, Stack, StackProps } from 'aws-cdk-lib';
import {
  Distribution,
  ViewerProtocolPolicy,
  experimental,
  LambdaEdgeEventType,
} from 'aws-cdk-lib/aws-cloudfront';
import { HttpOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { Runtime, Code } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

const { EdgeFunction } = experimental;

type CloudFrontStackProps = {
  apiUrl: string;
  attachPolicy: PolicyStatement;
} & StackProps;

class CloudFrontStack extends Stack {
  constructor(scope: Construct, id: string, props: CloudFrontStackProps) {
    super(scope, id, props);

    const { apiUrl, attachPolicy } = props;
    const apiEndpoint = Fn.parseDomainName(apiUrl);

    const edgeFunction = new EdgeFunction(this, 'authorizer', {
      runtime: Runtime.NODEJS_14_X,
      handler: 'handler.handler',
      code: Code.fromAsset(pathJoin(__dirname, 'dist.zip')),
    });

    // Add policy
    edgeFunction.addToRolePolicy(attachPolicy);

    const distribution = new Distribution(this, 'distribution', {
      defaultBehavior: {
        origin: new HttpOrigin(apiEndpoint),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        edgeLambdas: [
          {
            functionVersion: edgeFunction.currentVersion,
            eventType: LambdaEdgeEventType.ORIGIN_REQUEST,
          },
        ],
      },
    });

    new CfnOutput(this, 'distributionUrl', {
      value: `https://${distribution.domainName}`,
    });
  }
}

export { CloudFrontStack };
