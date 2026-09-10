'use client';

import { useCallback, useEffect, useState } from 'react';

import type { CharacterId } from './mock-data';

/**
 * 학생 화면 전역 상태의 임시 클라이언트 목업.
 *
 * 실제로는 Supabase의 Student / LearningSession 레코드로 대체되어야 한다
 * (COM-002 §Student, §LearningSession). 지금은 라우트 간 이동에도 값이
 * 남아 있어야 화면 시연이 자연스러워서, 브라우저 localStorage에만 저장한다.
 * 서버에 아무것도 쓰지 않는다.
 */
export type StudentMockState = {
  points: number;
  owned: CharacterId[];
  partner: CharacterId;
  missionsDoneToday: number;
  missionsGoalToday: number;
  streakDays: number;
};

const KEY = 'meti_student_mock_v1';

const DEFAULT_STATE: StudentMockState = {
  points: 240,
  owned: ['meti', 'heti', 'quri', 'poki'],
  partner: 'meti',
  missionsDoneToday: 2,
  missionsGoalToday: 3,
  streakDays: 5,
};

function readState(): StudentMockState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_STATE;
    return { ...DEFAULT_STATE, ...(JSON.parse(raw) as Partial<StudentMockState>) };
  } catch {
    return DEFAULT_STATE;
  }
}

function writeState(state: StudentMockState) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // 저장 실패는 무시한다 — 시연용 목업이라 치명적이지 않다.
  }
}

export function useStudentState() {
  const [state, setState] = useState<StudentMockState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);

  // localStorage는 서버에 없으므로, 마운트 직후 클라이언트 값으로 한 번
  // 동기화해야 한다 (PromptLab.tsx의 동일 패턴 참고).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setState(readState());
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const update = useCallback(
    (patch: Partial<StudentMockState> | ((prev: StudentMockState) => Partial<StudentMockState>)) => {
      setState((prev) => {
        const applied = typeof patch === 'function' ? patch(prev) : patch;
        const next = { ...prev, ...applied };
        writeState(next);
        return next;
      });
    },
    [],
  );

  return { state, update, hydrated };
}
