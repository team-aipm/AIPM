/**
 * 파트너 얼굴.
 *
 * 그림은 프로토타입(METI)에서 가져왔다. **한 곳에서만 고른다** — 화면마다
 * 경로를 적으면 파트너를 늘릴 때(COM-002 변경 후) 전부 찾아다녀야 한다.
 *
 * 이름은 `copy.ts` 의 `PARTNER_NAME` 이 정한다. 여기는 얼굴만 맡는다.
 */

import Image from 'next/image';
import type { Database } from '@/types/database';
import { PARTNER_NAME } from '@/lib/constants/copy';

type Persona = Database['public']['Enums']['persona_type'];

const FACE: Record<Persona, string> = {
  friend: '/characters/meti.png',
  villain: '/characters/hetty.png',
};

export function PartnerFace({
  persona,
  size = 40,
  className = '',
}: {
  persona: Persona;
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src={FACE[persona]}
      alt={PARTNER_NAME[persona]}
      width={size}
      height={size}
      // 원본이 정사각형이 아니라 세로가 길다. 잘라내지 않고 안에 맞춘다.
      className={`object-contain ${className}`}
      style={{ width: size, height: size }}
      priority={size >= 96}
    />
  );
}
