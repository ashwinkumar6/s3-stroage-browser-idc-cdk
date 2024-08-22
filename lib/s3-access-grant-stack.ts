import { Stack, StackProps, RemovalPolicy } from "aws-cdk-lib";
import {
  Bucket,
  CfnAccessGrant,
  CfnAccessGrantsInstance,
  CfnAccessGrantsLocation,
  HttpMethods,
} from "aws-cdk-lib/aws-s3";
import {
  Effect,
  ManagedPolicy,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export class S3AccessGrantStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const idcArn = this.node.tryGetContext("idcArn");
    const idcUserId = this.node.tryGetContext("idcUserId");
    const bucketName = this.node.tryGetContext("bucketName");

    // 0. Create AG instance
    const accessGrantsInstance = new CfnAccessGrantsInstance(
      this,
      "AccessGrantsInstance",
      {
        identityCenterArn: idcArn,
      }
    );

    // 1. Define s3 bucket
    const bucket = new Bucket(this, "Bucket", {
      bucketName: bucketName,
      removalPolicy: RemovalPolicy.DESTROY,
      cors: [
        {
          allowedHeaders: ["*"],
          allowedMethods: [
            HttpMethods.GET,
            HttpMethods.HEAD,
            HttpMethods.PUT,
            HttpMethods.POST,
            HttpMethods.DELETE,
          ],
          allowedOrigins: ["*"],
          exposedHeaders: [
            "x-amz-server-side-encryption",
            "x-amz-request-id",
            "x-amz-id-2",
            "ETag",
          ],
          maxAge: 3000,
        },
      ],
    });

    // 2. Create an IAM role to be associated with the Access Grants Location
    const accessGrantS3LocationRole = new Role(
      this,
      "AccessGrantS3LocationRole",
      {
        assumedBy: new ServicePrincipal("access-grants.s3.amazonaws.com"),
        managedPolicies: [
          ManagedPolicy.fromAwsManagedPolicyName("AmazonS3FullAccess"),
        ],
      }
    );
    accessGrantS3LocationRole.assumeRolePolicy?.addStatements(
      new PolicyStatement({
        effect: Effect.ALLOW,
        principals: [new ServicePrincipal("access-grants.s3.amazonaws.com")],
        actions: ["sts:AssumeRole", "sts:SetContext", "sts:SetSourceIdentity"],
      })
    );

    // 3. Create Access Grants Location
    const accessGrantsLocation = new CfnAccessGrantsLocation(
      this,
      "AccessGrantsLocation",
      {
        iamRoleArn: accessGrantS3LocationRole.roleArn,
        locationScope: `s3://${bucket.bucketName}/*`,
        tags: [
          {
            key: "Purpose",
            value: "AccessGrantLocation",
          },
        ],
      }
    );

    // 4. create Access Grant
    const accessGrant = new CfnAccessGrant(this, "AccessGrant", {
      accessGrantsLocationId: accessGrantsLocation.ref,
      grantee: {
        granteeIdentifier: idcUserId,
        granteeType: "DIRECTORY_USER",
      },
      permission: "READWRITE",
    });
  }
}
