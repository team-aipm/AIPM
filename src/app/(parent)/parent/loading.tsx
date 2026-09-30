/**
 * Figma `보호자 홈 / 불러오는 중`.
 *
 * 이 파일은 `/parent/my/**` 로 갈 때도 쓰인다(가까운 loading 이 여기다).
 * 그래서 Figma 의 제목(「우리 아이」)은 두지 않는다 — 설정으로 가는데
 * 홈 제목이 잠깐 보이면 잘못 누른 줄 안다.
 */

import { LoadingSkeleton } from './_components/LoadingSkeleton';

export default function ParentLoading() {
  return <LoadingSkeleton />;
}
