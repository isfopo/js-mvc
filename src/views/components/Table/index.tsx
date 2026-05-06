import type { FC } from "hono/jsx";
import styles from "./index.module.css";

export interface TableProps {
  headers: string[];
  rows: string[][];
  compact?: boolean;
}

export const Table: FC<TableProps> = ({ headers, rows, compact = false }) => (
  <div class={styles.wrapper} data-table={compact ? "compact" : ""}>
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
