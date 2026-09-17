export interface LineWebhookEvent {
  type: string;
  replyToken?: string;
  timestamp: number;
  source?: { userId?: string; type?: string };
  message?: { type: string; text?: string; id?: string };
  postback?: { data?: string };
}

export interface LineWebhookBody {
  destination: string;
  events: LineWebhookEvent[];
}
