'use client'

import Modal from './Modal'

export default function ConfirmDialog({
  isOpen,
  title = 'Confirm action',
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  isLoading = false,
  onConfirm,
  onClose,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={isLoading ? () => {} : onClose}
      title={title}
      size="md"
      footer={(
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="app-button-secondary"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="app-button-danger disabled:opacity-60"
          >
            {isLoading ? 'Deleting...' : confirmLabel}
          </button>
        </>
      )}
    >
      <p className="text-sm leading-6 text-var(--foreground-secondary)">
        {description}
      </p>
    </Modal>
  )
}
