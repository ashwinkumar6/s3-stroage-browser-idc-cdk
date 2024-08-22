import {
  SSOOIDCClient,
  CreateTokenWithIAMCommand,
} from "@aws-sdk/client-sso-oidc";
import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";
import * as jwt from "jsonwebtoken";

const idcAppArn = process.env.IDP_APP_ARN;
const identityBearerRoleArn = process.env.IDENTITY_BEARER_ROLE_ARN;
const region = process.env.REGION;
const grant_type = "urn:ietf:params:oauth:grant-type:jwt-bearer";

export const handler = async (event) => {
  console.log("### idToken: ", event.arguments.idToken);
  const ssoClient = new SSOOIDCClient({});
  const { idToken } = await ssoClient.send(
    new CreateTokenWithIAMCommand({
      clientId: idcAppArn,
      grantType: grant_type,
      assertion: event.arguments.idToken,
    })
  );
  const decodedIdToken = jwt.decode(idToken!)! as jwt.JwtPayload;
  console.log("new id token", decodedIdToken);

  const stsClient = new STSClient({ region });
  const { Credentials } = await stsClient.send(
    new AssumeRoleCommand({
      RoleArn: identityBearerRoleArn,
      RoleSessionName: "IdentityBearerRoleSession",
      DurationSeconds: 900,
      ProvidedContexts: [
        {
          ProviderArn: "arn:aws:iam::aws:contextProvider/IdentityCenter",
          ContextAssertion: decodedIdToken["sts:identity_context"],
        },
      ],
    })
  );
  return JSON.stringify(Credentials!);
};
