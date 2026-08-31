import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 상위 폴더(E:\Project_my)의 lock 파일을 Turbopack이 루트로 오인하지 않도록 고정한다.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
