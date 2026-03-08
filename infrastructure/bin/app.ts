#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { OpenNextStack } from "../lib/open-next-stack";

const app = new cdk.App();

// Provided on Pass 2 via: --context serverFunctionUrlHost=<host>
// On Pass 1 this is empty — stack deploys without patched middleware
const serverFunctionUrlHost =
  (app.node.tryGetContext("serverFunctionUrlHost") as string) ?? "";

new OpenNextStack(app, "OpenNextDemoStack", {
  env: {
    account: "708676091124",
    region: "ap-southeast-1",
  },
  description: "Next.js application deployed with OpenNext and CDK",
  serverFunctionUrlHost,
});
