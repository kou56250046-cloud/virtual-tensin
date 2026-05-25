export interface Session {
  id: string;
  name: string;
  avatar_url: string | null;
  color: string;
  x: number;
  y: number;
  seat_id: string | null;
  last_seen: string;
  created_at: string;
}

export interface Message {
  id: string;
  session_id: string | null;
  sender_name: string;
  content: string;
  created_at: string;
}

export interface CallRequest {
  id: string;
  from_session_id: string;
  to_session_id: string;
  meet_link: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  created_at: string;
}
