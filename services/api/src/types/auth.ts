export interface AuthTokenPayload {
  sub: string;
  email: string;
  fullName: string;
  devicePublicId?: string;
}
