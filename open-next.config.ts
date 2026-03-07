const config = {
  default: {
    override: {
      wrapper: "aws-lambda",
      incrementalCache: "s3",
      tagCache: "dynamodb",
      queue: "sqs",
    },
  },
  middleware: {
    external: true,
  },
  functions: {
    time: {
      runtime: "edge",
      routes: ["app/api/time/route"],
      patterns: ["/api/time"],
    },
    edgePage: {
      runtime: "edge",
      routes: ["app/edge/page"],
      patterns: ["/edge"],
    },
  },
} as const;

export default config;
