// Wistic Status: checks every minute whether everything is online.
// The dashboard message is only replaced when something changes (so Discord never shows "(edited)").
// Manual run: open the worker address in your browser. Add ?refresh=1 to force a new message.

const GROUPS = [
  {
    title: "Website",
    services: [
      { name: "wistic.net", url: "https://wistic.net" },
      { name: "www.wistic.net", url: "https://www.wistic.net" },
      { name: "Support", url: "https://wistic.net/support" },
    ],
  },
  {
    title: "App",
    services: [
      { name: "Update server", url: "https://wistic.net/updates/latest.yml" },
      { name: "Download", url: "https://wistic.net/updates/Wistic-Setup.exe", method: "HEAD" },
      { name: "Clip sharing", url: "https://wistic.net/api/username/check?name=statuscheck" },
      { name: "Login", url: "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com" },
    ],
  },
];

const IMAGE_URL = ""; // optional: link to an image or GIF at the bottom of the dashboard

async function check(url, method = "GET") {
  try {
    const res = await fetch(url, { method, signal: AbortSignal.timeout(8000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function run(env, force = false) {
  if (!env.DISCORD_STATUS_WEBHOOK) throw new Error("DISCORD_STATUS_WEBHOOK is missing");
  if (!env.STATUS) throw new Error("KV namespace STATUS is missing");
  const hook = env.DISCORD_STATUS_WEBHOOK;

  const groups = await Promise.all(
    GROUPS.map(async (g) => ({
      title: g.title,
      items: await Promise.all(
        g.services.map(async (s) => ({ name: s.name, up: await check(s.url, s.method) }))
      ),
    }))
  );

  const all = groups.flatMap((g) => g.items);
  const allUp = all.every((i) => i.up);
  const anyUp = all.some((i) => i.up);
  const sig = all.map((i) => (i.up ? "1" : "0")).join("");

  const report = [allUp ? "All systems operational" : anyUp ? "Issues detected" : "Major outage"];
  for (const i of all) report.push(`${i.up ? "ONLINE " : "OFFLINE"} ${i.name}`);

  const id = await env.STATUS.get("messageId");
  const oldSig = await env.STATUS.get("sig");

  if (id && oldSig === sig && !force) {
    // Nothing changed: leave the message alone, but make sure it still exists
    const r = await fetch(`${hook}/messages/${id}`);
    if (r.ok) {
      report.push("No change, message left as is");
      return report.join("\n");
    }
    if (r.status !== 404) {
      report.push(`Could not check message (${r.status}), skipping`);
      return report.join("\n");
    }
    report.push("Message was deleted, posting a new one");
  } else if (id) {
    // Something changed: remove the old message
    const d = await fetch(`${hook}/messages/${id}`, { method: "DELETE" });
    report.push(`Old message removed: ${d.status}`);
  }

  const unix = Math.floor(Date.now() / 1000);
  const lines = [
    allUp ? "🟢 All systems operational" : anyUp ? "🟠 Issues detected" : "🔴 Major outage",
    `Status since <t:${unix}:f>`,
    "",
  ];
  for (const g of groups) {
    lines.push(`**${g.title}**`);
    for (const i of g.items) {
      lines.push(`${i.up ? "🟢" : "🔴"} **${i.name}** – ${i.up ? "online" : "offline"}`);
    }
    lines.push("");
  }

  const embed = {
    title: "Wistic Status",
    description: lines.join("\n"),
    color: allUp ? 0x2ecc71 : anyUp ? 0xf39c12 : 0xe74c3c,
  };
  if (IMAGE_URL) embed.image = { url: IMAGE_URL };

  const res = await fetch(`${hook}?wait=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "Wistic Status", embeds: [embed] }),
  });
  if (!res.ok) throw new Error(`Discord rejected the message (${res.status}): ${await res.text()}`);
  const msg = await res.json();
  await env.STATUS.put("messageId", msg.id);
  await env.STATUS.put("sig", sig);
  report.push(`New Discord message posted: ${msg.id}`);
  return report.join("\n");
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      run(env).then(
        (r) => console.log(r),
        (e) => console.error("ERROR: " + e.message)
      )
    );
  },
  async fetch(req, env) {
    const force = new URL(req.url).searchParams.has("refresh");
    try {
      return new Response(await run(env, force), { headers: { "content-type": "text/plain; charset=utf-8" } });
    } catch (e) {
      return new Response("ERROR: " + e.message, { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } });
    }
  },
};


