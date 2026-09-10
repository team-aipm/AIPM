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
export type PartnerPose = 'front' | 'wave' | 'think' | 'celebrate';

/**
 * 포즈별 그림. `pose`를 안 주면 기존 화면(home·students·onboarding·
 * mission 헤더)은 지금까지 쓰던 기본 그림(front) 그대로 나온다 — 이
 * Record를 늘렸다고 다른 화면이 바뀌지 않는다.
 */
const FACE: Record<Persona, Record<PartnerPose, string>> = {
  friend: {
    front: '/characters/meti_01_front-mttn80yx-s9em.png',
    wave: '/characters/meti_02_wave-mttgmra0-yqak.png',
    think: '/characters/meti_01_front-mttn80yx-s9em.png',
    celebrate: '/characters/meti_04_celebrate-mtth0j8r-ywx6.png',
  },
  villain: {
    front: '/characters/heti_02_wave-mtth3vtg-tszh.png',
    wave: '/characters/heti_02_wave-mtth3vtg-tszh.png',
    think: '/characters/heti_03_think-mttnfx1s-nt1t.png',
    celebrate: '/characters/heti_02_wave-mttnklya-ajkj.png',
  },
};

export function PartnerFace({
  persona,
  size = 40,
  pose = 'front',
  className = '',
}: {
  persona: Persona;
  size?: number;
  pose?: PartnerPose;
  className?: string;
}) {
  return (
    <Image
      src={FACE[persona][pose]}
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
