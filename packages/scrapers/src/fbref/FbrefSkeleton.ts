export type FbrefSkeletonStatus = {
  provider: "fbref";
  available: false;
  affectsRating: false;
  status: "skeleton";
  reason: string;
};

export function fbrefSkeletonStatus(): FbrefSkeletonStatus {
  return {
    provider: "fbref",
    available: false,
    affectsRating: false,
    status: "skeleton",
    reason: "live extraction disabled; future source investigation required"
  };
}
