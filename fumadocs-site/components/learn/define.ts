import { getLessonMeta } from '@/lib/learn/catalog';
import { statsOf, TONE_COLOR } from './engines/common';
import { ArrayScene, type ArrayState } from './engines/array';
import { FlowScene, type FlowState } from './engines/flow';
import { GraphScene, type GraphState } from './engines/graph';
import { GridScene, type GridState } from './engines/grid';
import { SequenceScene, type SeqState } from './engines/sequence';
import { TimelineScene, type TimelineState } from './engines/timeline';
import { IsoArrayScene } from './engines/iso-array';
import { IsoGraphScene } from './engines/iso-graph';
import { IsoGridScene } from './engines/iso-grid';
import { IsoTimelineScene } from './engines/iso-timeline';
import type { LegendItem, Lesson, Step } from './types';

type EngineStates = {
  flow: FlowState;
  sequence: SeqState;
  array: ArrayState;
  graph: GraphState;
  grid: GridState;
  timeline: TimelineState;
  isoArray: ArrayState;
  isoGraph: GraphState;
  isoGrid: GridState;
  isoTimeline: TimelineState;
};

export type Engine = keyof EngineStates;

const SCENES = {
  flow: FlowScene,
  sequence: SequenceScene,
  array: ArrayScene,
  graph: GraphScene,
  grid: GridScene,
  timeline: TimelineScene,
  isoArray: IsoArrayScene,
  isoGraph: IsoGraphScene,
  isoGrid: IsoGridScene,
  isoTimeline: IsoTimelineScene,
} as const;

const DEFAULT_LEGEND: Record<Engine, LegendItem[]> = {
  flow: [
    { label: 'request', color: TONE_COLOR.req, shape: 'dot' },
    { label: 'response', color: TONE_COLOR.res, shape: 'dot' },
    { label: 'data', color: TONE_COLOR.data, shape: 'dot' },
  ],
  sequence: [
    { label: 'request', color: TONE_COLOR.req, shape: 'bar' },
    { label: 'reply', color: TONE_COLOR.res, shape: 'bar' },
    { label: 'failure', color: TONE_COLOR.bad, shape: 'bar' },
  ],
  array: [
    { label: 'current', color: TONE_COLOR.accent, shape: 'ring' },
    { label: 'done', color: TONE_COLOR.ok, shape: 'ring' },
    { label: 'skipped', color: '#5c5c5c', shape: 'ring' },
  ],
  graph: [
    { label: 'current', color: TONE_COLOR.accent, shape: 'ring' },
    { label: 'visited', color: TONE_COLOR.info, shape: 'ring' },
    { label: 'done', color: TONE_COLOR.ok, shape: 'ring' },
  ],
  grid: [
    { label: 'current', color: TONE_COLOR.accent, shape: 'ring' },
    { label: 'computed', color: TONE_COLOR.ok, shape: 'ring' },
    { label: 'depends on', color: TONE_COLOR.accent, shape: 'bar' },
  ],
  timeline: [
    { label: 'normal', color: TONE_COLOR.info, shape: 'bar' },
    { label: 'slow / failed', color: TONE_COLOR.bad, shape: 'bar' },
    { label: 'marker', color: TONE_COLOR.accent, shape: 'bar' },
  ],
  isoArray: [],
  isoGraph: [],
  isoGrid: [],
  isoTimeline: [],
};
DEFAULT_LEGEND.isoArray = DEFAULT_LEGEND.array;
DEFAULT_LEGEND.isoGraph = DEFAULT_LEGEND.graph;
DEFAULT_LEGEND.isoGrid = DEFAULT_LEGEND.grid;
DEFAULT_LEGEND.isoTimeline = DEFAULT_LEGEND.timeline;

/**
 * Build a lesson for one of the shared engines.
 * The slug must exist in lib/learn/catalog.ts, which supplies title, section and notes link.
 */
export function defineLesson<E extends Engine>(
  engine: E,
  def: {
    slug: string;
    objectives: { text: string; step: number }[];
    steps: Step<EngineStates[E]>[];
    legend?: LegendItem[];
    /** Pseudocode lines shown beside the stage. Use `code` on steps or frames to highlight lines. */
    pseudocode?: string[];
  },
): Lesson<unknown> {
  const meta = getLessonMeta(def.slug);
  if (!meta) throw new Error(`Lesson "${def.slug}" is missing from lib/learn/catalog.ts`);
  const lesson: Lesson<EngineStates[E]> = {
    meta,
    objectives: def.objectives,
    steps: def.steps,
    Scene: SCENES[engine] as Lesson<EngineStates[E]>['Scene'],
    stats: statsOf,
    legend: def.legend ?? DEFAULT_LEGEND[engine],
    pseudocode: def.pseudocode,
    iso: engine.startsWith('iso'),
  };
  return lesson as unknown as Lesson<unknown>;
}
