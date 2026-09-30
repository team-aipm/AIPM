import Image from 'next/image';
import type { Database } from '@/types/database';
import { PARTNER_NAME } from '@/lib/constants/copy';

type Persona = Database['public']['Enums']['persona_type'];
type Pose = 'wave' | 'celebrate';

/**
 * 파트너 전신 그림. 얼굴(`PartnerFace`)과 따로 둔다.
 *
 * Figma 의 홈 카드 · 캐릭터 선택은 손을 흔드는 메티(`wave`), 오늘 미션
 * 완료 화면은 두 팔을 든 메티(`celebrate`)를 쓴다. 헤티는 Figma 에 자세별
 * 그림이 없어서 같은 그림을 쓴다.
 *
 * 학생 HOME · 오늘의 기록 · 캐릭터 선택 세 route 에서 쓰므로 `_components/`
 * 가 아니라 여기 둔다(DEV-001).
 */
const FIGURE: Record<Persona, Record<Pose, string>> = {
  friend: {
    wave: '/characters/meti-wave.png',
    celebrate: '/characters/meti-celebrate.png',
  },
  villain: {
    wave: '/characters/hetty.png',
    celebrate: '/characters/hetty.png',
  },
};

export function PartnerFigure({
  persona,
  pose = 'wave',
  size = 80,
  className = '',
}: {
  persona: Persona;
  pose?: Pose;
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src={FIGURE[persona][pose]}
      alt={PARTNER_NAME[persona]}
      width={size}
      height={size}
      className={`object-contain ${className}`}
      style={{ width: size, height: size }}
      priority={size >= 96}
    />
  );
}
