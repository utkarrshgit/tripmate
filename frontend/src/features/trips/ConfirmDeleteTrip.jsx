import { Button, Modal } from "@/components/ui";
import { tripPhrase } from "./tripMeta";

export default function ConfirmDeleteTrip({ trip, error, onCancel, onConfirm }) {
  return (
    <Modal title="Delete this trip?" onClose={onCancel}>
      {({ close }) => (
        <div className="stack-xl modal-body">
          <p className="t-body-md c-body">
            This moves {tripPhrase(trip.plan)} to Recently deleted. You can restore it there for 30 days.
          </p>
          {error && (
            <p className="field-error swap-in" role="alert">
              {error}
            </p>
          )}
          <div className="row modal-actions">
            <Button onClick={close}>Cancel</Button>
            <Button variant="primary" onClick={onConfirm}>
              Delete trip
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
