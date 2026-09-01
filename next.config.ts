import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 상위 폴더(E:\Project_my)의 lock 파일을 Turbopack이 루트로 오인하지 않도록 고정한다.
  turbopack: {
    root: __dirname,
  },
  experimental: {
    // 기본값은 1MB다. 휴대폰으로 찍은 문제 사진은 2~4MB가 흔하고
    // base64로 보내면 약 1.33배가 되므로 그대로 두면 사진 입력을
    // 시험할 수 없다. (prompt-lab · MIS 사진 문제 입력)
    serverActions: { bodySizeLimit: '12mb' },
  },
};

export default nextConfig;
