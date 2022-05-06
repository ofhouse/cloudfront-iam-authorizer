/**
 * Adds environment variables that are available in Lambda
 * @see {@link https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html#configuration-envvars-runtime}
 */

declare namespace NodeJS {
  export interface ProcessEnv {
    AWS_ACCESS_KEY: string;
    AWS_ACCESS_KEY_ID: string;
    AWS_SECRET_ACCESS_KEY: string;
    AWS_SESSION_TOKEN: string;
  }
}
