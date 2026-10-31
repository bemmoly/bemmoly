---
'@bemmoly/module-pipelines': major
---

Bemmoly 2.0: Pipelines ships to your own cloud, from a push to Prod.

- Connect Google Cloud in one of two ways. Attach projects you already have, or let Pipelines create them on one folder grant, with the Starter, Standard or Enterprise layout.
- Run each application on Cloud Run, GKE Autopilot, GKE Standard or a cluster you attach, chosen per environment. A front door moves a service between them with no failed requests.
- Secrets live in Secret Manager. Pipelines keeps references and versions, never values. Values stored by 1.x are moved out after the upgrade.
- Builds run on machines you start, on Cloud Build one job at a time, or on GKE Autopilot pools that scale to zero.
- Export everything Pipelines made as Terraform and Helm, and run it without Pipelines.

Upgrading from 1.x: runner pools gained a hosting choice and the provider contract changed shape. Restart runners on the 2.0 image. Connect a cloud before the upgrade if you have secrets stored as plain values, so the move to Secret Manager has somewhere to go.
