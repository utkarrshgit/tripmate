import { Link } from "react-router-dom";
import { Button, FeatureRow, Section } from "@/components/ui";
import { HOW_IT_WORKS } from "./content";

export default function HowItWorks() {
  return (
    <Section id="how-it-works" title="How it works">
      <div className="stack-sm">
        {HOW_IT_WORKS.map((step, i) => (
          <FeatureRow
            key={step.title}
            eyebrow={`Step ${i + 1}`}
            title={step.title}
            body={step.body}
            image={step.image}
            alt={step.alt}
            soft={i % 2 === 1}
            reversed={i % 2 === 1}
            action={
              step.cta.to ? (
                <Button as={Link} to={step.cta.to}>
                  {step.cta.label}
                </Button>
              ) : (
                <Button as="a" href={step.cta.href}>
                  {step.cta.label}
                </Button>
              )
            }
          />
        ))}
      </div>
    </Section>
  );
}
