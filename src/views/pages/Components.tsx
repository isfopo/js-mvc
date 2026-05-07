import type { FC } from "hono/jsx";
import { Alert } from "../components/Alert";

export const Components: FC = () => (
  <section>
    <h2>Alerts</h2>

    <Alert variant="info" header="New Feature Available">
      We've added dark mode support! Check your system preferences to enable it.
    </Alert>

    <Alert variant="success" header="Profile Updated">
      Your profile changes have been saved successfully.
    </Alert>

    <Alert variant="warning" header="Storage Almost Full">
      You've used 90% of your storage. Upgrade your plan to get more space.
    </Alert>

    <Alert variant="error" header="Payment Failed">
      Your credit card was declined. Please update your payment method.
    </Alert>
  </section>
);
