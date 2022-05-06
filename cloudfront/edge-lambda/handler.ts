import { Sha256 } from '@aws-crypto/sha256-js';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import {
  CloudFrontRequestEvent,
  CloudFrontRequest,
  CloudFrontHeaders,
} from 'aws-lambda';

/* -----------------------------------------------------------------------------
 * Globals
 * ---------------------------------------------------------------------------*/

const region = 'eu-central-1';
const service = 'lambda';

let signer: SignatureV4;

/* -----------------------------------------------------------------------------
 * Utils
 * ---------------------------------------------------------------------------*/

/**
 * Converts the headers from the CloudFront event into a header bag of the form
 * "key": "value1,value2"
 *
 * @param headers
 */
function convertFromCloudFrontHeaders(headers: CloudFrontHeaders) {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    result[key] = value.reduce(
      (acc, { value }, currentIndex) =>
        acc + (currentIndex === 0 ? '' : ',') + value,
      ''
    );
  }

  return result;
}

function addAuthorizationHeadersCloudFrontHeaders(
  request: CloudFrontRequest,
  headers: Record<
    'x-amz-date' | 'x-amz-content-sha256' | 'authorization',
    string
  >
) {
  for (const [key, value] of Object.entries(headers)) {
    const lowercaseKey = key.toLowerCase();
    const values = value.split(',');
    request.headers[lowercaseKey] = values.map((value) => ({
      key,
      value,
    }));
  }
}

/* -----------------------------------------------------------------------------
 * Handler
 * ---------------------------------------------------------------------------*/

/**
 * Lambda@Edge origin facing handler.
 *
 * @param event - Original event that comes from CloudFront.
 * @returns - Modified CloudFront event
 */
async function handler(
  event: CloudFrontRequestEvent
): Promise<CloudFrontRequest> {
  const { request } = event.Records[0].cf;

  if (!request.origin?.custom) {
    throw new Error('Request signing is only available for custom origins.');
  }

  if (!signer) {
    signer = new SignatureV4({
      region,
      service,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        sessionToken: process.env.AWS_SESSION_TOKEN,
      },
      sha256: Sha256,
    });
  }

  const signedRequest = await signer.sign({
    protocol: request.origin.custom.protocol,
    hostname: request.origin.custom.domainName,
    headers: convertFromCloudFrontHeaders(request.headers),
    method: request.method,
    path: request.uri,
  });

  // Add the sign headers to the request
  addAuthorizationHeadersCloudFrontHeaders(request, {
    'x-amz-date': signedRequest.headers['x-amz-date'],
    'x-amz-content-sha256': signedRequest.headers['x-amz-content-sha256'],
    authorization: signedRequest.headers['authorization'],
  });

  return request;
}

export { handler };
