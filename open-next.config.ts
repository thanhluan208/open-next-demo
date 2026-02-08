const config = {
  default: {
    override: {
      wrapper: "aws-lambda",
    },
  },
  middleware: {
    external: true,
  },
} as const;

export default config;
