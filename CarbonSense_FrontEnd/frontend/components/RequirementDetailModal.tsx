"use client";

import Modal from "@/components/ui/Modal";
import Badge from "@/components/Badge";

export default function RequirementDetailModal({
  isOpen,
  onClose,
  requirement,
}: {
  isOpen: boolean;
  onClose: () => void;
  requirement: Record<string, unknown> | null;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" title={`Requirement: ${String(requirement?.name || "Details")}`}>
      {requirement ? (
        <div className="space-y-4 text-sm text-slate-300">
          <div className="flex flex-wrap gap-2">
            <Badge variant="info">{String(requirement.type || "data")}</Badge>
            <Badge variant="default">{String(requirement.level || "basic")}</Badge>
            <Badge variant={Boolean(requirement.is_mandatory) ? "danger" : "warning"}>{Boolean(requirement.is_mandatory) ? "Mandatory" : "Optional"}</Badge>
          </div>
          <p>{String(requirement.description || "No description available.")}</p>
          <p><span className="text-slate-400">Verification:</span> {String(requirement.verification_method || "manual")}</p>
          <p><span className="text-slate-400">Score weight:</span> {String(requirement.weight || 0)}</p>
        </div>
      ) : null}
    </Modal>
  );
}
