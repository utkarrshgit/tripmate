import { Chip, ChipStrip } from "@/components/ui";
import { INTERESTS } from "@/data/catalog";
import { mentions, toggleInterest } from "./requestDetails";

const titleCase = (word) => word[0].toUpperCase() + word.slice(1);

/** Interest chips that write themselves into (or out of) the request text. */
export default function InterestPicker({ query, onChange }) {
  return (
    <fieldset className="interest-picker">
      <legend className="field-label">Add interests</legend>
      <ChipStrip>
        {INTERESTS.map((word) => (
          <Chip key={word} pressed={mentions(query, word)} onClick={() => onChange(toggleInterest(query, word))}>
            {titleCase(word)}
          </Chip>
        ))}
      </ChipStrip>
    </fieldset>
  );
}
