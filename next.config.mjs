/** @type {import('next').NextConfig} */
const nextConfig = {
  // 確保 PDF 被打包進 serverless function（讓 API route 能用 fs 讀）
  experimental: {
    outputFileTracingIncludes: {
      '/api/chat': ['./public/docs/**/*'],
    },
  },
};

export default nextConfig;
