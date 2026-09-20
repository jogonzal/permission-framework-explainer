import BASIC_YAML from '../../examples/basic.yaml?raw';

export { BASIC_YAML };
import githubPermissions from '../../examples/github/permissions.yaml?raw';
import githubResources from '../../examples/github/resources.yaml?raw';
import githubEndpoints from '../../examples/github/endpoints.yaml?raw';
import healthcarePermissions from '../../examples/healthcare/permissions.yaml?raw';
import healthcareResources from '../../examples/healthcare/resources.yaml?raw';
import healthcareEndpoints from '../../examples/healthcare/endpoints.yaml?raw';
import multiplayerPermissions from '../../examples/multiplayer/permissions.yaml?raw';
import multiplayerResources from '../../examples/multiplayer/resources.yaml?raw';
import multiplayerEndpoints from '../../examples/multiplayer/endpoints.yaml?raw';
import slackPermissions from '../../examples/slack/permissions.yaml?raw';
import slackResources from '../../examples/slack/resources.yaml?raw';
import slackEndpoints from '../../examples/slack/endpoints.yaml?raw';
import stripePermissions from '../../examples/stripe/permissions.yaml?raw';
import stripeResources from '../../examples/stripe/resources.yaml?raw';
import stripeEndpoints from '../../examples/stripe/endpoints.yaml?raw';

export interface CatalogFile {
  name: string;
  text: string;
}

export interface CatalogEntry {
  id: string;
  title: string;
  description: string;
  files: readonly CatalogFile[];
}

export const CATALOG: readonly CatalogEntry[] = [
  {
    id: 'basic',
    title: 'Basic',
    description: 'A minimal users, billing, and admin DAG.',
    files: [{ name: 'examples/basic.yaml', text: BASIC_YAML }],
  },
  {
    id: 'github',
    title: 'GitHub',
    description: 'Seven layers: leaves, capabilities, job functions, repository roles, apps, org roles, enterprise.',
    files: [
      { name: 'examples/github/permissions.yaml', text: githubPermissions },
      { name: 'examples/github/resources.yaml', text: githubResources },
      { name: 'examples/github/endpoints.yaml', text: githubEndpoints },
    ],
  },
  {
    id: 'stripe',
    title: 'Stripe',
    description: 'Restricted API keys as permission sets; refunds and payouts need multiple leaves.',
    files: [
      { name: 'examples/stripe/permissions.yaml', text: stripePermissions },
      { name: 'examples/stripe/resources.yaml', text: stripeResources },
      { name: 'examples/stripe/endpoints.yaml', text: stripeEndpoints },
    ],
  },
  {
    id: 'slack',
    title: 'Slack',
    description: 'Guest permissions are a non-prefix subset of member, so the DAG is not a chain.',
    files: [
      { name: 'examples/slack/permissions.yaml', text: slackPermissions },
      { name: 'examples/slack/resources.yaml', text: slackResources },
      { name: 'examples/slack/endpoints.yaml', text: slackEndpoints },
    ],
  },
  {
    id: 'healthcare',
    title: 'Healthcare',
    description: 'Narrow FHIR-style clinical roles, with a break-glass emergency permission.',
    files: [
      { name: 'examples/healthcare/permissions.yaml', text: healthcarePermissions },
      { name: 'examples/healthcare/resources.yaml', text: healthcareResources },
      { name: 'examples/healthcare/endpoints.yaml', text: healthcareEndpoints },
    ],
  },
  {
    id: 'multiplayer',
    title: 'Multiplayer',
    description: 'Moderation and economy as sibling branches that only the developer role unifies.',
    files: [
      { name: 'examples/multiplayer/permissions.yaml', text: multiplayerPermissions },
      { name: 'examples/multiplayer/resources.yaml', text: multiplayerResources },
      { name: 'examples/multiplayer/endpoints.yaml', text: multiplayerEndpoints },
    ],
  },
];

export const CATALOG_BY_ID = new Map(CATALOG.map((entry) => [entry.id, entry]));
