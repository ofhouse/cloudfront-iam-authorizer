# Using API Gateway with IAM authorizer

This is an example of a client / server application that uses the IAM authorizer to authenticate requests.

# Server

The server is a simple Lambda function connected to a API-Gateway.
The API Gateway uses the default IAM authorizer to authenticate the requests.

The code for this is written with AWS CDK, and located in the `./cdk` subpackage.

# Client

The client uses the AWS SDK to sign a request.
