'use client';

import { useState, useTransition } from 'react';

import { unlock } from '../_actions';

/** 배포본에서 prompt-lab 을 열기 전에 통과 암호를 받는다. */
export function Gate() {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (value.trim() === '' || pending) return;
    setError(null);
    startTransition(async () => {
      const ok = await unlock(value);
      if (ok) {
        // 쿠키가 심긴 뒤 서버 컴포넌트를 다시 받아야 한다.
        window.location.reload();
        return;
      }
      setError('암호가 맞지 않습니다.');
      setValue('');
    });
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 p-6 font-mono text-[13px]">
      <div>
        <h1 className="text-base font-bold">Prompt Lab</h1>
        <p className="mt-1 text-neutral-500">
          팀 내부 도구입니다. 통과 암호를 입력하세요.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          type="password"
          value={value}
          autoFocus
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit();
          }}
          placeholder="통과 암호"
          className="flex-1 rounded border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700"
        />
        <button
          onClick={submit}
          disabled={pending || value.trim() === ''}
          className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
        >
          {pending ? '확인 중…' : '열기'}
        </button>
      </div>

      {error && <p className="text-red-600 dark:text-red-400">{error}</p>}

      <p className="text-[11px] text-neutral-500">
        암호는 운영 담당에게 받으세요. 모델 API 키는 들어간 뒤 각자 화면에
        넣습니다. 서버에 저장되지 않습니다.
      </p>
    </main>
  );
}
