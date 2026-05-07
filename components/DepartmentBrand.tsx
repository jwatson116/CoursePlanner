import React from 'react';

const departmentHeaderUrl = new URL('../assets/department-header.jpg', import.meta.url).href;

interface DepartmentBrandProps {
  className?: string;
  imageClassName?: string;
}

export const DepartmentBrand: React.FC<DepartmentBrandProps> = ({ className = '', imageClassName = '' }) => {
  const wrapperClassName = className.trim();
  const finalWrapperClassName = wrapperClassName ? wrapperClassName : undefined;
  const finalImageClassName = [
    'w-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700',
    imageClassName,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={finalWrapperClassName}>
      <img
        src={departmentHeaderUrl}
        alt="University of Oxford Department of Computer Science"
        className={finalImageClassName}
      />
    </div>
  );
};
