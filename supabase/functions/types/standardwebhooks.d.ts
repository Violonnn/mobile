declare module "standardwebhooks" {
  export class Webhook {
    constructor(secret: string, options?: { tolerance?: number });
    verify(payload: string, headers: Record<string, string>): unknown;
  }
}
