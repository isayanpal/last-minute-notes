import type { ReactNode } from 'react';
import { CourseShell } from '@/components/learn/CourseNav';

export default function LearnLayout({ children }: { children: ReactNode }) {
  return <CourseShell>{children}</CourseShell>;
}
