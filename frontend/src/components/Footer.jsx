// src/components/Footer.jsx
import React from 'react';

/**
 * Footer component with links and copyright information
 */
function Footer() {
  return (
    <footer className="w-full max-w-4xl mt-12 mb-4 text-center">
      <div className="mb-3">
        <a href="https://alpha4.io" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 mx-2 transition duration-200">
          Main Site
        </a>
        <span className="text-gray-600">•</span>
        <a href="https://discord.gg/VuF5NmC9Dg" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 mx-2 transition duration-200">
          Discord
        </a>
        <span className="text-gray-600">•</span>
        <a href="https://www.linkedin.com/company/alpha4-io" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 mx-2 transition duration-200">
          LinkedIn
        </a>
        <span className="text-gray-600">•</span>
        <a href="https://x.com/alpha4_io" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 mx-2 transition duration-200">
          X
        </a>
      </div>
      
      <p className="text-xs text-gray-500 max-w-lg mx-auto mb-2">
        Testnet demo for experimental purposes only. Features shown may not reflect final product and are subject to change without notice.
      </p>
      
      <p className="text-sm text-gray-600">
        Alpha Points MVP &copy; {new Date().getFullYear()}
      </p>
    </footer>
  );
}

export default Footer;