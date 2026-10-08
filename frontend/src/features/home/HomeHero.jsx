import { Link } from "react-router-dom";
import { Button } from "@/components/ui";
import { ExamplePrompts } from "@/features/planner";
import { HERO } from "./content";

export default function HomeHero({ onPlan }) {
  return (
    <section className="home-hero">
      <div className="container home-hero-inner">
        <h1 className="t-display-xl home-hero-title">{HERO.title}</h1>
        <p className="t-body-md c-body home-hero-sub">{HERO.body}</p>
        <div className="row home-hero-actions">
          <Button as={Link} to="/plan">
            Start planning
          </Button>
          <Button as="a" href="#how-it-works" variant="tertiary">
            See how it works
          </Button>
        </div>
        <ExamplePrompts title="Try one of these" onPick={onPlan} className="home-examples" />
      </div>
    </section>
  );
}
