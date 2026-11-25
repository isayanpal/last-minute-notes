import { IsoCube } from './iso';

/** One colour per course module, shared by the sidebar folders and the lesson header. */
export const MODULE_COLORS = ['#e8714f', '#3fb97a', '#8b6fe0', '#c9a36b', '#3f8fe0', '#2fb8a8', '#e0577f', '#a6b84a'];

export const moduleColor = (i: number) => MODULE_COLORS[i % MODULE_COLORS.length];

/** A small three-step isometric stair, drawn in the module colour. */
export function ModuleGlyph({ index, size = 72 }: { index: number; size?: number }) {
  const c = moduleColor(index);
  return (
    <svg viewBox="0 0 96 80" width={size} height={(size * 80) / 96} aria-hidden>
      <IsoCube x={26} y={62} size={16} color={c} />
      <IsoCube x={48} y={50} size={16} color={c} />
      <IsoCube x={70} y={38} size={16} color={c} />
      <IsoCube x={48} y={38} size={16} color={c} />
    </svg>
  );
}
