import { Skeleton, SkeletonScreen, SkeletonText } from "@/components/ui";

const RATIOS = ["3 / 4", "4 / 5", "2 / 3", "1 / 1", "4 / 5", "3 / 4", "2 / 3", "1 / 1"];

/** Placeholder for a trip plan: hero, stats, then a row of day cards. */
export function TripPlanSkeleton({ label = "Loading your trip plan", withHero = true }) {
  return (
    <SkeletonScreen label={label}>
      {withHero && (
        <div className="trip-hero">
          <div className="trip-hero-media">
            <Skeleton radius="lg" style={{ aspectRatio: "4 / 5" }} />
          </div>
          <div className="trip-hero-body stack-xl">
            <div className="stack-md">
              <Skeleton width={120} height={14} radius="full" />
              <Skeleton width="55%" height={44} />
              <SkeletonText lines={1} />
            </div>
            <div className="trip-stats">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} height={76} />
              ))}
            </div>
            <div className="row">
              <Skeleton width={120} height={40} />
              <Skeleton width={130} height={40} />
              <Skeleton width={110} height={40} />
            </div>
          </div>
        </div>
      )}
      <div className="section">
        <Skeleton width={200} height={28} />
        <div className="tile-grid tile-grid-4 skeleton-gap">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} height={210} />
          ))}
        </div>
      </div>
    </SkeletonScreen>
  );
}

/** Placeholder for the My trips masonry grid. */
export function TripGridSkeleton({ count = 8 }) {
  return (
    <SkeletonScreen label="Loading your trips">
      <div className="masonry">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="masonry-item">
            <Skeleton style={{ aspectRatio: RATIOS[i % RATIOS.length] }} />
          </div>
        ))}
      </div>
    </SkeletonScreen>
  );
}
