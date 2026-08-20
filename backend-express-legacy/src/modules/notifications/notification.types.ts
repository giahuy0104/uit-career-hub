export type NotificationDto = {
  id: string;
  type: string;
  title: string;
  body: string;
  resourceType: string;
  resourceId: string | null;
  deepLink: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

export type NotificationListQuery = {
  page: number;
  pageSize: number;
  unreadOnly: boolean;
};
