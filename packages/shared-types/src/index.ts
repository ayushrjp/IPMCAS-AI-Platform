export interface UserProfile {
  id: string;
  email: string;
  fullName?: string;
  preferredRegion: string;
}

export interface NetworkProfile {
  id: string;
  userId: string;
  networkName: string;
  connectionType: 'WIFI' | 'ETHERNET' | 'CELLULAR_4G' | 'CELLULAR_5G' | 'UNKNOWN';
  ispName?: string;
  asn?: number;
}

export interface APIHealthResponse {
  status: string;
  version: string;
  timestamp: string;
  database: string;
  services: Record<string, string>;
}
