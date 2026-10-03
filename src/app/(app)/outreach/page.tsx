import { ComingSoon } from "@/components/coming-soon";

export default function OutreachPage() {
  return (
    <ComingSoon
      title="Outreach"
      description="What works: angles, reply times and the team leaderboard. You can already log outreach on each account."
      items={[
        "Funnel by angle: sent → accepted → replied → meeting",
        "Best time to send (weekday × hour)",
        "Leaderboard and tracked-link clicks",
        "Template editor with {{first_name}}, {{division}}, {{open_roles}} and more",
        "AI-written openers with Claude",
      ]}
    />
  );
}
