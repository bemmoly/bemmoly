import { comingSoonProvider } from './registry.ts';

/*
 * AWS (architecture §16) is designed so the interfaces do not bend toward Google: accounts in
 * an organizational unit, an IAM role per account trusting Bemmoly's OIDC issuer, ECS, EKS
 * and Lambda targets, ECR, Secrets Manager and CloudWatch. Until it is built every part
 * reports "Coming soon".
 */
export const awsProvider = comingSoonProvider(
  'aws',
  'Amazon Web Services',
  'Accounts in an organizational unit, an IAM role per account, no access keys',
);
