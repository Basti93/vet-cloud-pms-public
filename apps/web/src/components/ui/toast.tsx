"use client";

import { useToast } from "@/lib/toast/context";
import { X } from "lucide-react";

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2 max-w-md pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            rounded-lg p-4 text-sm font-medium shadow-lg animate-in fade-in slide-in-from-top-2 duration-300 pointer-events-auto
            ${
              toast.type === "success"
                ? "bg-green-100 text-green-800 border border-green-200"
                : toast.type === "error"
                  ? "bg-red-100 text-red-800 border border-red-200"
                  : "bg-blue-100 text-blue-800 border border-blue-200"
            }
          `}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {toast.type === "success" && <span>✓</span>}
              {toast.type === "error" && <span>✕</span>}
              {toast.type === "info" && <span>ℹ</span>}
              <span>{toast.message}</span>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-current opacity-70 hover:opacity-100 flex-shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
