'use client';

import React, { FormEvent } from 'react';
import Modal, { ModalProps } from './Modal';
import { clsx } from 'clsx';

export interface FormModalProps extends Omit<ModalProps, 'children' | 'footer'> {
  children: React.ReactNode;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void | Promise<void>;
  submitLabel?: string;
  cancelLabel?: string;
  isSubmitting?: boolean;
  isValid?: boolean;
  submitVariant?: 'primary' | 'danger' | 'success';
}

/**
 * FormModal Component
 * Pre-configured modal for form submissions
 */
const FormModal: React.FC<FormModalProps> = ({
  children,
  onSubmit,
  onClose,
  submitLabel = 'Submit',
  cancelLabel = 'Cancel',
  isSubmitting = false,
  isValid = true,
  submitVariant = 'primary',
  ...modalProps
}) => {
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await onSubmit(e);
  };

  const submitButtonClasses = {
    primary: 'bg-emerald-600 hover:bg-emerald-700',
    danger: 'bg-red-600 hover:bg-red-700',
    success: 'bg-blue-600 hover:bg-blue-700',
  };

  return (
    <Modal
      {...modalProps}
      onClose={onClose}
      closeOnOverlayClick={!isSubmitting}
      closeOnEscape={!isSubmitting}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            form="form-modal-form"
            disabled={isSubmitting || !isValid}
            className={clsx(
              'px-4 py-2 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2',
              submitButtonClasses[submitVariant]
            )}
          >
            {isSubmitting && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {isSubmitting ? 'Submitting...' : submitLabel}
          </button>
        </>
      }
    >
      <form id="form-modal-form" onSubmit={handleSubmit} className="space-y-4">
        {children}
      </form>
    </Modal>
  );
};

export default FormModal;
