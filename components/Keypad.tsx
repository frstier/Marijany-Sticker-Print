import React from 'react';

interface KeypadProps {
  onKeyPress: (key: string) => void;
  onClear: () => void;
  onBackspace: () => void;
}

const Keypad: React.FC<KeypadProps> = ({ onKeyPress, onClear, onBackspace }) => {
  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0'];

  return (
    <div className="grid grid-cols-3 gap-2 mt-2">
      {keys.map((key) => (
        <button
          key={key}
          onClick={() => onKeyPress(key)}
          className="bg-[#CB8E00] hover:bg-[#b07b00] border border-[#a67400] text-white font-bold py-3 md:py-4 rounded-lg shadow-sm active:scale-95 transition-all text-lg md:text-xl"
        >
          {key}
        </button>
      ))}
      <button
        onClick={onBackspace}
        className="bg-[#d9a21b] hover:bg-[#b07b00] border border-[#a67400] text-white font-bold py-3 md:py-4 rounded-lg shadow-sm active:scale-95 transition-all"
      >
        ←
      </button>
      <button
        onClick={onClear}
        className="col-span-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 md:py-3 rounded-lg border border-slate-300 active:scale-95 transition-all uppercase text-xs md:text-sm tracking-wider"
      >
        Очистити
      </button>
    </div>
  );
};

export default Keypad;