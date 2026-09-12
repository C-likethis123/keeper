# Private API proxy

This Worker has no public `workers.dev` route. Cloudflare Pages invokes it through
a Service Binding, and the Worker reaches Oracle through a Workers VPC Service
bound to the Cloudflare Tunnel.

## Configure

1. In Cloudflare Workers VPC dashboard, open the **VPC Services** tab and create
   a service for the existing tunnel. Set its target to `api` on port `8787`
   using HTTP.
2. Copy the VPC Service ID into `wrangler.jsonc`.
3. Deploy this Worker:

   ```bash
   cd cloudflare/private-api-proxy
   npx wrangler secret put KEEPER_PRIVATE_PROXY_TOKEN
   npx wrangler deploy
   ```

4. In Workers & Pages > your Pages project > Settings > Bindings, add a Service
   Binding named `PRIVATE_API_PROXY` and select `keeper-private-api-proxy`.
5. Add `EXPO_PUBLIC_SYNC_SERVER_URL=/api` to the Pages production build
   environment and redeploy Pages.

The Pages Function strips browser authority headers and the Worker adds the
private token. Oracle therefore only accepts requests that traversed this
Worker.

Use the same value for the Worker secret and the GitHub repository secret
`KEEPER_PRIVATE_PROXY_TOKEN`. Generate it locally with:

```bash
openssl rand -hex 32
```

Then store it in GitHub:

```bash
gh secret set KEEPER_PRIVATE_PROXY_TOKEN --repo OWNER/REPO --body 'generated-value'
```

No tunnel published application route is needed. Do not create one.
