import { Chip, ChipStrip } from "@/components/ui";
import { EXAMPLE_PROMPTS } from "@/data/catalog";
import { shortPrompt } from "./requestDetails";

export default function ExamplePrompts({ title, onPick, className }) {
  return (
    <div className={`stack-md ${className ?? ""}`.trim()}>
      {title && <p className="t-body-sm-strong c-ink">{title}</p>}
      <ChipStrip className="example-prompts">
        {EXAMPLE_PROMPTS.map((prompt) => (
          <Chip key={prompt} onClick={() => onPick(prompt)}>
            {shortPrompt(prompt)}
          </Chip>
        ))}
      </ChipStrip>
    </div>
  );
}
