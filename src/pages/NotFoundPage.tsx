import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState, useDocumentTitle } from '../components/ui';

export default function NotFoundPage() {
  useDocumentTitle('Not found');
  return (
    <div className="container page">
      <EmptyState icon={<Compass size={28} />} title="This page took a wrong turn" boxed>
        <p>The link may be old, or the order belongs to another account.</p>
        <Link to="/" className="btn btn--primary">Back to restaurants</Link>
      </EmptyState>
    </div>
  );
}
