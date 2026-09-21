import { Landing } from '@/components/Landing';
import { countDiagrams, getTopics } from '@/lib/topics';

export default function HomePage() {
  return <Landing topics={getTopics()} diagrams={countDiagrams()} />;
}
