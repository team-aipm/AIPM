import Image from 'next/image';

/**
 * 다 됐다는 표시 — 옥색 동그라미 안의 체크.
 *
 * `/password` 안에서 두 번 쓴다(메일 보냄 · 비밀번호 바꿈). 두 곳뿐이고
 * 이 Route 밖에서는 쓰지 않으므로 `src/components` 가 아니라 여기 둔다
 * (DEV-001).
 *
 * 체크 그림은 손으로 그리지 않고 Figma 에서 받은 파일을 그대로 쓴다
 * (`public/icons/check.svg`). 눈대중으로 다시 그리면 굵기와 끝 모양이
 * 디자인과 미세하게 어긋난다.
 */
export function DoneMark() {
  return (
    <div
      aria-hidden
      className="flex size-[72px] items-center justify-center rounded-full bg-meti-bg"
    >
      <Image src="/icons/check.svg" alt="" width={18} height={13} />
    </div>
  );
}
