import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LessonClient } from '@/components/learn/LessonClient';
import { LESSONS, getLessonMeta } from '@/lib/learn/catalog';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ step?: string }>;
};

export function generateStaticParams() {
  return LESSONS.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const meta = getLessonMeta((await params).slug);
  if (!meta) return {};
  return { title: `${meta.title} · Learn · Last Minute Notes`, description: meta.subtitle };
}

export default async function LessonPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const meta = getLessonMeta(slug);
  if (!meta) notFound();
  const step = Number.parseInt((await searchParams).step ?? '1', 10);
  return <LessonClient slug={slug} initialStep={Number.isFinite(step) ? step - 1 : 0} />;
}
