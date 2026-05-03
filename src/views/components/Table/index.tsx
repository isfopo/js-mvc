import type { FC } from "hono/jsx";

export interface TableProps {
  headers: string[];
  rows: string[][];
  compact?: boolean;
}

export const Table: FC<TableProps> = ({ headers, rows, compact = false }) => (
  <div data-table={compact ? "compact" : ""}>
    <table>
      <thead>
        <tr>
          {headers.map((h) => (
            <th>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr>
            {row.map((cell) => (
              <td>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
