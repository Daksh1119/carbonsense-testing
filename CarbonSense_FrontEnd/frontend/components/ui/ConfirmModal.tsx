'use client';

import React from 'react';
import Modal, { ModalProps } from './Modal';
import { AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';
import { clsx } from 'clsx';

export interface ConfirmModalProps extends Omit<ModalProps, 'children' | 'footer'> {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  isLoading?: boolean;
}

/**
 * ConfirmModal Component
 * Pre-configured modal for confirmation dialogs (delete, submit, etc.)
 */
const ConfirmModal: React.FC<ConfirmModalProps> = ({
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onClose,
  variant = 'info',
  isLoading = false,
  ...modalProps
}) => {
  const handleConfirm = async () => {
    await onConfirm();
    onClose();
  };

  const variantConfig = {
    danger: {
      icon: XCircle,
      iconColor: 'text-red-500',
      iconBg: 'bg-red-500/10',
      buttonClass: 'bg-red-600 hover:bg-red-700',
    },
    warning: {
      icon: AlertTriangle,
      iconColor: 'text-orange-500',
      iconBg: 'bg-orange-500/10',
      buttonClass: 'bg-orange-600 hover:bg-orange-700',
    },
    info: {
      icon: Info,
      iconColor: 'text-blue-500',
      iconBg: 'bg-blue-500/10',
      buttonClass: 'bg-blue-600 hover:bg-blue-700',
    },
    success: {
      icon: CheckCircle,
      iconColor: 'text-emerald-500',
      iconBg: 'bg-emerald-500/10',
      buttonClass: 'bg-emerald-600 hover:bg-emerald-700',
    },
  };

  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <Modal
      {...modalProps}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className={clsx(
              'px-4 py-2 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2',
              config.buttonClass
            )}
          >
            {isLoading && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={clsx('p-3 rounded-full flex-shrink-0', config.iconBg)}>
          <Icon className={clsx('w-6 h-6', config.iconColor)} />
        </div>

        {/* Message */}
        <div className="flex-1 pt-1">
          <p className="text-slate-200 leading-relaxed">{message}</p>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
