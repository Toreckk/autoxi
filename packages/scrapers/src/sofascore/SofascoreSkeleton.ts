export type SofascoreSkeletonStatus = {
  provider: "sofascore";
  available: false;
  affectsRating: false;
  status: "skeleton";
  reason: string;
};

export function sofascoreSkeletonStatus(): SofascoreSkeletonStatus {
  return {
    provider: "sofascore",
    available: false,
    affectsRating: false,
    status: "skeleton",
    reason: "future investigation"
  };
}
