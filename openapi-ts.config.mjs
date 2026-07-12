const CONTRACT_INPUT = './openapi/stock-analyst-v1.json';
const GENERATED_OUTPUT = './src/api/generated';

export function openApiGeneratorConfig(output = GENERATED_OUTPUT) {
  return {
    input: CONTRACT_INPUT,
    output,
    plugins: [
      '@hey-api/typescript',
      '@hey-api/sdk',
      '@hey-api/client-fetch',
    ],
  };
}

export default openApiGeneratorConfig();
