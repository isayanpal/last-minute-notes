import { getHub } from '@/lib/topics';
import { SectionHubClient } from './SectionHubClient';

/** Minimal, interactive contents list for a section entry page. `path` is relative to /docs. */
export function SectionHub({ path, levels }: { path: string; levels?: Record<string, string> }) {
  return <SectionHubClient items={getHub(path)} levels={levels} />;
}
