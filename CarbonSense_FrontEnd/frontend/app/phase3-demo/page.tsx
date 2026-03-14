'use client';

import React, { useState } from 'react';
import { 
  showSuccessToast, 
  showErrorToast, 
  showInfoToast 
} from '@/lib/toast';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import FormModal from '@/components/ui/FormModal';
import FileUpload from '@/components/ui/FileUpload';
import CollapsibleSidebar from '@/components/CollapsibleSidebar';
import { 
  Layout, 
  PanelLeftClose, 
  MessageSquare, 
  AlertCircle, 
  FileUp, 
  CheckCircle 
} from 'lucide-react';

/**
 * Phase 3 Demo Page
 * Demonstrates collapsible sidebar, modal system, and file upload
 */
export default function Phase3DemoPage() {
  // Modal states
  const [isBasicModalOpen, setIsBasicModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({ name: '', email: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // File upload state
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // Confirm modal variant
  const [confirmVariant, setConfirmVariant] = useState<'danger' | 'warning' | 'info' | 'success'>('danger');

  // Handle file upload
  const handleFilesAccepted = async (files: File[]) => {
    showInfoToast(`${files.length} file(s) selected`);
    
    // Simulate upload
    setIsUploading(true);
    setUploadProgress(0);

    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          showSuccessToast('Files uploaded successfully!');
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  // Handle form submit
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    showSuccessToast(`Form submitted: ${formData.name}`);
    setIsSubmitting(false);
    setIsFormModalOpen(false);
    setFormData({ name: '', email: '' });
  };

  // Handle confirm action
  const handleConfirm = async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    showSuccessToast('Action confirmed!');
  };

  return (
    <div className="flex min-h-screen bg-slate-900">
      {/* Collapsible Sidebar */}
      <CollapsibleSidebar />

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-8 space-y-8">
          {/* Header */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <h1 className="text-3xl font-bold text-slate-50 mb-2">
              Phase 3 Feature Demonstration
            </h1>
            <p className="text-slate-400">
              Test the collapsible sidebar, modal system, and file upload components
            </p>
          </div>

          {/* Feature 1: Collapsible Sidebar */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-slate-50 mb-4 flex items-center gap-2">
              <Layout className="w-5 h-5 text-emerald-500" />
              1. Collapsible Sidebar
            </h2>
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-slate-200 mb-2">Features:</h3>
                <ul className="text-sm text-slate-400 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 mt-1">✓</span>
                    <span><strong>Desktop:</strong> Click the chevron button to collapse/expand (icon-only mode)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 mt-1">✓</span>
                    <span><strong>Mobile:</strong> Hamburger menu opens drawer overlay</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 mt-1">✓</span>
                    <span><strong>Persistent:</strong> State saved in localStorage</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 mt-1">✓</span>
                    <span><strong>Responsive:</strong> Adapts to screen size automatically</span>
                  </li>
                </ul>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <PanelLeftClose className="w-4 h-4" />
                <span>Look left → Try collapsing the sidebar with the button</span>
              </div>
            </div>
          </div>

          {/* Feature 2: Modal System */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-slate-50 mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-500" />
              2. Modal System
            </h2>
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Three reusable modal components with accessibility, animations, and keyboard navigation
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Basic Modal */}
                <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-slate-200 mb-2">Basic Modal</h3>
                  <p className="text-xs text-slate-400 mb-3">
                    Customizable dialog with header, body, and footer
                  </p>
                  <button
                    onClick={() => setIsBasicModalOpen(true)}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Open Basic Modal
                  </button>
                </div>

                {/* Confirm Modal */}
                <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-slate-200 mb-2">Confirm Modal</h3>
                  <p className="text-xs text-slate-400 mb-3">
                    Pre-configured for confirmation actions (4 variants)
                  </p>
                  <div className="space-y-2">
                    <select
                      value={confirmVariant}
                      onChange={(e) => setConfirmVariant(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                    >
                      <option value="danger">Danger (Delete)</option>
                      <option value="warning">Warning</option>
                      <option value="info">Info</option>
                      <option value="success">Success</option>
                    </select>
                    <button
                      onClick={() => setIsConfirmModalOpen(true)}
                      className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                    >
                      Open Confirm Modal
                    </button>
                  </div>
                </div>

                {/* Form Modal */}
                <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-slate-200 mb-2">Form Modal</h3>
                  <p className="text-xs text-slate-400 mb-3">
                    Form submissions with loading states and validation
                  </p>
                  <button
                    onClick={() => setIsFormModalOpen(true)}
                    className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Open Form Modal
                  </button>
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-300">
                    <strong>Accessibility:</strong> ESC to close, focus trapping, keyboard navigation, ARIA labels
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature 3: File Upload */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-slate-50 mb-4 flex items-center gap-2">
              <FileUp className="w-5 h-5 text-orange-500" />
              3. File Upload Component
            </h2>
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Drag-and-drop file upload with react-dropzone, validation, preview, and progress
              </p>

              <FileUpload
                onFilesAccepted={handleFilesAccepted}
                onFilesRejected={(rejections) => {
                  showErrorToast(`${rejections.length} file(s) rejected`);
                }}
                maxFiles={5}
                maxSize={10 * 1024 * 1024} // 10MB
                multiple={true}
                showPreview={true}
                uploadProgress={uploadProgress}
                isUploading={isUploading}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-slate-200 mb-2">Features:</h3>
                  <ul className="text-xs text-slate-400 space-y-1">
                    <li>✓ Drag & drop interface</li>
                    <li>✓ File type validation</li>
                    <li>✓ File size validation (10MB max)</li>
                    <li>✓ Image preview</li>
                    <li>✓ Upload progress bar</li>
                    <li>✓ Multiple file support</li>
                  </ul>
                </div>
                <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-slate-200 mb-2">Supported Formats:</h3>
                  <ul className="text-xs text-slate-400 space-y-1">
                    <li>📊 CSV files (.csv)</li>
                    <li>📄 PDF documents (.pdf)</li>
                    <li>🖼️ Images (.png, .jpg, .jpeg, .gif, .webp)</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Success Summary */}
          <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-emerald-400 mb-2">
                  Phase 3 Implementation Complete!
                </h3>
                <p className="text-slate-300 text-sm mb-3">
                  All Phase 3 features are fully functional and production-ready.
                </p>
                <ul className="text-sm text-slate-400 space-y-1">
                  <li>✅ Collapsible sidebar with persistent state</li>
                  <li>✅ Modal system (3 components with accessibility)</li>
                  <li>✅ File upload with drag-drop and validation</li>
                  <li>✅ Mobile responsive design</li>
                  <li>✅ TypeScript type safety</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      <Modal
        isOpen={isBasicModalOpen}
        onClose={() => setIsBasicModalOpen(false)}
        title="Basic Modal Example"
        description="This is a customizable modal component with full control over content"
        size="md"
        footer={
          <button
            onClick={() => setIsBasicModalOpen(false)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors"
          >
            Got it!
          </button>
        }
      >
        <div className="space-y-4">
          <p className="text-slate-300">
            This modal demonstrates the base Modal component. You can customize:
          </p>
          <ul className="text-sm text-slate-400 space-y-2 list-disc list-inside">
            <li>Size (sm, md, lg, xl, full)</li>
            <li>Content (any React components)</li>
            <li>Footer actions</li>
            <li>Close behavior (overlay click, ESC key)</li>
            <li>Show/hide close button</li>
          </ul>
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
            <p className="text-sm text-slate-300">
              <strong>Keyboard shortcuts:</strong> Press <kbd className="px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs">ESC</kbd> to close
            </p>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title={`${confirmVariant.charAt(0).toUpperCase() + confirmVariant.slice(1)} Confirmation`}
        message={`Are you sure you want to perform this ${confirmVariant} action? This demonstrates the ${confirmVariant} variant of the ConfirmModal component.`}
        variant={confirmVariant}
        confirmLabel="Yes, proceed"
        cancelLabel="Cancel"
        onConfirm={handleConfirm}
      />

      <FormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title="Example Form"
        description="Submit this form to see the loading state and validation"
        onSubmit={handleFormSubmit}
        submitLabel="Submit Form"
        isSubmitting={isSubmitting}
        isValid={formData.name.length > 0 && formData.email.length > 0}
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-1">
              Name *
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="Enter your name"
              required
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">
              Email *
            </label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="Enter your email"
              required
            />
          </div>
          <p className="text-xs text-slate-500">
            * Submit button is disabled until all fields are filled
          </p>
        </div>
      </FormModal>
    </div>
  );
}
