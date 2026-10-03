import { ComingSoon } from "@/components/coming-soon";

export default function ClustersPage() {
  return (
    <ComingSoon
      title="Clusters"
      description="Where the market is building sales teams right now."
      items={[
        "Heatmap: function × region",
        "Division × week heatmap for the top 20 accounts",
        "New clusters per week, most-hired role families",
        "Filterable list of every cluster",
      ]}
    />
  );
}
