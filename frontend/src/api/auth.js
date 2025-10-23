import apiClient from "./client";

export const login = async (email, password) => {
  const username = email.trim();
  const { data } = await apiClient.post("/token/", {
    username,
    password,
  });
  localStorage.setItem("accessToken", data.access);
  localStorage.setItem("refreshToken", data.refresh);
  return data;
};

export const registerUser = async (payload) => {
  const { data } = await apiClient.post("/register/", payload);
  return data;
};

export const logout = () => {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
};
