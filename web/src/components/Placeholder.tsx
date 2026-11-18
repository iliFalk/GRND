import { Card, CardContent } from './ui/card';

interface PlaceholderProps {
  title: string;
}

export function Placeholder({ title }: PlaceholderProps) {
  return (
    <section aria-labelledby="placeholder-title">
      <Card>
        <CardContent className="space-y-2 py-12 text-center">
          <h2 id="placeholder-title" className="text-lg font-semibold">
            {title} is coming
          </h2>
          <p className="text-sm text-muted-foreground">
            This screen has not been ported yet. The dashboard is the live part of the shell.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
