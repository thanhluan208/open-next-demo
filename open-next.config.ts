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
    placement: "global",
  },
} as const;

export default config;
