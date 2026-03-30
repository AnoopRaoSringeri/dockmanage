export type ContainerStatus = "running" | "stopped" | "restarting" | "unknown";

export interface ContainerSummary {
  id: string;
  name: string;
  image: string;
  state: string;
  statusText: string;
  status: ContainerStatus;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
