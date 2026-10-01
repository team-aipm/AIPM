'use client';

/**
 * 보상 등록 · 수정 폼 (Figma 414:4251 `보상 관리 · 02 보상 등록`).
 *
 * RWD-002 와 RWD-003 이 같이 쓴다. 목표 수 상수는 `lib/services/reward` 에
 * 있지만 그 파일은 서버 전용이라 page 가 props 로 넘긴다.
 *
 * - 「며칠 걸려요」라고 말하지 않는다. 주말 · 공휴일 때문에 어차피 틀린다
 *   (COM-003 §4.9 RWD-002).
 * - 100 이 넘으면 **말만 하고 막지 않는다**(COM-002 §22-5).
 * - 진행 중인 보상은 목표 수를 못 바꾼다. 칩을 잠그고 이유를 적는다.
 */

import { useActionState, useState } from 'react';
import { BrandButton } from '@/components/ui/BrandButton';
import { Field, fieldClass } from '@/components/ui/Field';
import { TERMS } from '@/lib/constants/copy';
import { ChestIcon } from './RewardParts';

export type RewardFormState = { error: string | null };

type Limits = { presets: readonly number[]; min: number; max: number; long: number };

const CHIP =
  'flex h-11 items-center rounded-xl px-4 text-[14px] font-semibold leading-5 transition-colors disabled:cursor-not-allowed';
const CHIP_ON = 'border-[1.5px] border-button-primary bg-surface-brand text-button-primary';
const CHIP_OFF = 'border border-meti-line bg-surface-primary text-text-primary';
const CHIP_LOCKED = 'border border-meti-line bg-background-primary text-disabled-text';

export function RewardForm({
  action,
  hidden,
  childName,
  defaults,
  limits,
  lockTarget = false,
  submitLabel,
}: {
  action: (prev: RewardFormState, formData: FormData) => Promise<RewardFormState>;
  /** student_id 나 reward_goal_id 처럼 화면이 정해 넘기는 값 */
  hidden: Record<string, string>;
  childName: string;
  defaults: { name: string; target: number | null };
  limits: Limits;
  lockTarget?: boolean;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  const [name, setName] = useState(defaults.name);

  const startsCustom = defaults.target !== null && !limits.presets.includes(defaults.target);
  const [preset, setPreset] = useState<number | 'custom' | null>(
    defaults.target === null ? null : startsCustom ? 'custom' : defaults.target,
  );
  const [custom, setCustom] = useState(startsCustom ? String(defaults.target) : '');

  const customValue = Number(custom);
  const customValid =
    custom !== '' && Number.isInteger(customValue) && customValue >= limits.min && customValue <= limits.max;
  const target = preset === 'custom' ? (customValid ? customValue : null) : preset;
  const ready = name.trim() !== '' && target !== null;

  return (
    <form action={formAction} className="flex flex-1 flex-col gap-4">
      {Object.entries(hidden).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <input type="hidden" name="target" value={target ?? ''} />

      <Field label="보상 이름" hint="아이 화면에 그대로 보여요">
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="예: 치킨"
          autoComplete="off"
          className={fieldClass('page')}
        />
      </Field>

      <div role="radiogroup" aria-labelledby="target-label" className="flex flex-col gap-3">
        <span id="target-label" className="text-[14px] font-semibold leading-5 text-text-primary">
          목표 도장 수
        </span>
        <div className="flex flex-wrap gap-2">
          {limits.presets.map((count) => {
            const on = preset === count;
            return (
              <button
                key={count}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={lockTarget}
                onClick={() => setPreset(count)}
                className={`${CHIP} ${on ? CHIP_ON : lockTarget ? CHIP_LOCKED : CHIP_OFF}`}
              >
                {count}개
              </button>
            );
          })}
          <button
            type="button"
            role="radio"
            aria-checked={preset === 'custom'}
            disabled={lockTarget}
            onClick={() => setPreset('custom')}
            className={`${CHIP} ${preset === 'custom' ? CHIP_ON : lockTarget ? CHIP_LOCKED : CHIP_OFF}`}
          >
            {preset === 'custom' && lockTarget ? `${custom}개` : '직접 입력'}
          </button>
        </div>

        {preset === 'custom' && !lockTarget && (
          <Field
            label="목표 도장 수 직접 입력"
            hint={`${limits.min}~${limits.max}개까지 정할 수 있어요`}
            error={custom !== '' && !customValid ? `${limits.min}~${limits.max}개로 적어 주세요` : null}
          >
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              value={custom}
              onChange={(e) => setCustom(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
              placeholder={`${limits.min}~${limits.max}`}
              className={fieldClass('page', custom !== '' && !customValid)}
            />
          </Field>
        )}
      </div>

      <div className="flex flex-col gap-1 text-[14px] leading-5 text-button-primary">
        {lockTarget ? (
          <p>진행 중인 보상은 목표 도장 수를 바꿀 수 없어요</p>
        ) : (
          <p>평일 오늘의 {TERMS.learning.parent} 10개를 마치면 도장 1개</p>
        )}
        {!lockTarget && target !== null && target > limits.long && (
          <p className="text-text-secondary">도장 {target}개는 오래 걸려요. 그래도 정할 수 있어요.</p>
        )}
      </div>

      <section className="flex flex-col gap-2 rounded-2xl bg-surface-brand p-4">
        <span className="text-[12px] leading-[18px] text-text-secondary">{childName} 홈에는 이렇게 보여요</span>
        <div className="flex items-center gap-2.5">
          <ChestIcon size={32} />
          <span className="text-[16px] font-semibold leading-6 text-text-primary">
            {name.trim() === '' ? '보상' : name.trim()}까지 도장 {target ?? '—'}개
          </span>
        </div>
      </section>

      {state.error !== null && (
        <p role="alert" className="text-[14px] leading-5 text-error-text">
          {state.error}
        </p>
      )}

      <div className="mt-auto pt-3">
        <BrandButton pending={pending} disabled={!ready}>
          {submitLabel}
        </BrandButton>
      </div>
    </form>
  );
}
