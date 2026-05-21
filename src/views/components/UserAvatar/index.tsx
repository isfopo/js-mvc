import type { FC } from "hono/jsx";
import styles from "./index.module.css";

interface Props {
  login: string;
  avatarUrl: string | null;
  size?: number;
}

export const UserAvatar: FC<Props> = ({ login, avatarUrl, size = 28 }) =>
  avatarUrl ? (
    <img
      src={avatarUrl}
      alt={login}
      width={size}
      height={size}
      class={styles.avatar}
    />
  ) : (
    <span class={styles.fallback} style={`font-size: ${size * 0.6}px;`}>
      {login[0]?.toUpperCase()}
    </span>
  );
