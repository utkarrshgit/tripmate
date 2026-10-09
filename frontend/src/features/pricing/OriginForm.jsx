import { useState } from "react";
import { Button, TextField } from "@/components/ui";

/** "Starting city" + the button that fetches exact prices. */
export default function OriginForm({ initialOrigin = "", hasResult, loading, onSubmit }) {
  const [origin, setOrigin] = useState(initialOrigin);

  return (
    <form
      className="origin-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(origin.trim());
      }}
    >
      <TextField
        label="Starting city"
        value={origin}
        onChange={(e) => setOrigin(e.target.value)}
        placeholder="Delhi"
        autoComplete="address-level2"
        help="Needed for flight and train prices. Leave it empty to price stays only."
      />
      <Button type="submit" variant="primary" icon="search" disabled={loading}>
        {loading ? "Checking prices…" : hasResult ? "Check again" : "Get exact prices"}
      </Button>
    </form>
  );
}
