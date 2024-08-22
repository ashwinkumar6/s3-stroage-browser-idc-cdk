import {
  Stack,
  StackProps,
  CfnOutput,
  Expiration,
  Duration,
} from "aws-cdk-lib";
import {
  GraphqlApi,
  SchemaFile,
  AuthorizationType,
} from "aws-cdk-lib/aws-appsync";
import {
  ArnPrincipal,
  Effect,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import { join } from "path";

export class LambdaStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const accountId = this.node.tryGetContext("accountId");
    const region = this.node.tryGetContext("region");
    const idcAppArn = this.node.tryGetContext("idcAppArn");

    // 1. Create Identity Bearer Role that provides access to AGs
    // lambda returns creds for this role
    const accessGrantPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["*"],
      resources: [`arn:aws:s3:${region}:${accountId}:access-grants/default`],
    });
    const identityBearerRole = new Role(this, "IdentityBearerRole", {
      roleName: "IdentityBearerRole",
      assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
    });
    identityBearerRole.addToPolicy(accessGrantPolicy);

    // 2. AppSync + lambda setup
    const api = new GraphqlApi(this, "Api", {
      name: "cdk-appsync-api",
      schema: SchemaFile.fromAsset(join(__dirname, "lambda", "schema.graphql")),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: AuthorizationType.API_KEY,
          apiKeyConfig: {
            expires: Expiration.after(Duration.days(365)),
          },
        },
      },
      xrayEnabled: true,
    });

    const lambda = new NodejsFunction(this, "Lambda", {
      entry: join(__dirname, "lambda", "handler.ts"),
      environment: {
        REGION: region,
        IDP_APP_ARN: idcAppArn,
        IDENTITY_BEARER_ROLE_ARN: identityBearerRole.roleArn,
      },
    });
    const lambdaDefaultRoleArn = lambda.role?.roleArn; // get default lambda role
    const dataSource = api.addLambdaDataSource("DataSource", lambda);
    dataSource.createResolver("QueryOidcResolver", {
      typeName: "Query",
      fieldName: "oidc",
    });

    identityBearerRole.assumeRolePolicy?.addStatements(
      new PolicyStatement({
        effect: Effect.ALLOW,
        principals: [new ArnPrincipal(lambdaDefaultRoleArn!)],
        actions: ["sts:AssumeRole", "sts:SetContext"],
      })
    );

    // 3. add STS and SSO permissions to lambda
    lambda.addToRolePolicy(
      new PolicyStatement({
        sid: "CreateTokenWithIAMPolicy",
        effect: Effect.ALLOW,
        actions: ["sso-oauth:CreateTokenWithIAM"],
        resources: ["*"],
      })
    );
    lambda.addToRolePolicy(
      new PolicyStatement({
        sid: "AssumeRolePolicy",
        effect: Effect.ALLOW,
        actions: ["sts:AssumeRole", "sts:SetContext"],
        resources: [identityBearerRole.roleArn],
      })
    );

    new CfnOutput(this, "GraphQLAPIURL", { value: api.graphqlUrl });
    new CfnOutput(this, "GraphQLAPIKey", { value: api.apiKey || "" });
    new CfnOutput(this, "Stack Region", { value: this.region });
  }
}
