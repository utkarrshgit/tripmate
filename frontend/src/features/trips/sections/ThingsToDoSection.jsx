import { Masonry, OverlayPill, PinCard, Section } from "@/components/ui";
import { rupees } from "@/utils/format";
import { titleCase } from "../tripMeta";

const RATIOS = ["4 / 5", "1 / 1", "3 / 4", "4 / 5"];

/** Activities and food as pins: the name and price ride on the image, nothing underneath. */
export default function ThingsToDoSection({ plan }) {
  const items = [
    ...(plan.activities ?? []).map((a) => ({ key: a.name, name: a.name, price: rupees(a.estimated_cost) })),
    ...(plan.food_options ?? []).map((f) => ({
      key: f.category,
      name: titleCase(f.category),
      price: `${rupees(f.estimated_daily_per_person)} per person a day`,
    })),
  ];
  if (!items.length) return null;

  return (
    <Section id="things-to-do" title="Things to do and eat">
      <Masonry>
        {items.map((item, i) => (
          <PinCard
            key={item.key}
            alt={item.name}
            ratio={RATIOS[i % RATIOS.length]}
            topRight={<OverlayPill>{item.price}</OverlayPill>}
            bottomLeft={<OverlayPill>{item.name}</OverlayPill>}
          />
        ))}
      </Masonry>
    </Section>
  );
}
