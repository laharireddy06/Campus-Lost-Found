import axios, { AxiosInstance } from 'axios';
import { getAPIBaseURL } from './config';

const AUTH_TOKEN_KEY = 'lf-hub-auth-token';
const SDK_TOKEN_KEY = 'token';

const parseError = (error: unknown, defaultMessage: string): string => {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string') {
      return detail;
    }
    if (Array.isArray(detail)) {
      return detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
    }
    if (detail && typeof detail === 'object') {
      return (detail as any).message || JSON.stringify(detail);
    }
    return error.response?.data?.message || error.message || defaultMessage;
  }
  return error instanceof Error ? error.message : defaultMessage;
};

class RPApi {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use((config) => {
      const token = this.getToken();
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  private getBaseURL() {
    return getAPIBaseURL();
  }

  getToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(SDK_TOKEN_KEY);
  }

  setToken(token: string) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(SDK_TOKEN_KEY, token);
  }

  clearToken() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(SDK_TOKEN_KEY);
  }

  async getCurrentUser() {
    try {
      const token = this.getToken();
      if (!token) return null;
      
      const response = await this.client.get(`${this.getBaseURL()}/api/v1/auth/me`);
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        this.clearToken();
        return null;
      }
      return null;
    }
  }

  async login() {
    window.location.href = '/login';
  }

  async logout() {
    try {
      this.clearToken();
      await this.client.get(`${this.getBaseURL()}/api/v1/auth/logout`);
    } catch (error) {
      // ignore
    } finally {
      window.location.href = '/';
    }
  }

  async loginWithCredentials(email: string, password: string): Promise<any> {
    try {
      console.log("[authApi/loginWithCredentials] request payload:", { email });
      const response = await this.client.post(`${this.getBaseURL()}/api/v1/auth/login`, {
        email,
        password,
      });
      console.log("[authApi/loginWithCredentials] response:", response.data);
      const token = response.data?.token;
      if (token) {
        this.setToken(token);
      }
      return response.data;
    } catch (error: unknown) {
      console.error("[authApi/loginWithCredentials] error:", error);
      throw new Error(parseError(error, 'Invalid email or password'));
    }
  }

  async registerUser(name: string, email: string, password: string): Promise<any> {
    try {
      console.log("[authApi/registerUser] request payload:", { name, email });
      const response = await this.client.post(`${this.getBaseURL()}/api/v1/auth/register`, {
        name,
        email,
        password,
      });
      console.log("[authApi/registerUser] response:", response.data);
      return response.data;
    } catch (error: unknown) {
      console.error("[authApi/registerUser] error:", error);
      throw new Error(parseError(error, 'Registration failed'));
    }
  }

  async uploadImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.client.post(`${this.getBaseURL()}/api/v1/storage/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    if (!response.data || !response.data.url) {
      throw new Error('Upload response missing image URL');
    }
    return response.data.url;
  }
}

export const authApi = new RPApi();
