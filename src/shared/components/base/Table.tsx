import React from 'react';

export interface TableProps extends React.HTMLAttributes<HTMLTableElement> {}

export const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className = '', ...props }, ref) => {
    return (
      <div className="w-full overflow-auto rounded-lg border-2 border-gray-100">
        <table
          ref={ref}
          className={`w-full caption-bottom text-sm ${className}`}
          {...props}
        />
      </div>
    );
  }
);

Table.displayName = 'Table';

export const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className = '', ...props }, ref) => {
    return (
      <thead
        ref={ref}
        className={`bg-gradient-to-b from-gray-50 to-gray-100/80 border-b-2 border-gray-200 ${className}`}
        {...props}
      />
    );
  }
);

TableHeader.displayName = 'TableHeader';

export const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className = '', ...props }, ref) => {
    return (
      <tbody
        ref={ref}
        className={`[&_tr:last-child]:border-0 divide-y divide-gray-100 ${className}`}
        {...props}
      />
    );
  }
);

TableBody.displayName = 'TableBody';

export const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className = '', ...props }, ref) => {
    return (
      <tr
        ref={ref}
        className={`transition-colors hover:bg-blue-50/50 data-[state=selected]:bg-blue-50 ${className}`}
        {...props}
      />
    );
  }
);

TableRow.displayName = 'TableRow';

export const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className = '', ...props }, ref) => {
    return (
      <th
        ref={ref}
        className={`h-12 px-4 text-left align-middle font-semibold text-gray-700 [&:has([role=checkbox])]:pr-0 ${className}`}
        {...props}
      />
    );
  }
);

TableHead.displayName = 'TableHead';

export const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className = '', ...props }, ref) => {
    return (
      <td
        ref={ref}
        className={`p-4 align-middle text-gray-700 [&:has([role=checkbox])]:pr-0 ${className}`}
        {...props}
      />
    );
  }
);

TableCell.displayName = 'TableCell';
