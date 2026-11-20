'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import { LessonPlayer } from './LessonPlayer';
import { LOADERS } from './loaders';

type PlayerProps = { initialStep: number };

const players = new Map<string, ComponentType<PlayerProps>>();

/** One code-split chunk per lesson, so a lesson page only ships its own steps and engine. */
function playerFor(slug: string): ComponentType<PlayerProps> {
  let P = players.get(slug);
  if (!P) {
    P = dynamic(
      () =>
        LOADERS[slug]().then((m) => {
          const lesson = m.default;
          return function Player({ initialStep }: PlayerProps) {
            return <LessonPlayer lesson={lesson} initialStep={initialStep} />;
          };
        }),
      { loading: () => <div className="mx-auto min-h-[70vh] w-full max-w-[1200px]" aria-busy="true" /> },
    );
    players.set(slug, P);
  }
  return P;
}

export function LessonClient({ slug, initialStep }: { slug: string; initialStep: number }) {
  const Player = playerFor(slug);
  return <Player initialStep={initialStep} />;
}
