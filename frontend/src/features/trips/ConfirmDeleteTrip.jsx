import { Button, Modal } from "@/components/ui";

export default function ConfirmDeleteTrip({ trip, onCancel, onConfirm }) {
  return (
    <Modal title="Delete this trip?" onClose={onCancel}>
      {({ close }) => (
        <div className="stack-xl modal-body">
          <p className="t-body-md c-body">
            Your saved plan for <strong className="c-ink">{trip.plan.destination}</strong> will be removed. This can't be
            undone.
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
