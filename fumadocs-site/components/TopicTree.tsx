import { getTopics, type TreeItem } from '@/lib/topics';
import { TopicTreeClient } from './TopicTreeClient';

export function TopicTree() {
  const topics = getTopics();
  const root: TreeItem = {
    id: 'root',
    title: 'Last Minute Notes',
    pages: topics.reduce((sum, t) => sum + t.pages, 0),
    children: topics,
  };

  return <TopicTreeClient root={root} />;
}
