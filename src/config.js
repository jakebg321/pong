const isDevelopment = import.meta.env.MODE === 'development';

export const SERVER_URL = isDevelopment 
  ? 'http://localhost:3000'
  : 'https://pluto3d.onrender.com';

export default {
  SERVER_URL
}; 