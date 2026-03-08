'use client';

import { Settings2, AlertTriangle } from 'lucide-react';
import { useState } from 'react';

interface ExpertModeToggleProps {
  isExpert: boolean;
  onToggle: (isExpert: boolean) => void;
  disabled?: boolean;
}

export function ExpertModeToggle({ isExpert, onToggle, disabled }: ExpertModeToggleProps) {
  const [showWarning, setShowWarning] = useState(false);

  const handleToggle = () => {
    if (!isExpert && !showWarning) {
      // Show warning before enabling expert mode
      setShowWarning(true);
      return;
    }
    
    setShowWarning(false);
    onToggle(!isExpert);
  };

  if (showWarning) {
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-amber-900 mb-1">Expert Mode</h4>
            <p className="text-sm text-amber-800 mb-3">
              Expert mode exposes advanced controls that may affect mix quality if misconfigured. 
              For best results, we recommend using the simplified options unless you have 
              specific requirements.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowWarning(false);
                  onToggle(true);
                }}
                className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
              >
                Enable Expert Mode
              </button>
              <button
                onClick={() => setShowWarning(false)}
                className="px-4 py-2 text-amber-700 text-sm font-medium hover:text-amber-900 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleToggle}
      disabled={disabled}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-lg border transition-all
        ${isExpert 
          ? 'bg-purple-50 border-purple-200 text-purple-700' 
          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
        }
        disabled:opacity-50 disabled:cursor-not-allowed
      `}
    >
      <Settings2 className="w-4 h-4" />
      <span className="text-sm font-medium">
        {isExpert ? 'Expert Mode On' : 'Expert Mode'}
      </span>
    </button>
  );
}
