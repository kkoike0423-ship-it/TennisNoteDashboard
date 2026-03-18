import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("glass-panel overflow-hidden", className)}>
    {children}
  </div>
);

import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
}

export const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  loading = false,
  className, 
  disabled,
  ...props 
}: ButtonProps) => {
  const variants = {
    primary: "bg-tennis-green-600 text-white hover:bg-tennis-green-700 shadow-md active:scale-95",
    secondary: "bg-white text-tennis-green-700 border border-tennis-green-100 hover:bg-tennis-green-50 active:scale-95",
    ghost: "text-gray-500 hover:text-tennis-green-600 hover:bg-tennis-green-50 px-2",
    danger: "bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-500 hover:text-white active:scale-95",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs font-bold rounded-lg",
    md: "px-4 py-2 text-sm font-bold rounded-xl",
    lg: "px-6 py-3 text-base font-bold rounded-2xl",
    icon: "p-2 rounded-full",
  };

  return (
    <button 
      className={cn(
        "inline-flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" size={size === 'sm' ? 12 : 16} />}
      {children}
    </button>
  );
};

export const Input = ({ label, className, ...props }: { label?: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div className="space-y-1.5 w-full">
    {label && <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{label}</label>}
    <input 
      className={cn(
        "w-full bg-gray-50/50 border border-gray-100 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-tennis-green-500/20 focus:border-tennis-green-500 transition-all",
        className
      )}
      {...props}
    />
  </div>
);

export const Select = ({ label, children, className, ...props }: { label?: string; children: React.ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <div className="space-y-1.5 w-full">
    {label && <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{label}</label>}
    <div className="relative">
      <select 
        className={cn(
          "w-full bg-gray-50/50 border border-gray-100 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-tennis-green-500/20 focus:border-tennis-green-500 transition-all appearance-none",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </div>
    </div>
  </div>
);

