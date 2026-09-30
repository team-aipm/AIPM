'use client';

/**
 * 「미션 사진을 어떻게 올릴까?」 바텀시트 (Figma 496:4328).
 *
 * 카메라와 앨범을 나눈다. 전에는 `capture` 하나라 휴대폰에서 찍어 둔
 * 사진을 고를 길이 없었다.
 *
 * **지운다는 안내를 여기서 한다.** 사진을 고르는 그 화면에서 미리 알려
 * 줘야 한다(COM-001 §6.4).
 */

import Image from 'next/image';

type Props = {
  onPick: (file: File) => void;
  onClose: () => void;
};

export function PhotoSheet({ onPick, onClose }: Props) {
  function source(kind: 'camera' | 'album') {
    const camera = kind === 'camera';
    return (
      <label className="flex h-20 cursor-pointer items-center gap-3 rounded-[14px] border border-meti-line bg-background-primary p-3 transition-colors hover:bg-surface-brand">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-meti-line bg-background-primary">
          <Image src={camera ? '/icons/camera.svg' : '/icons/image.svg'} alt="" width={24} height={24} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span className="text-[16px] font-semibold leading-6 text-text-primary">
            {camera ? '지금 사진 찍기' : '앨범에서 고르기'}
          </span>
          <span className="text-[12px] leading-[18px] text-text-secondary">
            {camera ? '지금 바로 찍어요' : '찍어 둔 사진을 가져와요'}
          </span>
        </span>
        <Image src="/icons/chevron-right.svg" alt="" width={24} height={24} />
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          // 휴대폰에서는 카메라가 바로 열린다. 앨범 쪽은 붙이지 않는다
          capture={camera ? 'environment' : undefined}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            // 같은 사진을 다시 골라도 onChange 가 오게 비운다
            event.target.value = '';
            if (file !== undefined) onPick(file);
          }}
        />
      </label>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-sheet-title"
        onClick={(event) => event.stopPropagation()}
        className="flex w-full max-w-[480px] flex-col gap-3.5 rounded-t-3xl bg-surface-primary px-5 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] shadow-overlay"
      >
        <span className="mx-auto h-1 w-10 rounded-full bg-meti-off-bg" />
        <div className="flex flex-col gap-1.5">
          <p id="photo-sheet-title" className="text-[20px] font-semibold leading-7 text-text-primary">
            미션 사진을 어떻게 올릴까?
          </p>
          <p className="text-[14px] leading-5 text-text-secondary">
            직접 찍거나 앨범에서 가져와. 사진은 확인이 끝나면 자동으로 삭제돼.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {source('camera')}
          {source('album')}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-11 text-[14px] leading-5 text-text-secondary"
        >
          취소
        </button>
      </div>
    </div>
  );
}
