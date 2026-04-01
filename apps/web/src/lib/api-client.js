import axios from "axios";
const client = axios.create({
    baseURL: "/api",
});
export const fetchContainers = async () => {
    const { data } = await client.get("/containers");
    if (!data.success) {
        throw new Error(data.error);
    }
    return data.data;
};
export const runContainerAction = async (id, action) => {
    const { data } = await client.post(`/containers/${id}/${action}`);
    if (!data.success) {
        throw new Error(data.error);
    }
};
export const fetchContainerLogs = async (id) => {
    const { data } = await client.get(`/containers/${id}/logs`);
    if (!data.success) {
        throw new Error(data.error);
    }
    return data.data;
};
export const fetchConfigFiles = async () => {
    const { data } = await client.get("/config-files");
    if (!data.success) {
        throw new Error(data.error);
    }
    return data.data;
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
export const fetchConfigFileContent = async (configPath) => {
    const { data } = await client.get("/config-files/content", {
        params: { path: configPath },
    });
    if (!data.success) {
        throw new Error(data.error);
    }
    return data.data;
};
export const saveConfigFileContent = async (payload) => {
    const { data } = await client.post("/config-files/content", payload);
    if (!data.success) {
        throw new Error(data.error);
    }
    return data.data;
};
