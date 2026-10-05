import { Link } from 'react-router';
import { buttonClasses } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-start gap-3">
      <title>Page not found · Margin</title>
      <h1 className="text-[28px] font-bold leading-9 tracking-tight">Page not found</h1>
      <p className="text-sm text-muted-foreground">That page does not exist.</p>
      <Link to="/products" className={buttonClasses({ variant: 'outline' })}>
        Back to products
      </Link>
    </div>
  );
}
