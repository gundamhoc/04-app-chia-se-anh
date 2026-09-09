import api from './api';

export interface SupportTicket {
  id: number;
  subject: string;
  category: string;
  message: string;
  status: 'pending' | 'answered' | 'closed';
  staff_reply: string | null;
  replied_at: string | null;
  created_at: string;
  responder_name?: string | null;
  responder_role?: 'admin' | 'staff' | null;
}

export interface CreateTicketParams {
  subject: string;
  category: string;
  message: string;
}

export const supportService = {
  /**
   * Gửi thắc mắc hoặc yêu cầu trợ giúp mới
   */
  async createTicket(params: CreateTicketParams): Promise<SupportTicket> {
    const response = await api.post('/support/tickets', params);
    return response.data.data;
  },

  /**
   * Lấy danh sách các câu hỏi / thắc mắc của người dùng
   */
  async getMyTickets(): Promise<SupportTicket[]> {
    const response = await api.get('/support/tickets/my');
    return response.data.data || [];
  },
};

export default supportService;
