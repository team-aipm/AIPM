'use client';

/**
 * MY-003 「학생 삭제 확인」 Modal · 「삭제 취소」 확인 (COM-003 §5).
 *
 * Figma `자녀 계정 삭제 / 30일 복구 확인` · `자녀 계정 복구 / 최종 확인`.
 * 문구는 Figma 가 아니라 COM-007 §5-1 을 따른다 — Figma 는 「30일 뒤
 * 학습 기록 완전 삭제」 인데 문서는 **30일 안에 되돌릴 수 있고 학습기록은
 * 1년 보관**이다.
 */

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { BrandButton } from '@/components/ui/BrandButton';
import { requestDeleteStudent, undoDeleteStudent } from '../../../_actions';
import { Dialog } from '../../../_components/Dialog';

function Submit({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return <BrandButton pending={pending}>{children}</BrandButton>;
}

export function DeleteStudent({ studentId, name }: { studentId: string; name: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-11 px-4 text-[14px] font-semibold leading-5 text-error-text"
      >
        이 학생 삭제 요청
      </button>
      <p className="text-center text-[14px] leading-5 text-meti-hint">
        30일 안에는 되돌릴 수 있어요.
      </p>

      <Dialog
        open={open}
        title={`${name} 계정을 삭제할까요?`}
        onClose={() => setOpen(false)}
        actions={
          <>
            <form action={requestDeleteStudent}>
              <input type="hidden" name="student_id" value={studentId} />
              <Submit>삭제 요청하기</Submit>
            </form>
            <BrandButton tone="neutral" type="button" onClick={() => setOpen(false)}>
              취소
            </BrandButton>
          </>
        }
      >
        30일 안에는 보호자가 되돌릴 수 있어요. 학습기록은 1년간 보관한 뒤 완전히
        삭제됩니다.
      </Dialog>
    </div>
  );
}

export function RestoreStudent({ studentId, name }: { studentId: string; name: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <BrandButton type="button" onClick={() => setOpen(true)}>
        삭제 취소
      </BrandButton>

      <Dialog
        open={open}
        title={`${name} 계정을 복구할까요?`}
        onClose={() => setOpen(false)}
        actions={
          <>
            <form action={undoDeleteStudent}>
              <input type="hidden" name="student_id" value={studentId} />
              <Submit>복구하기</Submit>
            </form>
            <BrandButton tone="neutral" type="button" onClick={() => setOpen(false)}>
              취소
            </BrandButton>
          </>
        }
      >
        기존 학습 기록도 그대로 이어져요.
      </Dialog>
    </>
  );
}
