function FixesTable({ fixes }) {
  return (
    <section className="glass-card rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Detected Bugs & Fixes</h2>
        <span className="text-xs text-slate-300">{fixes.length} items</span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-700/60 text-slate-300">
              <th className="px-3 py-2">File</th>
              <th className="px-3 py-2">Bug Type</th>
              <th className="px-3 py-2">Line</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {fixes.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-slate-400" colSpan={4}>
                  No issues yet. Start the agent to populate this table.
                </td>
              </tr>
            ) : (
              fixes.map((item, index) => (
                <tr key={`${item.file}-${item.line}-${index}`} className="border-b border-slate-800/60">
                  <td className="px-3 py-2 text-slate-200">{item.file}</td>
                  <td className="px-3 py-2 text-neon">{item.bugType}</td>
                  <td className="px-3 py-2 text-slate-300">{item.line ?? '-'}</td>
                  <td className="px-3 py-2">
                    <span className={`status-badge ${item.status === 'FIXED' ? 'status-pass' : item.status === 'FAILED' ? 'status-fail' : 'status-running'}`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default FixesTable;
