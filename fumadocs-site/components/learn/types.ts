import type { ComponentType } from 'react';
import type { LessonMeta } from '@/lib/learn/catalog';

export type StepTag = 'problem' | 'concept' | 'technique' | 'trade-off' | 'in practice' | 'recap';

/** One state of the scene. The player holds it for `hold` ms, then moves to the next frame of the step. */
export type Frame<S> = { state: S; hold?: number };

export type Step<S> = {
  /** Short label under the step dot, 1 to 3 words. */
  label: string;
  title: string;
  tag: StepTag;
  /** Paragraphs. Supports **bold** and `code`. If every paragraph starts with "- " they render as bullets. */
  body: string[];
  keyIdea: string;
  /** Pseudocode line(s) to highlight while this step plays. A frame can override with `state.code`. */
  code?: number | number[];
  frames: Frame<S>[];
};

export type Tone = 'neutral' | 'accent' | 'ok' | 'bad' | 'info';

export type Stat = {
  label: string;
  value: string;
  hint?: string;
  tone?: 'ok' | 'bad' | 'neutral';
};

export type Note = { text: string; tone?: Tone };

/** Fields every engine state accepts. */
export type BaseState = {
  /** Pill at the bottom of the stage. */
  note?: Note;
  /** Up to 3 chips above the stage. */
  stats?: Stat[];
  /** 1-based pseudocode line(s) running in this frame. */
  code?: number | number[];
};

export type LegendItem = { label: string; color: string; shape: 'dot' | 'ring' | 'bar' };

export type SceneProps<S> = {
  state: S;
  /** Changes on every frame and every replay, so one-shot animations can restart. */
  frameKey: string;
};

export type Lesson<S> = {
  meta: LessonMeta;
  objectives: { text: string; step: number }[];
  steps: Step<S>[];
  Scene: ComponentType<SceneProps<S>>;
  stats: (state: S) => Stat[];
  legend: LegendItem[];
  /** Pseudocode shown beside the stage. Setting it switches the lesson to the course layout. */
  pseudocode?: string[];
  /** Lesson is drawn by an isometric engine, so the player uses the course layout. */
  iso?: boolean;
};
