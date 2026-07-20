
import React from 'react';

interface ModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm?: () => void;
  onClose: () => void;
  confirmText?: string;
  cancelText?: string;
  children?: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onClose, 
  confirmText = "확인", 
  cancelText = "취소",
  children
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-400">
            <i className="fas fa-info-circle text-2xl"></i>
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">{title}</h3>
          <p className="text-slate-500 text-sm leading-relaxed mb-4">{message}</p>
          {children}
        </div>
        {!children && (
          <div className="flex border-t border-slate-100">
            {onConfirm && (
              <button 
                onClick={() => { onConfirm(); onClose(); }}
                className="flex-1 py-5 text-sm font-bold text-rose-600 hover:bg-slate-50 transition-colors border-r border-slate-100"
              >
                {confirmText}
              </button>
            )}
            <button 
              onClick={onClose}
              className={`flex-1 py-5 text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors ${!onConfirm ? 'w-full' : ''}`}
            >
              {onConfirm ? cancelText : confirmText}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
