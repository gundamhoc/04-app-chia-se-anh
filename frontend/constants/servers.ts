// Danh muc may chu backend chuan hoa (khong hardcode URL roi rac trong app)

// Cloud Render - chay 24/7 (free tier, co keep-alive workflow), dung cho demo + build APK
export const SERVER_RENDER_URL = 'https://zero4-app-chia-se-anh.onrender.com';

// ngrok tinh - cau tam tro ve may tinh dev (phai chay ngrok tren PC)
export const SERVER_NGROK_URL = 'https://reassure-limelight-twiddle.ngrok-free.dev';

export type ServerChoice = 'render' | 'ngrok' | 'custom' | 'default';

export interface ServerOption {
  choice: ServerChoice;
  labelKey: string;
  url: string | null; // null = mac dinh (env / LAN / localhost)
}

export const SERVER_OPTIONS: ServerOption[] = [
  { choice: 'render', labelKey: 'server_render', url: SERVER_RENDER_URL },
  { choice: 'ngrok', labelKey: 'server_ngrok', url: SERVER_NGROK_URL },
  { choice: 'default', labelKey: 'server_default', url: null },
];
