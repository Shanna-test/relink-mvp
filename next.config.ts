import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: {
    buildActivity: false,
    buildActivityPosition: 'bottom-left',
  },
  // 개발 인디케이터 완전히 숨기기
  reactStrictMode: true,
};

export default nextConfig;
