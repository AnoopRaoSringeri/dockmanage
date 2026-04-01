export type ContainerStatus = "running" | "stopped" | "restarting" | "unknown";

export interface ContainerSummary {
  id: string;
  name: string;
  image: string;
  state: string;
  statusText: string;
  status: ContainerStatus;
}

export interface ConfigFileSummary {
  path: string;
  name: string;
}

export interface ConfigFileContent {
  path: string;
  content: string;
}

export interface UpdateStatus {
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
  releaseName: string;
  updateAvailable: boolean;
}

export interface UpdateResult extends UpdateStatus {
  output: string;
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
