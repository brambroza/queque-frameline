'use client';

type Props = {
  page: number;
  rowsPerPage: number;
  total: number;
  rowsPerPageOptions?: number[];
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rows: number) => void;
};

export function TablePaginationControls({
  page,
  rowsPerPage,
  total,
  rowsPerPageOptions = [10, 20, 50, 100],
  onPageChange,
  onRowsPerPageChange,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));
  const from = total === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const to = Math.min(total, page * rowsPerPage);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-3 text-sm">
      <p className="text-slate-500">แสดง {from}-{to} จาก {total} รายการ</p>
      <div className="flex items-center gap-2">
        <label className="text-slate-500">Rows</label>
        <select
          className="input h-9 w-20 py-1"
          value={rowsPerPage}
          onChange={(e) => onRowsPerPageChange(Number(e.target.value))}
        >
          {rowsPerPageOptions.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        <button className="btn-outline h-9 px-3 py-1" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Prev</button>
        <span className="text-slate-600">{page}/{totalPages}</span>
        <button className="btn-outline h-9 px-3 py-1" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Next</button>
      </div>
    </div>
  );
}
