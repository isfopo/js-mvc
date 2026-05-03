import type { FC } from "hono/jsx";
import { Button } from "../components/Button";
import { FormField } from "../components/FormField";
import { Card } from "../components/Card";
import { Alert } from "../components/Alert";
import { Table } from "../components/Table";

export const ComponentsShowcase: FC = () => (
  <div class="showcase">
    <section>
      <h2>Buttons</h2>

      <h3>Variants</h3>
      <div class="button-row">
        <Button variant="primary" size="md">Save Changes</Button>
        <Button variant="secondary" size="md">Cancel</Button>
        <Button variant="danger" size="md">Delete Account</Button>
        <Button variant="ghost" size="md">Learn More</Button>
      </div>

      <h3>Sizes</h3>
      <div class="button-row">
        <Button variant="primary" size="sm">Small</Button>
        <Button variant="primary" size="md">Medium</Button>
        <Button variant="primary" size="lg">Large</Button>
      </div>

      <h3>Disabled State</h3>
      <div class="button-row">
        <Button variant="primary" size="md" disabled>Submit</Button>
        <Button variant="secondary" size="md" disabled>Cancel</Button>
      </div>
    </section>

    <section>
      <h2>Form Fields</h2>

      <Card title="Create Account">
        <form>
          <FormField name="username" label="Username" placeholder="johndoe" required />
          <FormField name="email" label="Email" type="email" placeholder="john@example.com" required />
          <FormField name="password" label="Password" type="password" placeholder="••••••••" required />
          <FormField
            name="confirm-password"
            label="Confirm Password"
            type="password"
            value="mismatch"
            error="Passwords do not match"
            required
          />
          <div class="button-row">
            <Button variant="primary" type="submit">Create Account</Button>
            <Button variant="secondary" type="reset">Clear</Button>
          </div>
        </form>
      </Card>
    </section>

    <section>
      <h2>Alerts</h2>

      <Alert variant="info" title="New Feature Available">
        We've added dark mode support! Check your system preferences to enable it.
      </Alert>

      <Alert variant="success" title="Profile Updated">
        Your profile changes have been saved successfully.
      </Alert>

      <Alert variant="warning" title="Storage Almost Full">
        You've used 90% of your storage. Upgrade your plan to get more space.
      </Alert>

      <Alert variant="error" title="Payment Failed">
        Your credit card was declined. Please update your payment method.
      </Alert>
    </section>

    <section>
      <h2>Cards</h2>

      <div class="card-grid">
        <Card title="Monthly Revenue" variant="hover">
          <p class="stat">$12,450</p>
          <p class="stat-change positive">↑ 12% from last month</p>
        </Card>
        <Card title="Active Users" variant="hover">
          <p class="stat">1,234</p>
          <p class="stat-change positive">↑ 8% from last month</p>
        </Card>
        <Card title="Bounce Rate" variant="hover">
          <p class="stat">42%</p>
          <p class="stat-change negative">↓ 3% from last month</p>
        </Card>
      </div>

      <Card
        title="Recent Activity"
        footer="Showing last 10 events"
        variant="hover"
      >
        <p>No recent activity to display.</p>
      </Card>
    </section>

    <section>
      <h2>Tables</h2>

      <Card title="Team Members">
        <Table
          headers={["Name", "Email", "Role", "Status"]}
          rows={[
            ["Alice Johnson", "alice@example.com", "Admin", "Active"],
            ["Bob Smith", "bob@example.com", "Editor", "Active"],
            ["Carol Williams", "carol@example.com", "Viewer", "Inactive"],
            ["David Brown", "david@example.com", "Editor", "Active"],
            ["Eve Davis", "eve@example.com", "Admin", "Active"],
          ]}
        />
        <div class="table-actions">
          <Button variant="primary" size="sm">Add Member</Button>
          <Button variant="secondary" size="sm">Export CSV</Button>
        </div>
      </Card>
    </section>

    <section>
      <h2>Real-World: Settings Page</h2>

      <Alert variant="warning" title="Unsaved Changes">
        You have pending changes. Make sure to save before leaving.
      </Alert>

      <div class="settings-grid">
        <Card title="Profile Settings">
          <form>
            <FormField name="display-name" label="Display Name" value="Isaac Poole" />
            <FormField name="bio" label="Bio" placeholder="Tell us about yourself" />
            <FormField name="website" label="Website" type="url" placeholder="https://example.com" />
            <div class="button-row">
              <Button variant="primary" type="submit">Save Profile</Button>
            </div>
          </form>
        </Card>

        <Card title="Security">
          <form>
            <FormField name="current-password" label="Current Password" type="password" />
            <FormField name="new-password" label="New Password" type="password" />
            <FormField name="confirm-new-password" label="Confirm New Password" type="password" />
            <div class="button-row">
              <Button variant="primary" type="submit">Update Password</Button>
            </div>
          </form>
        </Card>
      </div>
    </section>
  </div>
);
