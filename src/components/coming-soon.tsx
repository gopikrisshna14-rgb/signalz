import { Card } from "@/components/ui";

export function ComingSoon({ title, description, items }: { title: string; description: string; items: string[] }) {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-[20px] font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-muted">{description}</p>
      <Card className="mt-6 p-5">
        <div className="text-[12px] font-semibold tracking-wide text-accent uppercase">Coming in the next build</div>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[13px]">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
