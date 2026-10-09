/** A Confluence page in storage format, as the REST API and space exports return it. */
export const CONFLUENCE_RFC = `
<ac:structured-macro ac:name="toc" ac:schema-version="1" ac:macro-id="a1"/>
<ac:structured-macro ac:name="info" ac:schema-version="1">
  <ac:parameter ac:name="title">TL;DR</ac:parameter>
  <ac:rich-text-body><p>Move sessions to Postgres&nbsp;behind a flag.</p></ac:rich-text-body>
</ac:structured-macro>
<h1>Context</h1>
<p>Sessions live in <strong>Redis</strong> with <em>no</em> durability. See
  <ac:link><ri:page ri:content-title="Sep 29 outage" ri:space-key="ENG"/><ac:plain-text-link-body><![CDATA[the postmortem]]></ac:plain-text-link-body></ac:link>
  and ask <ac:link><ri:user ri:account-id="557058:aisha"/></ac:link>.</p>
<h2>Migration order</h2>
<ol>
  <li>Dual-write sessions <ac:structured-macro ac:name="jira" ac:schema-version="1"><ac:parameter ac:name="key">PLT-204</ac:parameter><ac:parameter ac:name="server">Jira</ac:parameter></ac:structured-macro></li>
  <li>Switch reads behind <code>auth_pg_sessions</code></li>
</ol>
<ac:task-list>
  <ac:task><ac:task-id>1</ac:task-id><ac:task-status>complete</ac:task-status><ac:task-body>Backfill</ac:task-body></ac:task>
  <ac:task><ac:task-id>2</ac:task-id><ac:task-status>incomplete</ac:task-status><ac:task-body>Cut reads</ac:task-body></ac:task>
</ac:task-list>
<ac:structured-macro ac:name="jira" ac:schema-version="1"><ac:parameter ac:name="jqlQuery">project = PLT AND status != Done</ac:parameter></ac:structured-macro>
<table><tbody>
  <tr><th><p>Step</p></th><th><p>Owner</p></th></tr>
  <tr><td><p>Backfill</p></td><td><p>Aisha</p></td></tr>
</tbody></table>
<ac:structured-macro ac:name="code" ac:schema-version="1">
  <ac:parameter ac:name="language">go</ac:parameter>
  <ac:plain-text-body><![CDATA[const ttl = 30 * time.Minute
if a < b && c > d {}]]></ac:plain-text-body>
</ac:structured-macro>
<ac:structured-macro ac:name="warning" ac:schema-version="1">
  <ac:rich-text-body><p>Keep Redis warm for <a href="https://example.org/runbook">7 days</a>.</p></ac:rich-text-body>
</ac:structured-macro>
<p>Flow: <ac:image ac:alt="Cutover flow"><ri:attachment ri:filename="flow.png"/></ac:image></p>
<ac:structured-macro ac:name="jira-chart" ac:schema-version="1"><ac:parameter ac:name="jql">project = PLT</ac:parameter></ac:structured-macro>
<p>Bad <a href="javascript:alert(1)">link</a><script>alert(1)</script></p>
<hr/>
`;
