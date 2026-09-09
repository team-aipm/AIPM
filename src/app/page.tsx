import { redirect } from 'next/navigation';

/**
 * 진입점.
 *
 * DEV-002 에 `/` 에 해당하는 Screen 이 없다. 화면을 새로 만들지 않고
 * 로그인으로 보낸다 — 이미 들어와 있으면 `/login` 이 다시 `/students` 로
 * 보낸다(로그인 여부를 아는 곳이 거기 한 곳이면 된다).
 */
export default function RootPage() {
  redirect('/login');
}
