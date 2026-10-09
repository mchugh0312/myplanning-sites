// Link-preview fetchers and crawlers. iMessage previews identify as
// facebookexternalhit / Twitterbot, so those cover it.
const BOT_RE = new RegExp(
  [
    "facebookexternalhit", "facebot", "twitterbot", "slackbot", "slack-imgproxy",
    "whatsapp", "telegrambot", "discordbot", "linkedinbot", "skypeuripreview",
    "pinterest", "redditbot", "embedly", "googlebot", "bingbot", "applebot",
    "duckduckbot", "yandex", "baiduspider", "petalbot", "ahrefsbot", "semrushbot",
    "headlesschrome", "python-requests", "curl/", "wget", "go-http-client",
    "bot\\b", "crawler", "spider", "preview",
  ].join("|"),
  "i"
);

export function isBotRequest(request) {
  if (request.method === "HEAD") return true;
  const ua = request.headers.get("user-agent") || "";
  return ua === "" || BOT_RE.test(ua);
}
