import type { FC } from "hono/jsx";
import { Alert } from "../../../components/Alert";
import { Action } from "../../../../utils/Action";

const Confirm = Action("confirm");

export const View: FC = () => (
  <section>
    <nav>
      <ul>
        <li><a href="/_demo/state"><strong>State() Demos</strong></a></li>
      </ul>
    </nav>

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

    <h2>Interactive — Confirm Action</h2>
    <p>
      The link below uses <code>Confirm.Trigger</code> without a Wrapper.
      Data params (<code>message</code>) are passed directly to Trigger
      and converted to <code>data-confirm-message</code>.
    </p>
    <Confirm.Trigger event="click" method="ask" message="Are you sure you want to proceed?">
      <a href="/" role="button">Try confirm dialog</a>
    </Confirm.Trigger>

    <p>
      Alerts above are dismissible via the <code>dismiss</code> handler.
      Click the ✕ button on any alert to dismiss it.
    </p>
  </section>
);
