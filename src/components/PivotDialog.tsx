import React from 'react';
import { X } from 'lucide-react';

interface PivotDialogProps {
  isOpen: boolean;
  onClose: () => void;
  values: {
    r2: string;
    r1: string;
    pivot: string;
    s1: string;
    s2: string;
  };
  onChange: (field: string, value: string) => void;
  onSave: () => void;
}

const PivotDialog: React.FC<PivotDialogProps> = ({
  isOpen,
  onClose,
  values,
  onChange,
  onSave
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-96 border border-gray-700">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Enter Strike Prices</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              User Resistance 2 (R2)
            </label>
            <input
              type="number"
              value={values.r2}
              onChange={(e) => onChange('r2', e.target.value)}
              placeholder="Enter strike price"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              User Resistance 1 (R1)
            </label>
            <input
              type="number"
              value={values.r1}
              onChange={(e) => onChange('r1', e.target.value)}
              placeholder="Enter strike price"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Pivot Value
            </label>
            <input
              type="number"
              value={values.pivot}
              onChange={(e) => onChange('pivot', e.target.value)}
              placeholder="Enter strike price"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:border-yellow-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              User Support 1 (S1)
            </label>
            <input
              type="number"
              value={values.s1}
              onChange={(e) => onChange('s1', e.target.value)}
              placeholder="Enter strike price"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:border-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              User Support 2 (S2)
            </label>
            <input
              type="number"
              value={values.s2}
              onChange={(e) => onChange('s2', e.target.value)}
              placeholder="Enter strike price"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:border-green-500"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-white"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-white font-semibold"
          >
            Save Levels
          </button>
        </div>
      </div>
    </div>
  );
};

export default PivotDialog;