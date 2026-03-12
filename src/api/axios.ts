import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/coinpool/api',
  withCredentials: true,
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isAuthCheck = error.config?.url?.includes('/auth/me.php');
      const isOnLoginPage = window.location.pathname.includes('/login');
      if (!isAuthCheck && !isOnLoginPage) {
        window.location.href = '/coinpool/login';
        return new Promise(() => {});
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
