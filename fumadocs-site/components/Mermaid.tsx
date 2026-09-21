'use client';

import { useEffect, useId, useState } from 'react';

const themeVariables = {
  darkMode: true,
  background: '#0b0b0b',
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  fontSize: '14px',
  primaryColor: '#1f1f1f',
  primaryBorderColor: '#facc15',
  primaryTextColor: '#f5f5f5',
  secondaryColor: '#262626',
  tertiaryColor: '#171717',
  lineColor: '#a3a3a3',
  textColor: '#e5e5e5',
  mainBkg: '#1f1f1f',
  nodeBorder: '#facc15',
  clusterBkg: '#141414',
  clusterBorder: '#404040',
  edgeLabelBackground: '#0b0b0b',
  titleColor: '#f5f5f5',
};

export function Mermaid({ chart }: { chart: string }) {
  const id = useId().replace(/:/g, '');
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const { default: mermaid } = await import('mermaid');
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: 'base',
          themeVariables,
          flowchart: { curve: 'basis', htmlLabels: true, padding: 12 },
        });
        const result = await mermaid.render(`mermaid-${id}`, chart);
        if (!cancelled) setSvg(result.svg);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  if (error) {
    return (
      <pre className="my-6 overflow-x-auto rounded-lg border border-fd-border p-4 text-sm">
        {chart}
      </pre>
    );
  }

  return (
    <div
      role="img"
      aria-label="Diagram"
      className="my-6 flex min-h-32 justify-center overflow-x-auto rounded-lg border border-fd-border bg-fd-card p-4 [&_svg]:h-auto [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
