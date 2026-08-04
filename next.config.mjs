/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Os prompts canônicos são lidos do sistema de arquivos em tempo de execução
  // (Princípio IV / research.md R-06). O rastreador do Next não enxerga leituras dinâmicas,
  // então os arquivos são incluídos explicitamente no build.
  outputFileTracingIncludes: {
    '/api/**': ['./lib/agentes/**'],
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
