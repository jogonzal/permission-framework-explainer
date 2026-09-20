import basic from '../../examples/basic.yaml?raw';
import githubPermissions from '../../examples/github/10-permissions.yaml?raw';
import githubResources from '../../examples/github/20-resources.yaml?raw';
import githubEndpoints from '../../examples/github/30-endpoints.yaml?raw';
import healthcarePermissions from '../../examples/healthcare/10-permissions.yaml?raw';
import healthcareResources from '../../examples/healthcare/20-resources.yaml?raw';
import healthcareEndpoints from '../../examples/healthcare/30-endpoints.yaml?raw';
import multiplayerPermissions from '../../examples/multiplayer/10-permissions.yaml?raw';
import multiplayerResources from '../../examples/multiplayer/20-resources.yaml?raw';
import multiplayerEndpoints from '../../examples/multiplayer/30-endpoints.yaml?raw';
import slackPermissions from '../../examples/slack/10-permissions.yaml?raw';
import slackResources from '../../examples/slack/20-resources.yaml?raw';
import slackEndpoints from '../../examples/slack/30-endpoints.yaml?raw';
import stripePermissions from '../../examples/stripe/10-permissions.yaml?raw';
import stripeResources from '../../examples/stripe/20-resources.yaml?raw';
import stripeEndpoints from '../../examples/stripe/30-endpoints.yaml?raw';

export interface CatalogEntry {
  id: string;
  title: string;
  description: string;
  files: readonly string[];
}

export const CATALOG: readonly CatalogEntry[] = [
  {
    id: 'basic',
    title: 'Basic',
    description: 'A minimal users, billing, and admin DAG.',
    files: [basic],
  },
  {
    id: 'github',
    title: 'GitHub',
    description: 'Repository roles from read to admin, plus organisation owner.',
    files: [githubPermissions, githubResources, githubEndpoints],
  },
  {
    id: 'stripe',
    title: 'Stripe',
    description: 'Restricted API keys as permission sets; refunds and payouts need multiple leaves.',
    files: [stripePermissions, stripeResources, stripeEndpoints],
  },
  {
    id: 'slack',
    title: 'Slack',
    description: 'Guest permissions are a non-prefix subset of member, so the DAG is not a chain.',
    files: [slackPermissions, slackResources, slackEndpoints],
  },
  {
    id: 'healthcare',
    title: 'Healthcare',
    description: 'Narrow FHIR-style clinical roles, with a break-glass emergency permission.',
    files: [healthcarePermissions, healthcareResources, healthcareEndpoints],
  },
  {
    id: 'multiplayer',
    title: 'Multiplayer',
    description: 'Moderation and economy as sibling branches that only the developer role unifies.',
    files: [multiplayerPermissions, multiplayerResources, multiplayerEndpoints],
  },
];

export const CATALOG_BY_ID = new Map(CATALOG.map((entry) => [entry.id, entry]));
