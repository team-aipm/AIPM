'use client';

import { useEffect } from 'react';

/**
 * 시연용 휴대폰 틀(`public/demo.html`) 안에서 열렸는지 표시한다.
 *
 * 틀 안이면 `<html>` 에 `in-frame` 을 붙인다. `globals.css` 가 그때만
 * 스크롤 막대를 숨긴다 — PC 브라우저는 막대를 화면 옆에 그려서, 그대로 두면
 * 휴대폰처럼 보이지 않는다. 스크롤은 그대로 된다.
 *
 * 틀 밖에서는 아무 일도 하지 않는다. 실제 사용자 화면은 바뀌지 않는다.
 */
export function FrameMarker() {
  useEffect(() => {
    if (window.self !== window.top) document.documentElement.classList.add('in-frame');
  }, []);
  return null;
}
