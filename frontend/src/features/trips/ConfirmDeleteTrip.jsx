import { Button, Modal } from "@/components/ui";
import { tripPhrase } from "./tripMeta";

export default function ConfirmDeleteTrip({ trip, onCancel, onConfirm }) {
  return (
    <Modal title="Delete this trip?" onClose={onCancel}>
      {({ close }) => (
        <div className="stack-xl modal-body">
          <p className="t-body-md c-body">
            This deletes {tripPhrase(trip.plan)} from your saved trips. You can't undo this.
          </p>
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
