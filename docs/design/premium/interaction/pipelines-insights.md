# Pipelines: Insights

**Primary job.** Are we getting faster and safer? (`/pipelines/insights`, `G I`)

**What is on it.** The four delivery measures for the scope over 30, 90 or 180 days (median
lead time, deploys to Prod a day, change failure rate, median time to restore), each against
the range before (better in green, worse in amber, never red) with a weekly trend. Below, one
row per domain (organisation), group (domain) or owning team (group, or By team), with the same
measures. One request (`GET /insights`), from the daily rollups.

| Action | Mouse | Keyboard | Touch |
| --- | --- | --- | --- |
| Change the range | The range control | Tab, arrows | Tap |
| Zoom into a domain or group | Its row | J K, Enter | Tap the row |
| Break down by team | By team | Tab, arrows | Tap |

**States.** Four tile skeletons and table rows; a measure with nothing in Prod says None and
why; no earlier range says so instead of a trend; empty scope says Insights fill in as releases
reach Prod. **URL state.** `?range=`, `?by=team`, the scope.
