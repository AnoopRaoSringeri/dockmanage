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
