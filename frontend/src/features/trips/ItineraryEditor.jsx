import { useState } from "react";
import { Button, IconButton, Modal, TextField } from "@/components/ui";
import { addItem, deleteItem, updateItem } from "@/state/tripsApi";
import { plural, rupees } from "@/utils/format";
import { DAY_PARTS } from "./tripMeta";

/** One item, shown as text with Edit and Remove; Edit swaps in the fields. */
function ItemRow({ item, busy, onSave, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [cost, setCost] = useState(String(item.estCost));

  if (!editing) {
    return (
      <li className="editor-item">
        <span className="t-body-md c-ink">{item.title}</span>
        {item.estCost > 0 && <span className="t-body-sm c-mute">{rupees(item.estCost)}</span>}
        <span className="row editor-item-actions">
          <IconButton icon="edit" size={18} label={`Edit ${item.title}`} onClick={() => setEditing(true)} disabled={busy} />
          <IconButton icon="trash" size={18} label={`Remove ${item.title}`} onClick={onRemove} disabled={busy} />
        </span>
      </li>
    );
  }
  return (
    <li className="editor-item is-editing">
      <form
        className="stack-sm"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await onSave({ title: title.trim(), estCost: Math.max(0, Number(cost) || 0) })) setEditing(false);
        }}
      >
        <TextField label="What's planned" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} autoFocus />
        <TextField label="Estimated cost per person, in rupees" type="number" min="0" inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value)} />
        <div className="row">
          <Button type="submit" variant="primary" disabled={busy || !title.trim()}>
            Save
          </Button>
          <Button onClick={() => (setEditing(false), setTitle(item.title), setCost(String(item.estCost)))}>Cancel</Button>
        </div>
      </form>
    </li>
  );
}

/** Adds an item to a day and part of the day. */
function AddItem({ day, slot, busy, onAdd }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  if (!open) {
    return (
      <Button variant="tertiary" icon="plus" onClick={() => setOpen(true)} disabled={busy}>
        Add to {slot.label.toLowerCase()}
      </Button>
    );
  }
  return (
    <form
      className="stack-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await onAdd({ dayNo: day, slot: slot.key, title: title.trim(), estCost: 0 })) {
          setTitle("");
          setOpen(false);
        }
      }}
    >
      <TextField label={`Add to the ${slot.label.toLowerCase()} of day ${day}`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} autoFocus />
      <div className="row">
        <Button type="submit" variant="primary" disabled={busy || !title.trim()}>
          Add
        </Button>
        <Button onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}

/**
 * Edit days: every item of the current version, by day and part of the day. Each change
 * is saved straight away and comes back as the updated trip (with its new total).
 */
export default function ItineraryEditor({ trip, onChange, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const days = Math.max(trip.plan.days ?? 0, ...trip.items.map((i) => i.dayNo));

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      onChange(await action());
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Edit days" onClose={onClose}>
      {({ close }) => (
        <div className="stack-xl modal-body itinerary-editor">
          <p className="t-body-sm c-mute">
            {plural(days, "day")} · {rupees(trip.plan.total_cost)} estimated in total. Changes are saved as you make them, and costs update the total.
          </p>
          {Array.from({ length: days }, (_, i) => i + 1).map((day) => (
            <section key={day} className="stack-md editor-day" aria-labelledby={`editor-day-${day}`}>
              <h3 id={`editor-day-${day}`} className="t-heading-md">
                Day {day}
              </h3>
              {DAY_PARTS.map((slot) => {
                const items = trip.items.filter((i) => i.dayNo === day && i.slot === slot.key);
                return (
                  <div key={slot.key} className="stack-sm">
                    <p className="t-body-sm-strong c-mute">{slot.label}</p>
                    {items.length > 0 && (
                      <ul className="editor-items">
                        {items.map((item) => (
                          <ItemRow
                            key={item.id}
                            item={item}
                            busy={busy}
                            onSave={(changes) => run(() => updateItem(trip.id, item.id, changes))}
                            onRemove={() => run(() => deleteItem(trip.id, item.id))}
                          />
                        ))}
                      </ul>
                    )}
                    <AddItem day={day} slot={slot} busy={busy} onAdd={(item) => run(() => addItem(trip.id, item))} />
                  </div>
                );
              })}
            </section>
          ))}
          {error && (
            <p className="field-error swap-in" role="alert">
              {error}
            </p>
          )}
          <div className="row modal-actions">
            <Button variant="primary" onClick={close}>
              Done
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
