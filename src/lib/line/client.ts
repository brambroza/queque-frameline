export async function replyMessage(channelAccessToken: string, replyToken: string, messages: object[]) {
  const res = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });
  if (!res.ok) throw new Error(`LINE reply failed: ${await res.text()}`);
}

export async function pushMessage(channelAccessToken: string, to: string, messages: object[]) {
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify({ to, messages }),
  });
  if (!res.ok) throw new Error(`LINE push failed: ${await res.text()}`);
}
