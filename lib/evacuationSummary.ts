// Truthful evacuation-center summaries derived only from current center fields.
import type { EvacuationCenterRecord } from './resources';

export type EvacuationSummary = {
  openCount: number;
  fullCount: number;
  priorityCount: number;
  totalCount: number;
  declaredCapacity: number;
  missingCapacityCount: number;
  attentionCenters: EvacuationCenterRecord[];
};

function attentionRank(center: EvacuationCenterRecord): number {
  if (center.isPriority && center.status === 'full') return 0;
  if (center.status === 'full') return 1;
  if (center.isPriority) return 2;
  if (!center.lastUpdatedAt) return 3;
  return 4;
}

function updateTime(center: EvacuationCenterRecord): number {
  if (!center.lastUpdatedAt) return 0;
  const value = Date.parse(center.lastUpdatedAt);
  return Number.isFinite(value) ? value : 0;
}

/** Sort attention cards by operational relevance without inferring occupancy. */
export function summarizeEvacuationCenters(
  centers: EvacuationCenterRecord[],
): EvacuationSummary {
  const openCount = centers.filter((center) => center.status === 'open').length;
  const fullCount = centers.filter((center) => center.status === 'full').length;
  const priorityCount = centers.filter((center) => center.isPriority).length;
  const declaredCapacity = centers.reduce(
    (total, center) => total + (center.capacity ?? 0),
    0,
  );
  const missingCapacityCount = centers.filter(
    (center) => center.capacity === null,
  ).length;

  const attentionCenters = centers
    .filter((center) => attentionRank(center) < 4)
    .sort((left, right) => {
      const rankDifference = attentionRank(left) - attentionRank(right);
      if (rankDifference !== 0) return rankDifference;
      const updateDifference = updateTime(left) - updateTime(right);
      if (updateDifference !== 0) return updateDifference;
      return left.name.localeCompare(right.name);
    })
    .slice(0, 3);

  return {
    openCount,
    fullCount,
    priorityCount,
    totalCount: centers.length,
    declaredCapacity,
    missingCapacityCount,
    attentionCenters,
  };
}
