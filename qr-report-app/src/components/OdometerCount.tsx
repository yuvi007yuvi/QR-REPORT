import React from 'react';

interface OdometerCountProps {
  value: number;
  className?: string;
}

const DigitColumn = ({ digit }: { digit: string }) => {
  // If it's a comma or formatting character, just render it normally
  if (isNaN(parseInt(digit, 10))) {
    return <span className="inline-block">{digit}</span>;
  }

  const num = parseInt(digit, 10);
  
  return (
    <span className="inline-flex relative overflow-hidden">
      {/* Invisible spacer to maintain correct dimensions based on the active font */}
      <span className="invisible leading-none">0</span>
      
      {/* Absolute positioned column of digits */}
      <span 
        className="absolute top-0 left-0 w-full flex flex-col transition-transform duration-[800ms] ease-out"
        style={{ transform: `translateY(-${num * 10}%)` }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <span key={n} className="leading-none flex justify-center">
            {n}
          </span>
        ))}
      </span>
    </span>
  );
};

export const OdometerCount: React.FC<OdometerCountProps> = ({ value, className = '' }) => {
  // Convert number to formatted string with commas
  const formattedString = value.toLocaleString('en-US');
  const digits = formattedString.split('');

  return (
    <span className={`inline-flex items-center ${className}`}>
      {digits.map((char, i) => (
        <DigitColumn key={`digit-${digits.length - i}`} digit={char} />
      ))}
    </span>
  );
};
