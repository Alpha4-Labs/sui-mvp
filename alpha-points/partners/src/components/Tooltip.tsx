import React, { ReactNode } from 'react';
import { Popover, Transition } from '@headlessui/react';

// Define the props interface
interface TooltipProps {
  children: ReactNode;
  text: string;
  position?: 'bottom' | 'top' | 'left' | 'right';
}

// Reusable Tooltip Component
export const Tooltip: React.FC<TooltipProps> = ({ 
  children, 
  text, 
  position = 'bottom' 
}) => {
  // Basic position adjustment (can be made more complex if needed)
  const positionClasses = {
    bottom: "transform -translate-x-1/2 left-1/2 sm:left-auto sm:right-0 sm:translate-x-0", // Default
    top: "transform -translate-x-1/2 left-1/2 bottom-full mb-2",
    left: "right-full mr-2 transform -translate-y-1/2 top-1/2",
    right: "left-full ml-2 transform -translate-y-1/2 top-1/2",
  };

  return (
    <Popover className="relative inline-block">
      {({ open }) => (
        <>
          <Popover.Button className="focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75">
            {children}
          </Popover.Button>
          <Transition
            as={React.Fragment}
            show={open}
            enter="transition ease-out duration-200"
            enterFrom="opacity-0 translate-y-1"
            enterTo="opacity-100 translate-y-0"
            leave="transition ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 translate-y-1"
          >
            <Popover.Panel
                className={`absolute z-50 w-64 px-4 py-2 mt-2 text-sm text-white bg-gray-900 border border-gray-700 rounded-lg shadow-xl ${positionClasses[position]}`}
            >
              {text}
            </Popover.Panel>
          </Transition>
        </>
      )}
    </Popover>
  );
}

export default Tooltip;