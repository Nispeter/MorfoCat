interface ConfusionMatrixProps {
  matrix: number[][];
  labels: string[];
  title?: string;
}

export function ConfusionMatrix({ matrix, labels, title }: ConfusionMatrixProps) {
  const maxVal = Math.max(...matrix.flat());
  const total = matrix.reduce((s, row) => s + row.reduce((a, b) => a + b, 0), 0);
  const correct = matrix.reduce((s, row, i) => s + (row[i] ?? 0), 0);
  const accuracy = total > 0 ? ((correct / total) * 100).toFixed(1) : "—";

  return (
    <div className="space-y-2">
      {title && (
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{title}</p>
          <span className="text-xs text-muted-foreground">Overall accuracy: {accuracy}%</span>
        </div>
      )}
      <div className="overflow-auto">
        <table className="text-xs border-collapse">
          <thead>
            <tr>
              <th className="p-1 text-left text-muted-foreground">Pred →</th>
              {labels.map((l) => (
                <th key={l} className="p-1.5 text-center font-medium min-w-[40px]">{l}</th>
              ))}
              <th className="p-1.5 text-center text-muted-foreground">Total</th>
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => {
              const rowTotal = row.reduce((a, b) => a + b, 0);
              return (
                <tr key={i}>
                  <td className="p-1 pr-3 text-right font-medium">{labels[i]}</td>
                  {row.map((val, j) => {
                    const isDiag = i === j;
                    const intensity = maxVal > 0 ? val / maxVal : 0;
                    const bg = isDiag
                      ? `hsla(142,71%,45%,${0.1 + intensity * 0.5})`
                      : val > 0 ? `hsla(0,84%,60%,${0.1 + intensity * 0.4})` : "transparent";
                    return (
                      <td key={j} className="p-1.5 text-center rounded font-mono" style={{ background: bg }}>
                        {val}
                      </td>
                    );
                  })}
                  <td className="p-1.5 text-center text-muted-foreground">{rowTotal}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
