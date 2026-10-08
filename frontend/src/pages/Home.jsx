import { Link, useNavigate } from "react-router-dom";
import { Button, HeroCtaStrip } from "@/components/ui";
import { DestinationGrid, HomeHero, HowItWorks, PlannerTiles } from "@/features/home";

export default function Home() {
  const navigate = useNavigate();
  const planFrom = (query) => navigate("/plan", { state: { query, run: true } });

  return (
    <>
      <HomeHero onPlan={planFrom} />
      <div className="container">
        <DestinationGrid onPlan={planFrom} />
        <HowItWorks />
        <PlannerTiles />
      </div>
      <div className="section">
        <HeroCtaStrip
          title="Your next trip starts with one sentence."
          action={
            <Button as={Link} to="/plan" variant="primary">
              Plan a trip
            </Button>
          }
        />
      </div>
    </>
  );
}
