import React from 'react';
import { MainLayout } from '../layouts/MainLayout';
import { LoanPanel } from '../components/LoanPanel';

export const LoanPage: React.FC = () => {
  return (
    <MainLayout>
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Alpha Points Loans</h1>
        <p className="text-gray-400">Borrow Alpha Points against your staked assets.</p>
      </div>
      
      <div className="bg-background-card rounded-lg shadow-lg mb-6 p-6">
        <h2 className="text-xl font-semibold text-white mb-4">How Loans Work</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-background p-4 rounded-lg">
            <div className="text-4xl text-primary mb-3 text-center">①</div>
            <h3 className="text-white font-medium text-center mb-2">Select Stake Position</h3>
            <p className="text-gray-400 text-sm text-center">
              Choose one of your active stake positions to use as collateral for your loan.
            </p>
          </div>
          
          <div className="bg-background p-4 rounded-lg">
            <div className="text-4xl text-primary mb-3 text-center">②</div>
            <h3 className="text-white font-medium text-center mb-2">Borrow Alpha Points</h3>
            <p className="text-gray-400 text-sm text-center">
              Borrow up to 70% of your stake's value in Alpha Points. Points are added to your balance instantly.
            </p>
          </div>
          
          <div className="bg-background p-4 rounded-lg">
            <div className="text-4xl text-primary mb-3 text-center">③</div>
            <h3 className="text-white font-medium text-center mb-2">Repay When Ready</h3>
            <p className="text-gray-400 text-sm text-center">
              Repay your loan plus interest to unlock your stake. Interest accrues at 5% APR.
            </p>
          </div>
        </div>
        
        <div className="border-t border-gray-700 pt-4 text-center text-gray-400 text-sm">
          Note: Your stake will remain locked until the loan is repaid, even if the original lock period has expired.
        </div>
      </div>
      
      <LoanPanel />
    </MainLayout>
  );
};