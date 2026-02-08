const config = {
  default: {
    override: {
      wrapper: "aws-lambda",
      incrementalCache: "s3-lite",
      tagCache: "dynamodb-lite",
      queue: "sqs-lite",
    },
  },
  middleware: {
    external: true,
  },
} as const;

export default config;
