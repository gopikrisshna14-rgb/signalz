import { ComingSoon } from "@/components/coming-soon";

export default function ResearchPage() {
  return (
    <ComingSoon
      title="Research"
      description="Paste a LinkedIn profile or company URL and the app researches the company for you."
      items={[
        "Paste one URL or up to 25 at once",
        "n8n runs Apify (profile, company, jobs) and Featherless.ai classifies the job ads",
        "Live progress: Queued → Profile → Company → Jobs → Classifying → Scoring → Done",
        "Failed requests with a Retry button",
      ]}
    />
  );
}
