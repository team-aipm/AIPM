'use client';

import Link from 'next/link';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * AUTH-001 · 로그인
 *
 * 기존 회원(부모)이 이메일/비밀번호로 로그인한다.
 * State: 기본 / 로그인 중 / 로그인 실패 (COM-003 §5)
 *
 * 담당: 회원·유입 (COM-001 · COM-003 참조)
 */
export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!email || !password) {
      setStatus('error');
      setErrorMessage('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    setStatus('submitting');
    setErrorMessage('');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setStatus('error');
      setErrorMessage('이메일 또는 비밀번호가 올바르지 않아요.');
      return;
    }

    // TODO(AUTH-001 다음 단계): 로그인 성공 후 STU-002(학생 선택)로 이동.
    // 아직 해당 Route가 없어 이번 단계에서는 연결하지 않는다.
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-[#f7f4fa] px-6 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-[#ded4ec] bg-white p-8 shadow-[0_1px_2px_rgba(33,26,51,0.06),0_8px_24px_-12px_rgba(33,26,51,0.18)]">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-[#211a33]">메타몽</h1>
          <p className="mt-1 text-sm text-[#5b5273]">다시 만나서 반가워요.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-[#211a33]">
              이메일
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="parent@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-[#ded4ec] px-3 py-2.5 text-[#211a33] outline-none focus:border-[#211a33]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-[#211a33]">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-[#ded4ec] px-3 py-2.5 text-[#211a33] outline-none focus:border-[#211a33]"
            />
          </div>

          {status === 'error' && (
            <div className="rounded-lg border border-[#f0c8bf] bg-[#fbeae7] px-3 py-2 text-sm text-[#c1483a]">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={status === 'submitting'}
            className="mt-2 rounded-lg bg-[#211a33] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#5b5273] disabled:opacity-60"
          >
            {status === 'submitting' ? '로그인 중…' : '로그인'}
          </button>

          <p className="text-center text-sm text-[#5b5273]">
            아직 계정이 없으신가요?{' '}
            <Link href="/signup" className="font-medium text-[#e2793f] hover:text-[#cc6730]">
              회원가입
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
