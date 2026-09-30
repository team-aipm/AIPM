'use client';

/**
 * 설정의 「로그아웃」 줄 + 확인창 · Figma `설정 · 03 로그아웃 확인`.
 *
 * 바로 로그아웃하지 않고 한 번 묻는다. 아이 기기를 같이 쓰는 집이 많아,
 * 잘못 누르면 부모가 비밀번호를 다시 찾아야 한다.
 */

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { BrandButton } from '@/components/ui/BrandButton';
import { signOutAccount } from '../_actions';
import { Dialog } from './Dialog';
import { ROW_CLASS } from './SettingsGroup';

function Submit() {
  const { pending } = useFormStatus();
  return <BrandButton pending={pending}>로그아웃</BrandButton>;
}

export function LogoutRow() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={ROW_CLASS}>
        로그아웃
      </button>

      <Dialog
        open={open}
        title="로그아웃할까요?"
        onClose={() => setOpen(false)}
        actions={
          <>
            <form action={signOutAccount}>
              <Submit />
            </form>
            <BrandButton tone="neutral" type="button" onClick={() => setOpen(false)}>
              취소
            </BrandButton>
          </>
        }
      >
        이 기기에서 보호자 계정이 로그아웃돼요. 아이들의 학습 기록은 그대로 있어요.
      </Dialog>
    </>
  );
}
