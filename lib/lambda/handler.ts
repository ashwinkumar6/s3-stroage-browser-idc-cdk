import {
  SSOOIDCClient,
  CreateTokenWithIAMCommand,
} from "@aws-sdk/client-sso-oidc";
import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";
import * as jwt from "jsonwebtoken";

// Constants retrieved from environment variables
const idcAppArn = process.env.IDP_APP_ARN;
const identityBearerRoleArn = process.env.IDENTITY_BEARER_ROLE_ARN;
const region = process.env.REGION;
const grantType = "urn:ietf:params:oauth:grant-type:jwt-bearer";

// Validate necessary environment variables
if (!idcAppArn || !identityBearerRoleArn || !region) {
  throw new Error("Missing necessary environment variables.");
}

// Helper function to validate JWT format
const isValidJwt = (token: string): boolean => {
  try {
    const decoded = jwt.decode(token, { complete: true });
    return Boolean(
      decoded &&
        typeof decoded === "object" &&
        decoded.header &&
        decoded.payload
    );
  } catch (error) {
    return false;
  }
};

export const handler = async (event) => {
  try {
    // Input validation: Check if idToken is provided and is a valid JWT
    const idToken = event.arguments?.idToken;
    if (!idToken || !isValidJwt(idToken)) {
      throw new Error("Invalid or missing idToken.");
    }

    // Step 1: Exchange external IDP idToken for IAM IDC idToken
    const ssoClient = new SSOOIDCClient({});
    const tokenResponse = await ssoClient.send(
      new CreateTokenWithIAMCommand({
        clientId: idcAppArn,
        grantType,
        assertion: idToken,
      })
    );

    const idcIdToken = tokenResponse.idToken;
    if (!idcIdToken) {
      throw new Error("Failed to retrieve IDC idToken.");
    }

    const decodedIdToken = jwt.decode(idcIdToken) as jwt.JwtPayload;
    if (!decodedIdToken) {
      throw new Error("Failed to decode idToken.");
    }

    // Step 2: Use IAM IDC idToken to assume identityBearerRoleArn with specific context
    const stsClient = new STSClient({ region });
    const roleResponse = await stsClient.send(
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

    if (!roleResponse.Credentials) {
      throw new Error("Failed to assume role with provided context.");
    }

    return JSON.stringify(roleResponse.Credentials);
  } catch (error) {
    console.error("Error in Lambda handler:", error);
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Error processing request",
        details: error.message,
      }),
    };
  }
};
