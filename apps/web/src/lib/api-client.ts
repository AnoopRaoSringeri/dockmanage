import { ApiResponse, ContainerSummary } from "@dockmanage/types";
import axios from "axios";

const client = axios.create({
  baseURL: "/api",
});

export const fetchContainers = async (): Promise<ContainerSummary[]> => {
  const { data } = await client.get<ApiResponse<ContainerSummary[]>>("/containers");
  if (!data.success) {
    throw new Error(data.error);
  }

  return data.data;
};

export const runContainerAction = async (
  id: string,
  action: "start" | "stop" | "restart",
): Promise<void> => {
  const { data } = await client.post<ApiResponse<{ message: string }>>(`/containers/${id}/${action}`);
  if (!data.success) {
    throw new Error(data.error);
  }
};
