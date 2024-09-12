# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template

## Deploying the CDK
```
cdk deploy --all \
-c accountId=<accountId> \
-c region=<region> \
-c idcArn=<idcArn> \
-c idcUserId=<idcUserId> \
-c idcAppArn=<idcAppArn> \
-c bucketName=<bucketName>
```

Example:
```
cdk destroy --all \
-c accountId=11111111 \
-c region=us-east-2 \
-c idcArn=arn:aws:sso:::instance/ssoins-00000000 \
-c idcUserId=70d1-70b8-38ca-000 \
-c idcAppArn=arn:aws:sso::11111111:application/ssoins-000000/apl-00000 \
-c bucketName=access-grant-bucket
```

Note: IAM Identity center needs to be created and configured prior to deploying the cdk. Please refer to documentation for instructions. 

## Destroying the CDK
```
cdk destroy --all \
-c accountId=<accountId> \
-c region=<region> \
-c idcArn=<idcArn> \
-c idcUserId=<idcUserId> \
-c idcAppArn=<idcAppArn> \
-c bucketName=<bucketName>
```
Note: before destroying stack delete all items from bucket and detach IDC from AG on the S3->AG console  
