export interface User {
  id: number;
  email: string;
  name: string;
  avatar: string;
  slack_connected: boolean;
}
export interface AttachmentInfo {
  filename: string;
  size: number;
}
export interface Attachment {
  filename: string;
  contentType: string;
  data: string; // base64
}
export interface ScheduledEmail {
  id: string;
  recipient: string;
  subject: string;
  body?: string;
  attachments?: AttachmentInfo[];
  scheduled_at: string;
  status: string;
}
export interface SentEmail {
  id: string;
  recipient: string;
  subject: string;
  body?: string;
  attachments?: AttachmentInfo[];
  sent_at: string;
  status: 'sent' | 'failed';
}
export interface ScheduleRequest {
  subject: string;
  body: string;
  recipients: string[];
  startTime: string;
  delaySeconds: number;
  hourlyLimit: number;
  attachments?: Attachment[];
}
