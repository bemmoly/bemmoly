import type { PeopleScreenProps } from '../routes.tsx';
import { JourneyDetail } from './journey-detail.tsx';
import { JourneyList } from './journey-list.tsx';

/** /people/journeys lists journeys; /people/journeys/:id is one of them. */
export default function JourneysScreen({ segment }: PeopleScreenProps) {
  return segment ? <JourneyDetail id={segment} /> : <JourneyList />;
}
