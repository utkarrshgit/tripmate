/*
 * Route-level loading placeholders, shown while a page's code downloads.
 * Each mirrors the layout of the page it stands in for, so nothing jumps
 * when the real page arrives.
 */
import { Skeleton, SkeletonScreen, SkeletonText } from "@/components/ui";
import { TripGridSkeleton, TripPlanSkeleton } from "@/features/trips";
// Skeletons render before their page's code (and CSS) has loaded, so pull in the layout styles they borrow.
import "@/features/home/home.css";
import "@/features/legal/legal.css";

function HeadingBlock({ width = "40%", lines = 2 }) {
  return (
    <div className="stack-md">
      <Skeleton width={width} height={28} />
      <SkeletonText lines={lines} />
    </div>
  );
}

export function HomeSkeleton() {
  return (
    <SkeletonScreen label="Loading TripMate">
      <div className="home-hero">
        <div className="container skeleton-hero">
          <Skeleton width="70%" height={70} />
          <Skeleton width="45%" height={70} />
          <SkeletonText lines={2} className="skeleton-hero-text" />
          <div className="row">
            <Skeleton width={130} height={40} />
            <Skeleton width={150} height={40} />
          </div>
        </div>
      </div>
      <div className="container section">
        <HeadingBlock lines={1} />
        <div className="skeleton-gap">
          <TripGridSkeleton count={8} />
        </div>
      </div>
    </SkeletonScreen>
  );
}

export function FormSkeleton() {
  return (
    <SkeletonScreen>
      <div className="container container-narrow section stack-xl">
        <HeadingBlock width="60%" />
        <Skeleton height={110} />
        <div className="row">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} width={80 + (i % 3) * 16} height={40} radius="full" />
          ))}
        </div>
        <Skeleton height={220} />
        <Skeleton width={140} height={40} />
      </div>
    </SkeletonScreen>
  );
}

export function TripSkeleton() {
  return (
    <div className="container section">
      <TripPlanSkeleton />
    </div>
  );
}

export function GridSkeleton() {
  return (
    <div className="container section">
      <SkeletonScreen label="Loading your trips">
        <HeadingBlock width="25%" lines={1} />
      </SkeletonScreen>
      <div className="skeleton-gap">
        <TripGridSkeleton />
      </div>
    </div>
  );
}

export function ArticleSkeleton() {
  return (
    <SkeletonScreen>
      <div className="container section">
        <div className="stack-md legal-head">
          <Skeleton width={60} height={14} radius="full" />
          <Skeleton width="50%" height={44} />
          <SkeletonText lines={2} />
        </div>
        <div className="legal-layout">
          <SkeletonText lines={8} />
          <div className="stack-xxl">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="stack-md">
                <Skeleton width="35%" height={22} />
                <SkeletonText lines={4} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </SkeletonScreen>
  );
}

export function MessageSkeleton() {
  return (
    <SkeletonScreen>
      <div className="container container-narrow section stack-xl">
        <Skeleton width={64} height={64} radius="full" />
        <Skeleton width="80%" height={44} />
        <SkeletonText lines={2} />
        <div className="row">
          <Skeleton width={120} height={40} />
          <Skeleton width={110} height={40} />
        </div>
      </div>
    </SkeletonScreen>
  );
}
