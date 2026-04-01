import axios from "axios";
const client = axios.create({
    baseURL: "/api",
});
const getApiErrorMessage = (error) => {
    if (axios.isAxiosError(error)) {
        const response = error.response;
        if (response?.data && typeof response.data === "object") {
            const apiResponse = response.data;
            if (!apiResponse.success && typeof apiResponse.error === "string") {
                return apiResponse.error;
            }
        }
        return error.message || "Network error";
    }
    if (error instanceof Error) {
        return error.message;
    }
    return typeof error === "string" ? error : "Unknown error";
};
const getApiData = async (request) => {
    try {
        const { data } = await request;
        if (!data.success) {
            throw new Error(data.error);
        }
        return data.data;
    }
    catch (error) {
        throw new Error(getApiErrorMessage(error));
    }
};
export const fetchContainers = async () => getApiData(client.get("/containers"));
export const runContainerAction = async (id, action) => {
    await getApiData(client.post(`/containers/${id}/${action}`));
};
export const fetchContainerLogs = async (id) => getApiData(client.get(`/containers/${id}/logs`));
export const fetchConfigFiles = async () => getApiData(client.get("/config-files"));
export const checkForUpdate = async () => getApiData(client.get("/update/check"));
export const performUpdate = async () => getApiData(client.post("/update/perform"));
export const deleteConfigFile = async (path) => {
    await getApiData(client.delete("/config-files/content", {
        params: { path },
    }));
};
export const openContainerLogStream = (id, onMessage, onError) => {
    const source = new EventSource(`/api/containers/${encodeURIComponent(id)}/logs?stream=true`);
    source.onmessage = (event) => {
        onMessage(event.data);
    };
    source.onerror = () => {
        onError("Log stream disconnected");
        source.close();
    };
    return source;
};
export const fetchConfigFileContent = async (configPath) => getApiData(client.get("/config-files/content", {
    params: { path: configPath },
}));
export const saveConfigFileContent = async (payload) => getApiData(client.post("/config-files/content", payload));
